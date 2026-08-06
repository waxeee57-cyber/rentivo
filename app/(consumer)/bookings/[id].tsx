import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useStripe } from '@stripe/stripe-react-native'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { Divider } from '@/components/ui/Divider'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { useToastStore } from '@/lib/store/useToastStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import { getError } from '@/lib/errors'
import { formatDate, formatDateRange, isDateToday } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import {
  calculateCancellationRefund, getCancellationPolicyColor, getCancellationPolicyLabel,
  shouldShowRefundEstimate,
} from '@/lib/utils/cancellation'
import { useBooking } from '@/lib/hooks/useBookings'
import { cancelBooking } from '@/lib/api/bookings'
import {
  fetchDepositState, canRevaultDepositCard, startDepositRevault,
  type DepositState,
} from '@/lib/api/deposits'
import { captureException } from '@/lib/sentry'
import { Config } from '@/constants/config'
import { MOCK_REVIEWS } from '@/lib/mockData'
import { supabase } from '@/lib/supabase'
import type { BookingStatus, CancellationPolicy } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

export default function BookingDetailScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const language = useAuthStore(s => s.language)
  const STATUS_LABELS = useMemo<Record<BookingStatus, string>>(() => ({
    pending: t('cbkStatusPending', language),
    confirmed: t('cbkStatusConfirmed', language),
    active: t('cbkStatusActive', language),
    completed: t('cbkStatusCompleted', language),
    cancelled: t('cbkStatusCancelled', language),
    disputed: t('cbkStatusDisputed', language),
  }), [language])
  const STATUS_COLORS: Record<BookingStatus, string> = {
    pending: C.warning,
    confirmed: C.success,
    active: C.primary,
    completed: C.textSecondary,
    cancelled: C.error,
    disputed: C.error,
  }
  const { id } = useLocalSearchParams<{ id: string }>()
  const bookingId = Config.useMock ? (id ?? 'bk-001') : (id ?? '')
  const { booking, loading, error, refetch } = useBooking(bookingId)
  const [showCancelSheet, setShowCancelSheet] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [hasReview, setHasReview] = useState(false)
  const [depositState, setDepositState] = useState<DepositState | null>(null)
  const [revaulting, setRevaulting] = useState(false)
  const { showToast } = useToastStore()
  const { confirmSetupIntent } = useStripe()

  useEffect(() => {
    if (!booking?.id) return
    if (Config.useMock) {
      setHasReview(MOCK_REVIEWS.some(r => r.booking_id === booking.id))
      return
    }
    void supabase
      .from('rentivo_reviews')
      .select('id')
      .eq('booking_id', booking.id)
      .maybeSingle()
      // supabase-js RESOLVES on failure, so the error arrives here rather than
      // as a rejection. Treating an RLS denial or a dropped connection as
      // "no review yet" would offer a second review on a booking already
      // reviewed; record it and leave the flag alone instead.
      .then(({ data, error: reviewError }) => {
        if (reviewError) {
          captureException(reviewError, { scope: 'bookingDetail.hasReview', bookingId: booking.id })
          return
        }
        setHasReview(!!data)
      })
  }, [booking?.id])

  // The deposit_* columns are not in fetchBooking's select list, so they need
  // their own read. On failure the card stays hidden rather than rendering a
  // guessed state: "no deposit" and "deposit we could not read" look identical
  // on screen but mean opposite things to a renter whose card just declined.
  const loadDepositState = useCallback(async () => {
    if (!booking?.id) return
    try {
      setDepositState(await fetchDepositState(booking.id))
    } catch (e) {
      captureException(e, { scope: 'bookingDetail.fetchDepositState', bookingId: booking.id })
    }
  }, [booking?.id])

  useEffect(() => {
    void loadDepositState()
  }, [loadDepositState])

  if (loading) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>
  if (error || !booking) return <ErrorState message={error ?? t('hostBBookingNotFound', language)} onRetry={refetch} />

  const pickupToday = isDateToday(booking.start_date)
  const returnToday = isDateToday(booking.end_date)
  const policy = (booking.listing?.cancellation_policy ?? 'moderate') as CancellationPolicy

  // A booking that was never paid gets nothing back, so it must not be shown a
  // refund figure. `status === 'pending'` is exactly the unpaid state, and the
  // old condition let it through: an unpaid booking rendered "If you cancel now:
  // 100% refund (EUR 440.00)" while cancel-booking correctly refunded EUR 0 and
  // never called Stripe. shouldShowRefundEstimate/1 is the single place that
  // decision lives now, so the e2e can assert it directly.
  const refundCalc = shouldShowRefundEstimate(booking.status, booking.payment_status)
    ? calculateCancellationRefund(policy, booking.start_date, booking.total_amount, language)
    : null

  /**
   * Re-vault: let the renter put a DIFFERENT card behind the deposit.
   *
   * Before this, a booking sitting at deposit_status='charge_failed' was a dead
   * end — the server-side retry works, but retrying a declined card just
   * declines again, and the only call to create-deposit-setup in the whole app
   * was on the checkout screen, which this booking is long past.
   *
   * Nothing is charged here. A SetupIntent only vaults the card for a LATER
   * off_session charge that still requires the operator to assess damage.
   */
  const handleUpdateDepositCard = async () => {
    if (!depositState || revaulting) return
    setRevaulting(true)
    try {
      const setup = await startDepositRevault(depositState)

      // Mock mode never reaches Stripe. startDepositRevault hands back a fake
      // client_secret, and confirming that against the real SDK would surface a
      // Stripe error in a demo build that has no payment configured at all.
      if (Config.useMock) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        // i18n-pending: cbkDepositCardSubmitted
        showToast({
          message: 'New card submitted. It replaces your deposit card once confirmed.',
          type: 'info',
        })
        return
      }

      const { error: stripeError } = await confirmSetupIntent(setup.clientSecret, {
        paymentMethodType: 'Card',
      })
      if (stripeError) {
        // Never log the raw Stripe error — it lands in device logs (adb logcat,
        // crash reporters) carrying card and customer metadata. Code only.
        captureException(new Error(`confirmSetupIntent: ${stripeError.code ?? 'unknown'}`), {
          scope: 'bookingDetail.revaultDeposit',
          reusedExistingIntent: setup.reusedExistingIntent,
        })
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        showToast({
          // `reusedExistingIntent` means create-deposit-setup replayed the
          // SetupIntent already on the booking instead of minting a fresh one,
          // so Stripe rejected the confirm for state reasons, NOT because this
          // card is bad. Saying "declined" there would be a lie about a card
          // that was never even submitted.
          // i18n-pending: cbkDepositCardSetupUnavailable
          message: setup.reusedExistingIntent
            ? 'We could not start a new card setup for this booking. Please contact support.'
            : (stripeError.message ?? getError('payment_failed')),
          type: 'error',
        })
        return
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // Deliberately does NOT claim the deposit is now secured: the card only
      // becomes the deposit card once the setup_intent.succeeded webhook writes
      // deposit_payment_method_id, which is asynchronous.
      // i18n-pending: cbkDepositCardSubmitted
      showToast({
        message: 'New card submitted. It replaces your deposit card once confirmed.',
        type: 'info',
      })
      await loadDepositState()
    } catch (e) {
      captureException(e, { scope: 'bookingDetail.revaultDeposit', bookingId: booking.id })
      showToast({
        message: e instanceof Error && e.message ? e.message : getError('payment_failed'),
        type: 'error',
      })
    } finally {
      setRevaulting(false)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    try {
      // cancel-booking issues the actual Stripe refund and returns the amount it
      // moved. The old path only flipped `status` — the refund this very screen
      // promises above never happened.
      let refunded = refundCalc?.refundAmount ?? 0
      if (!Config.useMock) {
        const result = await cancelBooking(booking.id)
        refunded = result.refundAmount
      }
      setShowCancelSheet(false)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({
        message: refunded > 0
          ? `${t('cbkBookingCancelled', language)} · ${t('refundProcessing', language)} (${formatEURDecimal(refunded)})`
          : t('cbkBookingCancelled', language),
        type: 'info',
      })
      router.back()
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      showToast({
        message: e instanceof Error && e.message ? e.message : t('cancelFailed', language),
        type: 'error',
      })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={`#${booking.id.slice(0, 8).toUpperCase()}`}
        subtitle={booking.listing?.title}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.statusBanner, { backgroundColor: STATUS_COLORS[booking.status] + '22' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[booking.status] }]}>
            {STATUS_LABELS[booking.status]}
          </Text>
        </View>

        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.vehicleTitle}>{booking.listing?.title ?? 'Vehicle'}</Text>
          <Text style={styles.operatorName}>{booking.operator?.name}</Text>
          <Text style={styles.dates}>{formatDateRange(booking.start_date, booking.end_date)} · {booking.total_days} days</Text>
        </Card>

        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>{t('cbkPrice', language)}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('cbkTotalPaid', language)}</Text>
            <Text style={styles.priceValue}>{formatEURDecimal(booking.total_amount)}</Text>
          </View>
          <Badge label={booking.payment_status} variant={booking.payment_status === 'paid' ? 'success' : 'warning'} />
          {booking.deposit_amount > 0 && (
            <View style={styles.depositInfoRow}>
              <Ionicons name="lock-closed" size={12} color={C.info} importantForAccessibility="no" />
              {/* Localised: the amount is interpolated so es/hu can put the figure
                  where their grammar needs it, not just where English does. */}
              <Text style={styles.depositInfo}>
                {t('depositHoldActive', language, { amount: formatEURDecimal(booking.deposit_amount) })}
              </Text>
            </View>
          )}
        </Card>

        {/* Deposit card management. Shown only while the deposit is live and
            replaceable ('authorized' or 'charge_failed'); 'charged' and
            'released' are terminal, and a EUR 0 waiver has no card at all —
            canRevaultDepositCard/1 owns all of that so this screen and the
            edge function cannot drift apart about it. */}
        {canRevaultDepositCard(depositState) && (
          <Card style={{ marginBottom: Spacing.base }}>
            <Text style={styles.sectionTitle}>{t('deposit', language)}</Text>

            {depositState?.depositStatus === 'charge_failed' && (
              <View style={styles.depositAlertRow}>
                <Ionicons name="alert-circle" size={16} color={C.error} importantForAccessibility="no" />
                {/* i18n-pending: cbkDepositChargeDeclined */}
                <Text style={styles.depositAlertText}>
                  The deposit charge on your saved card was declined.
                </Text>
              </View>
            )}

            {/* i18n-pending: cbkDepositCardNote */}
            <Text style={styles.depositCardNote}>
              You can replace the card your deposit would be charged to. Nothing is charged now.
            </Text>

            <Button
              // i18n-pending: cbkDepositUseDifferentCard
              title="Use a different card"
              onPress={() => void handleUpdateDepositCard()}
              variant={depositState?.depositStatus === 'charge_failed' ? 'primary' : 'secondary'}
              loading={revaulting}
              fullWidth
              // i18n-pending: cbkDepositUseDifferentCardA11y
              accessibilityLabel="Use a different card for the security deposit"
            />
          </Card>
        )}

        {/* Damage waiver (i18n keys keep the legacy `insurance*` names — they are
            internal ids shared with the DB column, only the copy changed). */}
        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>{t('insurance', language)}</Text>
          <View style={styles.insuranceRow}>
            <Ionicons name="shield-checkmark" size={18} color={C.success} importantForAccessibility="no" />
            <Text style={styles.insuranceText}>{t('cbkInsuranceDesc', language)}</Text>
          </View>
        </Card>

        {/* Cancellation Policy */}
        {refundCalc && (
          <Card style={{ marginBottom: Spacing.base }}>
            <Text style={styles.sectionTitle}>{t('cancellationPolicy', language)}</Text>
            <View style={styles.policyLabelRow}>
              <Ionicons name="ellipse" size={8} color={getCancellationPolicyColor(policy)} importantForAccessibility="no" />
              <Text style={styles.policyLabel}>{getCancellationPolicyLabel(policy, language)}</Text>
            </View>
            <Divider style={{ marginVertical: Spacing.sm }} />
            <Text style={styles.refundNote}>
              {t('ifYouCancelNow', language)}{' '}
              <Text style={{ fontFamily: Fonts.bold }}>
                {t('refundPercentLabel', language).replace('{percent}', String(refundCalc.refundPercent))}
              </Text>
              {refundCalc.refundAmount > 0 ? ` (${formatEURDecimal(refundCalc.refundAmount)})` : ''}
            </Text>
            <Text style={styles.refundMessage}>{refundCalc.message}</Text>
          </Card>
        )}

        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>{t('cbkInspectionTitle', language)}</Text>
          <View style={styles.inspectionRow}>
            <Text style={styles.inspLabel}>{t('cbkPickup', language)}</Text>
            <Badge
              label={booking.pickup_damage_done ? t('cbkDone', language) : t('pending', language)}
              variant={booking.pickup_damage_done ? 'success' : 'warning'}
            />
          </View>
          <Divider style={{ marginVertical: Spacing.sm }} />
          <View style={styles.inspectionRow}>
            <Text style={styles.inspLabel}>{t('cbkReturn', language)}</Text>
            <Badge
              label={booking.return_damage_done ? t('cbkDone', language) : t('pending', language)}
              variant={booking.return_damage_done ? 'success' : 'warning'}
            />
          </View>
        </Card>

        {booking.operator?.phone && (
          <Card style={{ marginBottom: Spacing.base }}>
            <Text style={styles.sectionTitle}>{t('contactOperator', language)}</Text>
            <TouchableOpacity
              style={styles.phoneBtn}
              onPress={() => Linking.openURL(`tel:${booking.operator!.phone}`)}
            >
              <Ionicons name="call-outline" size={16} color={C.primaryDark} importantForAccessibility="no" />
              <Text style={styles.phoneBtnText}>{booking.operator.phone}</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Action buttons */}
        {booking.status === 'confirmed' && pickupToday && !booking.pickup_damage_done && (
          <Button
            title={t('cbkStartPickupInspection', language)}
            onPress={() => router.push(`/(consumer)/damage/pickup/${booking.id}`)}
            fullWidth
            style={{ marginBottom: Spacing.md }}
          />
        )}

        {booking.status === 'active' && returnToday && !booking.return_damage_done && (
          <Button
            title={t('cbkStartReturnInspection', language)}
            onPress={() => router.push(`/(consumer)/damage/return/${booking.id}`)}
            fullWidth
            style={{ marginBottom: Spacing.md }}
          />
        )}

        {/* Sign the rental agreement.
            The signature screen existed, was registered in the layout, and NOTHING
            navigated to it — not one router.push anywhere in the repo. A
            legally-binding eIDAS signature flow that no user can reach is the same
            as not having one, and "View contract" below opened a contract_url that
            nothing could ever write. This is the entry point. */}
        {(booking.status === 'confirmed' || booking.status === 'active')
          && booking.contract_status !== 'fully_signed'
          && booking.contract_status !== 'guest_signed' && (
          <Button
            title={t('cbkSignAgreement', language)}
            onPress={() => router.push(`/(consumer)/booking/sign/${booking.id}`)}
            fullWidth
            style={{ marginBottom: Spacing.md }}
          />
        )}

        {/* View contract */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            if (booking.contract_url) {
              void Linking.openURL(booking.contract_url)
            } else if (booking.status === 'confirmed' || booking.status === 'active' || booking.status === 'completed') {
              showToast({ message: t('cbkContractGenerating', language), type: 'info' })
            } else {
              showToast({ message: t('cbkContractAfterConfirm', language), type: 'info' })
            }
          }}
          accessibilityLabel={t('cbkViewContractLabel', language)}
          accessibilityRole="button"
        >
          <Ionicons name="document-text-outline" size={15} color={C.text} importantForAccessibility="no" />
          <Text style={styles.actionBtnText}>{t('cbkViewContractBtn', language)}</Text>
        </TouchableOpacity>

        {/* Message operator */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push(`/(consumer)/bookings/chat/${booking.id}`)}
          accessibilityLabel={t('messageOperator', language)}
          accessibilityRole="button"
        >
          <Ionicons name="chatbubble-ellipses-outline" size={15} color={C.text} importantForAccessibility="no" />
          <Text style={styles.actionBtnText}>{t('cbkMessageOperatorBtn', language)}</Text>
        </TouchableOpacity>

        {(booking.status === 'completed' || booking.status === 'active') && (
          <TouchableOpacity
            style={styles.disputeBtn}
            onPress={() => router.push(`/(consumer)/bookings/dispute/${booking.id}` as Parameters<typeof router.push>[0])}
            accessibilityLabel={t('cbkOpenDispute', language)}
            accessibilityRole="button"
          >
            <Ionicons name="warning-outline" size={14} color={C.warning} importantForAccessibility="no" />
            <Text style={styles.disputeBtnText}>{t('cbkOpenDisputeBtn', language)}</Text>
          </TouchableOpacity>
        )}

        {/* Leave review */}
        {booking.status === 'completed' && !hasReview && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnGold]}
            onPress={() => router.push(`/(consumer)/bookings/review/${booking.id}`)}
            accessibilityLabel={t('cbkLeaveReviewLabel', language)}
            accessibilityRole="button"
          >
            <Ionicons name="star-outline" size={15} color={C.primaryDark} importantForAccessibility="no" />
            <Text style={[styles.actionBtnText, { color: C.primaryDark }]}>{t('cbkLeaveReviewBtn', language)}</Text>
          </TouchableOpacity>
        )}

        {/* Cancel */}
        {['confirmed', 'pending'].includes(booking.status) && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => setShowCancelSheet(true)}
            accessibilityLabel={t('cbkCancelThisBooking', language)}
            accessibilityRole="button"
          >
            <Text style={[styles.actionBtnText, { color: C.error }]}>{t('cbkCancelBookingBtn', language)}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      <ConfirmSheet
        visible={showCancelSheet}
        title={t('cbkCancelConfirmTitle', language)}
        message={t('cbkCannotBeUndone', language)}
        confirmLabel={cancelling ? t('cbkCancelling', language) : t('cbkYesCancel', language)}
        confirmVariant="danger"
        onConfirm={handleCancel}
        onCancel={() => setShowCancelSheet(false)}
        details={refundCalc ? [
          { label: t('cbkRefundAmount', language), value: formatEURDecimal(refundCalc.refundAmount) },
          { label: t('cbkPolicy', language), value: getCancellationPolicyLabel(policy, language) },
        ] : undefined}
      />
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  statusBanner: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.base,
    alignItems: 'center',
  },
  statusText: { fontSize: 15, fontFamily: Fonts.bold },
  vehicleTitle: { fontSize: 18, fontFamily: Fonts.bold, color: C.text, marginBottom: 4 },
  operatorName: { fontSize: 15, color: C.text, fontFamily: Fonts.medium, marginBottom: 4 },
  dates: { fontFamily: Fonts.regular, fontSize: 15, color: C.text },
  sectionTitle: { fontSize: 12, fontFamily: Fonts.bold, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  priceLabel: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary },
  priceValue: { fontSize: 16, fontFamily: Fonts.bold, color: C.text },
  depositInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.sm },
  depositInfo: { fontFamily: Fonts.regular, fontSize: 12, color: C.info },
  depositAlertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: C.errorSurface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  depositAlertText: { flex: 1, fontFamily: Fonts.semibold, fontSize: 13, color: C.error, lineHeight: 18 },
  depositCardNote: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 19,
    marginBottom: Spacing.md,
  },
  insuranceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  insuranceText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  policyLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs },
  policyLabel: { fontSize: 14, color: C.text, fontFamily: Fonts.semibold },
  refundNote: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary },
  refundMessage: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, marginTop: 4, lineHeight: 18 },
  inspectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inspLabel: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary },
  phoneBtn: { backgroundColor: C.primarySurface, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  phoneBtnText: { fontSize: 15, color: C.primaryDark, fontFamily: Fonts.semibold },
  actionBtn: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    backgroundColor: C.surface,
    minHeight: 44,
  },
  actionBtnGold: { borderColor: C.primary, backgroundColor: C.primarySurface },
  actionBtnDanger: { borderColor: C.error + '44', backgroundColor: C.errorSurface },
  actionBtnText: { fontSize: 15, color: C.text, fontFamily: Fonts.semibold },
  disputeBtn: {
    borderWidth: 1,
    borderColor: C.warning,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    minHeight: 44,
  },
  disputeBtnText: { fontSize: 14, color: C.warning, fontFamily: Fonts.semibold },
  })
}
