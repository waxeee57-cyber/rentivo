import React, { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Colors, Spacing, Radius } from '@/constants/colors'
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
import { updateBookingStatus } from '@/lib/api/bookings'
import { useToastStore } from '@/lib/store/useToastStore'
import { Config } from '@/constants/config'
import type { BookingStatus } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

export default function OperatorBookingDetailScreen() {
  const C = useColors()
  const { styles, flightStyles } = useMemo(() => makeStyles(C), [C])
  const { id } = useLocalSearchParams<{ id: string }>()
  const bookingId = Config.useMock ? (id ?? 'bk-001') : (id ?? '')
  const { booking, loading, error } = useBooking(bookingId)
  const { showToast } = useToastStore()
  const [confirming, setConfirming] = useState(false)
  const [showDeclineSheet, setShowDeclineSheet] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)

  if (loading) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>
  if (error || !booking) return <ErrorState message={error ?? 'Not found'} />

  const handleConfirm = async () => {
    setConfirming(true)
    setStatusChanging(true)
    try {
      await updateBookingStatus(booking.id, 'confirmed')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: '✓ Booking confirmed! Guest will be notified.', type: 'success' })
    } catch {
      showToast({ message: 'Failed to confirm booking', type: 'error' })
    } finally {
      setConfirming(false)
      setStatusChanging(false)
    }
  }

  const handleDecline = async () => {
    setStatusChanging(true)
    try {
      await updateBookingStatus(booking.id, 'cancelled')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      showToast({ message: 'Booking declined', type: 'error' })
      router.back()
    } catch {
      showToast({ message: 'Failed to decline booking', type: 'error' })
    } finally {
      setStatusChanging(false)
    }
  }

  const handleStatusChange = async (status: BookingStatus) => {
    setStatusChanging(true)
    try {
      await updateBookingStatus(booking.id, status)
      showToast({ message: `Booking marked as ${status}`, type: 'success' })
    } catch {
      showToast({ message: 'Failed to update status', type: 'error' })
    } finally {
      setStatusChanging(false)
    }
  }

  // Payout = 97.5% after 2.5% platform fee; operator net = ~92% after Stripe
  const operatorPayout = Math.round(booking.total_amount * 0.975)
  const operatorNet = Math.round(booking.total_amount * 0.92)

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={`#${booking.id.slice(0, 8).toUpperCase()}`}
        subtitle={booking.listing?.title}
      />

      {/* FIRST THING VISIBLE: prominent confirm banner for pending */}
      {booking.status === 'pending' && (
        <View style={styles.actionBanner}>
          <Text style={styles.actionTitle}>📅 New booking request</Text>
          <Text style={styles.actionSubtitle}>Respond within 24 hours</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => setShowDeclineSheet(true)}
              disabled={statusChanging}
              accessibilityLabel="Decline booking"
              accessibilityRole="button"
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (confirming || statusChanging) && styles.confirmBtnDisabled]}
              onPress={() => void handleConfirm()}
              disabled={confirming || statusChanging}
              accessibilityLabel="Confirm booking"
              accessibilityRole="button"
            >
              <Text style={styles.confirmBtnText}>
                {confirming ? 'Confirming...' : '✓ Confirm booking'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.payoutPreview}>
            You receive: {formatEURDecimal(operatorPayout)} · 2 business days after pickup
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusRow}>
          <Badge label={booking.status} variant={booking.status} />
          <Badge label={booking.payment_status} variant={booking.payment_status === 'paid' ? 'success' : 'warning'} />
        </View>

        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>Guest</Text>
          <Text style={styles.guestName}>{booking.guest_name}</Text>
          {booking.guest_nationality && <Text style={styles.detail}>Nationality: {booking.guest_nationality}</Text>}
          {booking.guest_email && <Text style={styles.detail}>Email: {booking.guest_email}</Text>}
          {booking.driver_license_no && <Text style={styles.detail}>License: {booking.driver_license_no}</Text>}
          {booking.guest_phone && (
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => void Linking.openURL(`tel:${booking.guest_phone}`)}
              accessibilityLabel={`Call ${booking.guest_phone}`}
              accessibilityRole="button"
            >
              <Text style={styles.callBtnText}>📞 Call {booking.guest_phone}</Text>
            </TouchableOpacity>
          )}
        </Card>

        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>Rental</Text>
          <Text style={styles.detail}>{booking.listing?.title}</Text>
          <Text style={styles.detail}>{formatDateRange(booking.start_date, booking.end_date)}</Text>
          <Text style={styles.detail}>{booking.total_days} days</Text>
          <Divider />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total</Text>
            <Text style={styles.priceVal}>{formatEURDecimal(booking.total_amount)}</Text>
          </View>
        </Card>

        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>Inspection</Text>
          <View style={styles.inspRow}>
            <Text style={styles.detail}>Pickup</Text>
            <Badge label={booking.pickup_damage_done ? 'Done' : 'Pending'} variant={booking.pickup_damage_done ? 'success' : 'warning'} />
          </View>
          <Divider style={{ marginVertical: Spacing.sm }} />
          <View style={styles.inspRow}>
            <Text style={styles.detail}>Return</Text>
            <Badge label={booking.return_damage_done ? 'Done' : 'Pending'} variant={booking.return_damage_done ? 'success' : 'warning'} />
          </View>
        </Card>

        {/* Payout breakdown */}
        <Card style={{ marginBottom: Spacing.base }}>
          <Text style={styles.sectionTitle}>Your payout</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Guest pays</Text>
            <Text style={styles.priceVal}>{formatEURDecimal(booking.total_amount)}</Text>
          </View>
          <View style={[styles.priceRow, { marginTop: 4 }]}>
            <Text style={styles.detail}>Platform fee (2.5%)</Text>
            <Text style={styles.detail}>–{formatEURDecimal(booking.total_amount - operatorPayout)}</Text>
          </View>
          <Divider style={{ marginVertical: Spacing.sm }} />
          <View style={styles.priceRow}>
            <Text style={styles.payoutLabel}>You receive</Text>
            <Text style={styles.payoutVal}>{formatEURDecimal(operatorPayout)}</Text>
          </View>
          <Text style={styles.payoutNote}>Transfer: 2 business days after pickup</Text>
        </Card>

        {/* Flight info */}
        {booking.flight_number != null && (
          <View style={flightStyles.flightCard}>
            <Text style={flightStyles.flightTitle}>✈️ Flight Info</Text>
            <Text style={flightStyles.flightNum}>{booking.flight_number}</Text>
            {booking.flight_arrival_time != null && (
              <Text style={flightStyles.flightArrival}>
                Arrival: {new Date(booking.flight_arrival_time).toLocaleTimeString()}
              </Text>
            )}
            <View style={[flightStyles.statusBadge, { backgroundColor: booking.flight_status === 'on_time' ? C.successSurface : C.warningSurface }]}>
              <Text style={[flightStyles.statusText, { color: booking.flight_status === 'on_time' ? C.success : C.warning }]}>
                {booking.flight_status === 'on_time' ? '✅ On Time' : booking.flight_status === 'delayed' ? '⚠️ Delayed' : '⏳ Tracking...'}
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
          <Ionicons name="chatbubble-outline" size={16} color={C.primary} />
          <Text style={styles.messageBtnText}>💬 Message Guest</Text>
        </TouchableOpacity>

        {(booking.status === 'completed' || booking.status === 'active') && (
          <TouchableOpacity
            style={styles.disputeBtn}
            onPress={() => router.push(`/(operator)/bookings/dispute/${booking.id}` as Parameters<typeof router.push>[0])}
            accessibilityLabel="Open a dispute"
            accessibilityRole="button"
          >
            <Text style={styles.disputeBtnText}>⚠️ Open a Dispute</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actions}>
          {booking.status === 'confirmed' && (
            <Button
              title="Mark as active (guest picked up)"
              onPress={() => void handleStatusChange('active')}
              loading={statusChanging}
              fullWidth
            />
          )}
          {booking.status === 'active' && (
            <Button
              title="Complete rental (returned)"
              onPress={() => void handleStatusChange('completed')}
              loading={statusChanging}
              fullWidth
            />
          )}
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={showDeclineSheet}
        title="Decline this booking?"
        message="The guest will be notified and any payment will be refunded."
        confirmLabel="Decline"
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
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: C.textTertiary, marginBottom: Spacing.sm },
  guestName: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: Spacing.sm },
  detail: { fontSize: 14, color: C.textSecondary, marginBottom: 4 },
  callBtn: { backgroundColor: C.primarySurface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, minHeight: 44 },
  callBtnText: { fontSize: 14, color: C.primaryDark, fontWeight: '600' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 14, color: C.textSecondary },
  priceVal: { fontSize: 18, fontWeight: '700', color: C.text },
  payoutLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  payoutVal: { fontSize: 20, fontWeight: '800', color: C.success },
  payoutNote: { fontSize: 12, color: C.textTertiary, marginTop: 4 },
  inspRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { marginTop: Spacing.md },

  // Action banner (always first visible for pending bookings)
  actionBanner: {
    backgroundColor: C.successSurface,
    borderBottomWidth: 1,
    borderBottomColor: C.success,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  actionTitle: { fontSize: 16, fontWeight: '800', color: C.success },
  actionSubtitle: { fontSize: 13, color: C.textSecondary },
  actionButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  declineBtn: {
    paddingHorizontal: Spacing.xl, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1, borderColor: C.error,
    minHeight: 44,
  },
  declineBtnText: { fontSize: 14, fontWeight: '700', color: C.error },
  confirmBtn: {
    flex: 1, backgroundColor: C.success,
    borderRadius: Radius.lg, paddingVertical: Spacing.md,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 44,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 16, fontWeight: '800', color: C.white },
  payoutPreview: { fontSize: 12, color: C.textSecondary, textAlign: 'center' },

  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1.5, borderColor: C.primary,
    backgroundColor: C.primarySurface,
    borderRadius: Radius.lg, padding: Spacing.md,
    marginTop: Spacing.sm, marginBottom: Spacing.sm,
    justifyContent: 'center',
    minHeight: 44,
  },
  messageBtnText: { fontSize: 15, color: C.primaryDark, fontWeight: '600' },
  disputeBtn: {
    borderWidth: 1,
    borderColor: C.warning,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
    minHeight: 44,
  },
  disputeBtnText: { fontSize: 14, color: C.warning, fontWeight: '600' },
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
  flightTitle: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  flightNum: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  flightArrival: {
    color: C.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  })
  return { styles, flightStyles }
}
