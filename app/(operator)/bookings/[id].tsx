import React, { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { formatDate, formatDateRange } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { useBooking } from '@/lib/hooks/useBookings'
import { updateBookingStatus, cancelBooking } from '@/lib/api/bookings'
import { captureException } from '@/lib/sentry'
import { useToastStore } from '@/lib/store/useToastStore'
import { Config } from '@/constants/config'
import type { BookingStatus } from '@/types'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { ownerPayout } from '@/lib/utils/payout'
import { useAuthStore } from '@/lib/store/useAuthStore'

export default function OperatorBookingDetailScreen() {
  const C = useColors()
  const { styles, flightStyles } = useMemo(() => makeStyles(C), [C])
  const { id } = useLocalSearchParams<{ id: string }>()
  const bookingId = Config.useMock ? (id ?? 'bk-001') : (id ?? '')
  const { booking, loading, error } = useBooking(bookingId)
  const { showToast } = useToastStore()
  const { language } = useAuthStore()
  const [confirming, setConfirming] = useState(false)
  const [showDeclineSheet, setShowDeclineSheet] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)

  if (loading) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>
  if (error || !booking) return <ErrorState message={error ?? t('opBkNotFound', language)} />

  const handleConfirm = async () => {
    setConfirming(true)
    setStatusChanging(true)
    try {
      await updateBookingStatus(booking.id, 'confirmed')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: `✓ ${t('opBkToastConfirmed', language)}`, type: 'success' })
    } catch {
      showToast({ message: t('opBkToastConfirmFail', language), type: 'error' })
    } finally {
      setConfirming(false)
      setStatusChanging(false)
    }
  }

  const handleDecline = async () => {
    setStatusChanging(true)
    try {
      // Must go through cancelBooking(): updateBookingStatus only flipped a
      // column, so declining a PAID booking took the guest's money and
      // refunded nothing. See lib/api/bookings.ts.
      await cancelBooking(booking.id)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      showToast({ message: t('opBkToastDeclined', language), type: 'error' })
      router.back()
    } catch (e) {
      captureException(e, { screen: 'operator/booking-detail', action: 'decline', bookingId: booking.id })
      showToast({ message: t('opBkToastDeclineFail', language), type: 'error' })
    } finally {
      setStatusChanging(false)
    }
  }

  const handleStatusChange = async (status: BookingStatus) => {
    setStatusChanging(true)
    try {
      await updateBookingStatus(booking.id, status)
      // Was hardcoded English. The status token itself is already translated
      // via the shared status labels, so the sentence localises cleanly.
      showToast({
        message: t('bookingMarkedAs', language).replace('{status}', t(status as never, language)),
        type: 'success',
      })
    } catch {
      showToast({ message: t('opBkToastStatusFail', language), type: 'error' })
    } finally {
      setStatusChanging(false)
    }
  }

  // Stripe transfers the rental SUBTOTAL to the owner (see lib/utils/payout.ts);
  // the service fee is charged to the renter on top, not deducted from here.
  // Was `total_amount * 0.975`, which both used a rate that has never been
  // configured and took it off the wrong base — inflating the figure ~7%.
  const operatorPayout = ownerPayout(booking)

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={`#${booking.id.slice(0, 8).toUpperCase()}`}
        subtitle={booking.listing?.title}
      />

      {/* FIRST THING VISIBLE: prominent confirm banner for pending */}
      {booking.status === 'pending' && (
        <View style={styles.actionBanner}>
          <View style={styles.actionTitleRow}>
            <Ionicons name="calendar-outline" size={16} color={C.success} importantForAccessibility="no" />
            <Text style={styles.actionTitle}>{t('opBkNewRequest', language)}</Text>
          </View>
          <Text style={styles.actionSubtitle}>{t('opBkRespond24h', language)}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => setShowDeclineSheet(true)}
              disabled={statusChanging}
              accessibilityLabel="Decline booking"
              accessibilityRole="button"
            >
              <Text style={styles.declineBtnText}>{t('declineBooking', language)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (confirming || statusChanging) && styles.confirmBtnDisabled]}
              onPress={() => void handleConfirm()}
              disabled={confirming || statusChanging}
              accessibilityLabel="Confirm booking"
              accessibilityRole="button"
            >
              <Text style={styles.confirmBtnText}>
                {confirming ? t('opBkConfirming', language) : `✓ ${t('confirmBooking', language)}`}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.payoutPreview}>
            {t('youReceive', language)}: {formatEURDecimal(operatorPayout)} · {t('payoutInfo', language)}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusRow}>
          <Badge label={booking.status} variant={booking.status} />
          <Badge label={booking.payment_status} variant={booking.payment_status === 'paid' ? 'success' : 'warning'} />
        </View>

        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>{t('opBkGuest', language)}</Text>
          <Text style={styles.guestName}>{booking.guest_name}</Text>
          {booking.guest_nationality && <Text style={styles.detail}>{t('opBkNationality', language)}: {booking.guest_nationality}</Text>}
          {booking.guest_email && <Text style={styles.detail}>{t('opBkEmail', language)}: {booking.guest_email}</Text>}
          {booking.driver_license_no && <Text style={styles.detail}>{t('opBkLicense', language)}: {booking.driver_license_no}</Text>}
          {booking.guest_phone && (
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => void Linking.openURL(`tel:${booking.guest_phone}`)}
              accessibilityLabel={`Call ${booking.guest_phone}`}
              accessibilityRole="button"
            >
              <Ionicons name="call-outline" size={16} color={C.primaryDark} importantForAccessibility="no" />
              <Text style={styles.callBtnText}>{`${t('opBkCall', language)} ${booking.guest_phone}`}</Text>
            </TouchableOpacity>
          )}
        </Card>

        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>{t('opBkRental', language)}</Text>
          <Text style={styles.detail}>{booking.listing?.title}</Text>
          <Text style={styles.detail}>{formatDateRange(booking.start_date, booking.end_date)}</Text>
          <Text style={styles.detail}>{booking.total_days} {t('days', language)}</Text>
          <Divider />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('total', language)}</Text>
            <Text style={styles.priceVal}>{formatEURDecimal(booking.total_amount)}</Text>
          </View>
        </Card>

        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>{t('opBkInspection', language)}</Text>
          <View style={styles.inspRow}>
            <Text style={styles.detail}>{t('opBkPickup', language)}</Text>
            <Badge label={booking.pickup_damage_done ? t('opBkDone', language) : t('pending', language)} variant={booking.pickup_damage_done ? 'success' : 'warning'} />
          </View>
          <Divider style={{ marginVertical: Spacing.sm }} />
          <View style={styles.inspRow}>
            <Text style={styles.detail}>{t('opBkReturn', language)}</Text>
            <Badge label={booking.return_damage_done ? t('opBkDone', language) : t('pending', language)} variant={booking.return_damage_done ? 'success' : 'warning'} />
          </View>

          {/* The operator damage review screen existed and was registered in
              the layout, but NOTHING in the app navigated to it — the only way
              in was a deep link. So the photos, mileage and signatures the
              renter captured were unreachable for the one person who needs
              them, and the deposit could never be charged against damage. */}
          {(booking.pickup_damage_done || booking.return_damage_done) && (
            <TouchableOpacity
              style={styles.inspectionLink}
              onPress={() => router.push(`/(operator)/damage/${booking.id}`)}
              accessibilityRole="button"
              accessibilityLabel={t('opBkInspection', language)}
            >
              <Ionicons name="images-outline" size={15} color={C.text} importantForAccessibility="no" />
              <Text style={styles.inspectionLinkText}>{t('opBkOpenInspection', language)}</Text>
              <Ionicons name="chevron-forward" size={15} color={C.textTertiary} importantForAccessibility="no" />
            </TouchableOpacity>
          )}

          {/* Same story as the consumer side: the operator signature screen was
              registered in the layout and reachable from nothing. Both parties
              could sign a rental contract only via a deep link neither of them
              had. */}
          {(booking.status === 'confirmed' || booking.status === 'active')
            && booking.contract_status !== 'fully_signed'
            && booking.contract_status !== 'operator_signed' && (
            <TouchableOpacity
              style={styles.inspectionLink}
              onPress={() => router.push(`/(operator)/bookings/sign/${booking.id}`)}
              accessibilityRole="button"
              accessibilityLabel={t('cbkSignAgreement', language)}
            >
              <Ionicons name="create-outline" size={15} color={C.text} importantForAccessibility="no" />
              <Text style={styles.inspectionLinkText}>{t('cbkSignAgreement', language)}</Text>
              <Ionicons name="chevron-forward" size={15} color={C.textTertiary} importantForAccessibility="no" />
            </TouchableOpacity>
          )}
        </Card>

        {/* Payout breakdown */}
        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>{t('opBkYourPayout', language)}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('opBkGuestPays', language)}</Text>
            <Text style={styles.priceVal}>{formatEURDecimal(booking.total_amount)}</Text>
          </View>
          <View style={[styles.priceRow, { marginTop: 4 }]}>
            <Text style={styles.detail}>{t('opBkPlatformFee', language)}</Text>
            <Text style={styles.detail}>–{formatEURDecimal(booking.total_amount - operatorPayout)}</Text>
          </View>
          <Divider style={{ marginVertical: Spacing.sm }} />
          <View style={styles.priceRow}>
            <Text style={styles.payoutLabel}>{t('youReceive', language)}</Text>
            <Text style={styles.payoutVal}>{formatEURDecimal(operatorPayout)}</Text>
          </View>
          <Text style={styles.payoutNote}>{t('opBkTransferNote', language)}</Text>
        </Card>

        {/* Flight info */}
        {booking.flight_number != null && (
          <View style={flightStyles.flightCard}>
            <View style={flightStyles.flightTitleRow}>
              <Ionicons name="airplane-outline" size={14} color={C.textSecondary} importantForAccessibility="no" />
              <Text style={flightStyles.flightTitle}>{t('opBkFlightInfo', language)}</Text>
            </View>
            <Text style={flightStyles.flightNum}>{booking.flight_number}</Text>
            {booking.flight_arrival_time != null && (
              <Text style={flightStyles.flightArrival}>
                {t('opBkArrival', language)}: {new Date(booking.flight_arrival_time).toLocaleTimeString()}
              </Text>
            )}
            <View style={[flightStyles.statusBadge, { backgroundColor: booking.flight_status === 'on_time' ? C.successSurface : C.warningSurface }]}>
              <Ionicons
                name={booking.flight_status === 'on_time' ? 'checkmark-circle' : booking.flight_status === 'delayed' ? 'warning-outline' : 'hourglass-outline'}
                size={13}
                color={booking.flight_status === 'on_time' ? C.success : C.warning}
                importantForAccessibility="no"
              />
              <Text style={[flightStyles.statusText, { color: booking.flight_status === 'on_time' ? C.success : C.warning }]}>
                {booking.flight_status === 'on_time' ? t('opBkOnTime', language) : booking.flight_status === 'delayed' ? t('opBkDelayed', language) : t('opBkTracking', language)}
              </Text>
            </View>
          </View>
        )}

        {/* Message Guest */}
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={() => router.push(`/(operator)/bookings/chat/${booking.id}`)}
          accessibilityLabel="Message guest"
          accessibilityRole="button"
        >
          {/* Secondary action, not the screen's primary CTA → ink. */}
          <Ionicons name="chatbubble-outline" size={16} color={C.text} />
          <Text style={styles.messageBtnText}>{t('opBkMessageGuest', language)}</Text>
        </TouchableOpacity>

        {(booking.status === 'completed' || booking.status === 'active') && (
          <TouchableOpacity
            style={styles.disputeBtn}
            onPress={() => router.push(`/(operator)/bookings/dispute/${booking.id}` as Parameters<typeof router.push>[0])}
            accessibilityLabel="Open a dispute"
            accessibilityRole="button"
          >
            <Ionicons name="warning-outline" size={15} color={C.warning} importantForAccessibility="no" />
            <Text style={styles.disputeBtnText}>{t('opBkOpenDispute', language)}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actions}>
          {booking.status === 'confirmed' && (
            <Button
              title={t('opBkMarkActive', language)}
              onPress={() => void handleStatusChange('active')}
              loading={statusChanging}
              fullWidth
            />
          )}
          {booking.status === 'active' && (
            <Button
              title={t('opBkMarkCompleted', language)}
              onPress={() => void handleStatusChange('completed')}
              loading={statusChanging}
              fullWidth
            />
          )}
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={showDeclineSheet}
        title={t('opBkDeclineTitle', language)}
        message={t('opBkDeclineMsg', language)}
        confirmLabel={t('declineBooking', language)}
        onConfirm={() => { setShowDeclineSheet(false); void handleDecline() }}
        onCancel={() => setShowDeclineSheet(false)}
      />
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  statusRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, marginBottom: Spacing.base },
  sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: C.textTertiary, marginBottom: Spacing.sm },
  guestName: { fontSize: 18, fontFamily: Fonts.bold, color: C.text, marginBottom: Spacing.sm },
  detail: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, marginBottom: 4 },
  callBtn: { backgroundColor: C.primarySurface, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, minHeight: 44 },
  callBtnText: { fontSize: 14, color: C.primaryDark, fontFamily: Fonts.semibold },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary },
  priceVal: { fontSize: 18, fontFamily: Fonts.bold, color: C.text },
  payoutLabel: { fontSize: 15, fontFamily: Fonts.bold, color: C.text },
  payoutVal: { fontSize: 20, fontFamily: Fonts.extrabold, color: C.success },
  payoutNote: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, marginTop: 4 },
  inspRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inspectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.base,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: C.border,
    minHeight: 44,
  },
  inspectionLinkText: { flex: 1, fontSize: 14, fontFamily: Fonts.semibold, color: C.text },
  actions: { marginTop: Spacing.md },

  // Action banner (always first visible for pending bookings)
  actionBanner: {
    backgroundColor: C.successSurface,
    borderBottomWidth: 1,
    borderBottomColor: C.success,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionTitle: { fontSize: 16, fontFamily: Fonts.extrabold, color: C.success },
  actionSubtitle: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary },
  actionButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  declineBtn: {
    paddingHorizontal: Spacing.xl, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1, borderColor: C.error,
    minHeight: 44,
  },
  declineBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: C.error },
  confirmBtn: {
    flex: 1, backgroundColor: C.success,
    borderRadius: Radius.lg, paddingVertical: Spacing.md,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 44,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 16, fontFamily: Fonts.extrabold, color: C.white },
  payoutPreview: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary, textAlign: 'center' },

  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    // Secondary outline button — neutral, so it cannot compete with the
    // Confirm CTA above it. borderStrong clears the 3:1 UI-boundary rule.
    borderWidth: 1.5, borderColor: C.borderStrong,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg, padding: Spacing.md,
    marginTop: Spacing.sm, marginBottom: Spacing.sm,
    justifyContent: 'center',
    minHeight: 44,
  },
  messageBtnText: { fontSize: 15, color: C.text, fontFamily: Fonts.semibold },
  disputeBtn: {
    borderWidth: 1,
    borderColor: C.warning,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
    minHeight: 44,
  },
  disputeBtnText: { fontSize: 14, color: C.warning, fontFamily: Fonts.semibold },
  })

  const flightStyles = StyleSheet.create({
  flightCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  flightTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  flightTitle: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.semibold,
  },
  flightNum: {
    color: C.text,
    fontSize: 22,
    fontFamily: Fonts.extrabold,
    marginBottom: 4,
  },
  flightArrival: {
    color: C.textSecondary,
    fontFamily: Fonts.regular, fontSize: 14,
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusText: {
    fontSize: 13,
    fontFamily: Fonts.semibold,
  },
  })
  return { styles, flightStyles }
}
