import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Divider } from '@/components/ui/Divider'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDate, formatDateRange, isDateToday } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { calculateCancellationRefund, getCancellationPolicyEmoji, getCancellationPolicyLabel } from '@/lib/utils/cancellation'
import { useBooking } from '@/lib/hooks/useBookings'
import { updateBookingStatus } from '@/lib/api/bookings'
import { Config } from '@/constants/config'
import { MOCK_REVIEWS } from '@/lib/mockData'
import type { BookingStatus, CancellationPolicy } from '@/types'

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Awaiting confirmation',
  confirmed: 'Booking confirmed ✓',
  active: 'Rental in progress',
  completed: 'Completed ✓',
  cancelled: 'Cancelled ✗',
  disputed: 'Disputed',
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: Colors.warning,
  confirmed: Colors.success,
  active: Colors.primary,
  completed: Colors.textSecondary,
  cancelled: Colors.error,
  disputed: Colors.error,
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const bookingId = Config.useMock ? (id ?? 'bk-001') : (id ?? '')
  const { booking, loading, error } = useBooking(bookingId)
  const [showCancelSheet, setShowCancelSheet] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  if (loading) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>
  if (error || !booking) return <ErrorState message={error ?? 'Booking not found'} />

  const pickupToday = isDateToday(booking.start_date)
  const returnToday = isDateToday(booking.end_date)
  const policy = (booking.listing?.cancellation_policy ?? 'moderate') as CancellationPolicy

  const refundCalc = ['confirmed', 'pending'].includes(booking.status)
    ? calculateCancellationRefund(policy, booking.start_date, booking.total_amount)
    : null

  const hasReview = Config.useMock
    ? MOCK_REVIEWS.some(r => r.booking_id === booking.id)
    : false

  const handleCancel = async () => {
    setCancelling(true)
    try {
      if (!Config.useMock) {
        await updateBookingStatus(booking.id, 'cancelled')
      }
      setShowCancelSheet(false)
      Alert.alert('Cancelled', 'Your booking has been cancelled.')
      router.back()
    } catch {
      Alert.alert('Error', 'Failed to cancel booking. Please try again.')
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
          <Text style={styles.sectionTitle}>Price</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total paid</Text>
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
          <Text style={styles.sectionTitle}>Insurance</Text>
          <View style={styles.insuranceRow}>
            <Text style={styles.insuranceIcon}>🛡️</Text>
            <Text style={styles.insuranceText}>Basic rental insurance included · TPL up to €500,000 · Excess €500</Text>
          </View>
        </Card>

        {/* Cancellation Policy */}
        {refundCalc && (
          <Card style={{ marginBottom: Spacing.base }}>
            <Text style={styles.sectionTitle}>Cancellation Policy</Text>
            <Text style={styles.policyLabel}>
              {getCancellationPolicyEmoji(policy)} {getCancellationPolicyLabel(policy)}
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
          <Text style={styles.sectionTitle}>Inspection</Text>
          <View style={styles.inspectionRow}>
            <Text style={styles.inspLabel}>Pickup</Text>
            <Badge
              label={booking.pickup_damage_done ? 'Done' : 'Pending'}
              variant={booking.pickup_damage_done ? 'success' : 'warning'}
            />
          </View>
          <Divider style={{ marginVertical: Spacing.sm }} />
          <View style={styles.inspectionRow}>
            <Text style={styles.inspLabel}>Return</Text>
            <Badge
              label={booking.return_damage_done ? 'Done' : 'Pending'}
              variant={booking.return_damage_done ? 'success' : 'warning'}
            />
          </View>
        </Card>

        {booking.operator?.phone && (
          <Card style={{ marginBottom: Spacing.base }}>
            <Text style={styles.sectionTitle}>Contact operator</Text>
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
            title="Start pickup inspection →"
            onPress={() => router.push(`/(consumer)/damage/pickup/${booking.id}`)}
            fullWidth
            style={{ marginBottom: Spacing.md }}
          />
        )}

        {booking.status === 'active' && returnToday && !booking.return_damage_done && (
          <Button
            title="Start return inspection →"
            onPress={() => router.push(`/(consumer)/damage/return/${booking.id}`)}
            fullWidth
            style={{ marginBottom: Spacing.md }}
          />
        )}

        {/* Message operator */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push(`/(consumer)/bookings/chat/${booking.id}`)}
        >
          <Text style={styles.actionBtnText}>💬 Message Operator</Text>
        </TouchableOpacity>

        {/* Leave review */}
        {booking.status === 'completed' && !hasReview && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnGold]}
            onPress={() => router.push(`/(consumer)/bookings/review/${booking.id}`)}
          >
            <Text style={[styles.actionBtnText, { color: Colors.primaryDark }]}>⭐ Leave a Review</Text>
          </TouchableOpacity>
        )}

        {/* Cancel */}
        {['confirmed', 'pending'].includes(booking.status) && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => setShowCancelSheet(true)}
          >
            <Text style={[styles.actionBtnText, { color: Colors.error }]}>✕ Cancel Booking</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      {/* Cancel confirmation modal */}
      <Modal transparent visible={showCancelSheet} animationType="slide" onRequestClose={() => setShowCancelSheet(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowCancelSheet(false)} />
        <View style={styles.cancelSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.cancelSheetTitle}>Cancel this booking?</Text>
          {refundCalc && (
            <View style={styles.refundBox}>
              <Text style={styles.refundBoxTitle}>
                {getCancellationPolicyEmoji(policy)} {getCancellationPolicyLabel(policy)}
              </Text>
              <Text style={styles.refundBoxAmount}>
                You will receive <Text style={{ fontWeight: '800', color: Colors.success }}>{formatEURDecimal(refundCalc.refundAmount)}</Text> back
              </Text>
              <Text style={styles.refundBoxNote}>{refundCalc.message}</Text>
            </View>
          )}
          <Button
            title={cancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
            onPress={handleCancel}
            style={{ marginBottom: Spacing.md }}
            fullWidth
          />
          <TouchableOpacity onPress={() => setShowCancelSheet(false)} style={styles.keepBtn}>
            <Text style={styles.keepBtnText}>Keep Booking</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  statusBanner: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.base,
    alignItems: 'center',
  },
  statusText: { fontSize: 15, fontWeight: '700' },
  vehicleTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  operatorName: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  dates: { fontSize: 13, color: Colors.textTertiary },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  priceLabel: { fontSize: 14, color: Colors.textSecondary },
  priceValue: { fontSize: 16, fontWeight: '700', color: Colors.text },
  depositInfo: { fontSize: 12, color: Colors.info, marginTop: Spacing.sm },
  insuranceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  insuranceIcon: { fontSize: 18 },
  insuranceText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  policyLabel: { fontSize: 14, color: Colors.text, fontWeight: '600', marginBottom: Spacing.xs },
  refundNote: { fontSize: 14, color: Colors.textSecondary },
  refundMessage: { fontSize: 12, color: Colors.textTertiary, marginTop: 4, lineHeight: 18 },
  inspectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inspLabel: { fontSize: 14, color: Colors.textSecondary },
  phoneBtn: { backgroundColor: Colors.primarySurface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center' },
  phoneBtnText: { fontSize: 15, color: Colors.primaryDark, fontWeight: '600' },
  actionBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  actionBtnGold: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  actionBtnDanger: { borderColor: Colors.error + '44', backgroundColor: Colors.errorSurface },
  actionBtnText: { fontSize: 15, color: Colors.text, fontWeight: '600' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  cancelSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  cancelSheetTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: Spacing.xl, textAlign: 'center' },
  refundBox: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
  },
  refundBoxTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  refundBoxAmount: { fontSize: 16, color: Colors.textSecondary, marginBottom: Spacing.xs },
  refundBoxNote: { fontSize: 12, color: Colors.textTertiary, lineHeight: 18 },
  keepBtn: { alignItems: 'center', padding: Spacing.md },
  keepBtnText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
})
