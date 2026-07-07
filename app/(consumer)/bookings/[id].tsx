import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Spacing, Radius } from '@/constants/colors'
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
import { calculateCancellationRefund, getCancellationPolicyEmoji, getCancellationPolicyLabel } from '@/lib/utils/cancellation'
import { useBooking } from '@/lib/hooks/useBookings'
import { updateBookingStatus } from '@/lib/api/bookings'
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
  const { showToast } = useToastStore()

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
      .then(({ data }) => setHasReview(!!data))
  }, [booking?.id])

  if (loading) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>
  if (error || !booking) return <ErrorState message={error ?? t('hostBBookingNotFound', language)} onRetry={refetch} />

  const pickupToday = isDateToday(booking.start_date)
  const returnToday = isDateToday(booking.end_date)
  const policy = (booking.listing?.cancellation_policy ?? 'moderate') as CancellationPolicy

  const refundCalc = ['confirmed', 'pending'].includes(booking.status)
    ? calculateCancellationRefund(policy, booking.start_date, booking.total_amount, language)
    : null

  const handleCancel = async () => {
    setCancelling(true)
    try {
      if (!Config.useMock) {
        await updateBookingStatus(booking.id, 'cancelled')
      }
      setShowCancelSheet(false)
      showToast({ message: t('cbkBookingCancelled', language), type: 'info' })
      router.back()
    } catch {
      showToast({ message: getError('booking_failed'), type: 'error' })
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
            <Text style={styles.depositInfo}>
              🔒 {formatEURDecimal(booking.deposit_amount)} deposit hold active
            </Text>
          )}
        </Card>

        {/* Insurance */}
        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>{t('insurance', language)}</Text>
          <View style={styles.insuranceRow}>
            <Text style={styles.insuranceIcon}>🛡️</Text>
            <Text style={styles.insuranceText}>{t('cbkInsuranceDesc', language)}</Text>
          </View>
        </Card>

        {/* Cancellation Policy */}
        {refundCalc && (
          <Card style={{ marginBottom: Spacing.base }}>
            <Text style={styles.sectionTitle}>{t('cancellationPolicy', language)}</Text>
            <Text style={styles.policyLabel}>
              {getCancellationPolicyEmoji(policy)} {getCancellationPolicyLabel(policy, language)}
            </Text>
            <Divider style={{ marginVertical: Spacing.sm }} />
            <Text style={styles.refundNote}>
              If you cancel now: <Text style={{ fontWeight: '700' }}>{refundCalc.refundPercent}% refund</Text>
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
              <Text style={styles.phoneBtnText}>📞 {booking.operator.phone}</Text>
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
          <Text style={styles.actionBtnText}>{t('cbkViewContractBtn', language)}</Text>
        </TouchableOpacity>

        {/* Message operator */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push(`/(consumer)/bookings/chat/${booking.id}`)}
          accessibilityLabel={t('messageOperator', language)}
          accessibilityRole="button"
        >
          <Text style={styles.actionBtnText}>{t('cbkMessageOperatorBtn', language)}</Text>
        </TouchableOpacity>

        {(booking.status === 'completed' || booking.status === 'active') && (
          <TouchableOpacity
            style={styles.disputeBtn}
            onPress={() => router.push(`/(consumer)/bookings/dispute/${booking.id}` as Parameters<typeof router.push>[0])}
            accessibilityLabel={t('cbkOpenDispute', language)}
            accessibilityRole="button"
          >
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
          { label: t('cbkPolicy', language), value: `${getCancellationPolicyEmoji(policy)} ${getCancellationPolicyLabel(policy, language)}` },
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
  statusText: { fontSize: 15, fontWeight: '700' },
  vehicleTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 4 },
  operatorName: { fontSize: 15, color: C.text, fontWeight: '500', marginBottom: 4 },
  dates: { fontSize: 15, color: C.text },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  priceLabel: { fontSize: 14, color: C.textSecondary },
  priceValue: { fontSize: 16, fontWeight: '700', color: C.text },
  depositInfo: { fontSize: 12, color: C.info, marginTop: Spacing.sm },
  insuranceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  insuranceIcon: { fontSize: 18 },
  insuranceText: { flex: 1, fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  policyLabel: { fontSize: 14, color: C.text, fontWeight: '600', marginBottom: Spacing.xs },
  refundNote: { fontSize: 14, color: C.textSecondary },
  refundMessage: { fontSize: 12, color: C.textTertiary, marginTop: 4, lineHeight: 18 },
  inspectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inspLabel: { fontSize: 14, color: C.textSecondary },
  phoneBtn: { backgroundColor: C.primarySurface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  phoneBtnText: { fontSize: 15, color: C.primaryDark, fontWeight: '600' },
  actionBtn: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    backgroundColor: C.surface,
    minHeight: 44,
  },
  actionBtnGold: { borderColor: C.primary, backgroundColor: C.primarySurface },
  actionBtnDanger: { borderColor: C.error + '44', backgroundColor: C.errorSurface },
  actionBtnText: { fontSize: 15, color: C.text, fontWeight: '600' },
  disputeBtn: {
    borderWidth: 1,
    borderColor: C.warning,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
    minHeight: 44,
  },
  disputeBtnText: { fontSize: 14, color: C.warning, fontWeight: '600' },
  })
}
