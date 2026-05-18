import React, { useEffect, useRef, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { MOCK_BOOKINGS } from '@/lib/mockData'
import { Config } from '@/constants/config'
import { useBooking } from '@/lib/hooks/useBookings'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { useColors } from '@/lib/hooks/useColors'

function BookingDetailSkeleton() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const opacity = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.8, duration: 1000, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
    ])).start()
  }, [opacity])
  return (
    <SafeAreaView style={styles.container}>
      <View style={{ padding: Spacing.base, paddingTop: Spacing.xl }}>
        <Animated.View style={[{ height: 28, width: '50%', backgroundColor: C.surface, borderRadius: Radius.md, marginBottom: Spacing.xl }, { opacity }]} />
        <Animated.View style={[{ height: 120, backgroundColor: C.surface, borderRadius: Radius.xl, marginBottom: Spacing.md }, { opacity }]} />
        <Animated.View style={[{ height: 80, backgroundColor: C.surface, borderRadius: Radius.xl, marginBottom: Spacing.md }, { opacity }]} />
        <Animated.View style={[{ height: 80, backgroundColor: C.surface, borderRadius: Radius.xl, marginBottom: Spacing.md }, { opacity }]} />
      </View>
    </SafeAreaView>
  )
}

export default function HostBookingDetailScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { id } = useLocalSearchParams<{ id: string }>()
  const { booking: liveBooking, loading } = useBooking(Config.useMock ? null : (id ?? null))
  const booking = Config.useMock
    ? MOCK_BOOKINGS.find(b => b.id === id) ?? MOCK_BOOKINGS[0]
    : liveBooking

  if (loading) {
    return <BookingDetailSkeleton />
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.textSecondary }}>Booking not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  const earnings = Math.round(booking.total_amount * 0.975)
  const payoutDate = new Date(booking.end_date)
  payoutDate.setDate(payoutDate.getDate() + 1)

  const handleConfirm = () => {
    Alert.alert('Booking confirmed', 'The guest has been notified.')
    router.back()
  }

  const handleDecline = () => {
    Alert.alert('Decline booking?', 'The guest will be refunded.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => router.back() },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking details</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Prominent confirm banner for pending bookings */}
      {booking.status === 'pending' && (
        <View style={styles.confirmBanner}>
          <Text style={styles.confirmBannerLabel}>⏳ New booking — confirm to accept</Text>
          <View style={styles.confirmBannerRow}>
            <TouchableOpacity style={styles.confirmBigBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBigBtnText}>✓ Confirm booking</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineSmallBtn} onPress={handleDecline}>
              <Text style={styles.declineSmallBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.confirmBannerPayout}>
            You receive: {formatEURDecimal(earnings)} · 24h after pickup
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Guest card */}
        <View style={styles.guestCard}>
          <View style={styles.guestAvatar}>
            <Text style={styles.guestAvatarText}>{booking.guest_name[0]}</Text>
          </View>
          <View style={styles.guestInfo}>
            <View style={styles.guestNameRow}>
              <Text style={styles.guestName}>{booking.guest_name}</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
              </View>
            </View>
            <Text style={styles.guestMeta}>
              {booking.guest_nationality ?? 'Guest'} · 4 previous rentals
            </Text>
            <Text style={styles.guestMeta}>Member since Jan 2024</Text>
          </View>
        </View>

        {/* Booking details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking details</Text>
          <View style={styles.detailCard}>
            <Row label="Vehicle" value={booking.listing?.title ?? '—'} />
            <Row label="Check-in" value={booking.start_date} />
            <Row label="Check-out" value={booking.end_date} />
            <Row label="Duration" value={`${booking.total_days} days`} />
            {booking.pickup_time && <Row label="Pickup time" value={booking.pickup_time} />}
            {booking.pickup_location && <Row label="Pickup location" value={booking.pickup_location} />}
          </View>
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.detailCard}>
            <Row label="Total charge" value={formatEURDecimal(booking.total_amount)} />
            <Row label="Rentivo fee (2.5%)" value={`-${formatEURDecimal(booking.total_amount - earnings)}`} />
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>Your earnings</Text>
              <Text style={styles.earningsValue}>{formatEURDecimal(earnings)}</Text>
            </View>
            <Row label="Payout date" value={payoutDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })} />
          </View>
        </View>

        {/* Inspection status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inspection</Text>
          <View style={styles.detailCard}>
            <Row
              label="Pickup inspection"
              value={booking.pickup_damage_done ? '✅ Done' : '⏳ Pending'}
            />
            <Row
              label="Return inspection"
              value={booking.return_damage_done ? '✅ Done' : '⏳ Pending'}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={() => router.push(`/(consumer)/bookings/chat/${booking.id}`)}
          >
            <Ionicons name="chatbubble-outline" size={18} color={C.primary} />
            <Text style={styles.messageBtnText}>Message guest</Text>
          </TouchableOpacity>

          {booking.status === 'pending' && (
            <View style={styles.pendingActions}>
              <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                <Text style={styles.confirmBtnText}>Confirm booking</Text>
              </TouchableOpacity>
            </View>
          )}

          {booking.status === 'confirmed' && (
            <TouchableOpacity
              style={styles.inspectionBtn}
              onPress={() => router.push(`/(consumer)/damage/pickup/${booking.id}`)}
            >
              <Text style={styles.inspectionBtnText}>🔍 Start pickup inspection</Text>
            </TouchableOpacity>
          )}

          {booking.status === 'active' && (
            <TouchableOpacity
              style={styles.inspectionBtn}
              onPress={() => router.push(`/(consumer)/damage/return/${booking.id}`)}
            >
              <Text style={styles.inspectionBtnText}>🏁 Complete rental</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  guestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: C.border,
  },
  guestAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestAvatarText: { fontSize: 22, fontWeight: '700', color: C.primary },
  guestInfo: { flex: 1 },
  guestNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  guestName: { fontSize: 16, fontWeight: '700', color: C.text },
  verifiedBadge: {
    backgroundColor: C.successSurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  verifiedBadgeText: { fontSize: 11, fontWeight: '700', color: C.success },
  guestMeta: { fontSize: 13, color: C.textSecondary, marginBottom: 2 },

  section: { marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  detailCard: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: C.textSecondary },
  rowValue: { fontSize: 14, color: C.text, fontWeight: '500' },

  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  earningsLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  earningsValue: { fontSize: 18, fontWeight: '800', color: C.primary },

  actionsSection: { gap: Spacing.sm },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: C.primarySurface,
  },
  messageBtnText: { fontSize: 15, fontWeight: '700', color: C.primary },

  pendingActions: { flexDirection: 'row', gap: Spacing.sm },
  declineBtn: {
    flex: 1,
    padding: Spacing.base,
    borderRadius: Radius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.error,
    backgroundColor: C.errorSurface,
  },
  declineBtnText: { fontSize: 15, fontWeight: '700', color: C.error },
  confirmBtn: {
    flex: 2,
    padding: Spacing.base,
    borderRadius: Radius.xl,
    alignItems: 'center',
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: C.textInverse },

  inspectionBtn: {
    padding: Spacing.base,
    borderRadius: Radius.xl,
    alignItems: 'center',
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  inspectionBtnText: { fontSize: 15, fontWeight: '700', color: C.textInverse },
  confirmBanner: {
    backgroundColor: C.successSurface,
    borderBottomWidth: 1,
    borderBottomColor: C.success,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  confirmBannerLabel: { fontSize: 14, fontWeight: '700', color: C.success },
  confirmBannerRow: { flexDirection: 'row', gap: Spacing.sm },
  confirmBigBtn: {
    flex: 1,
    backgroundColor: C.success,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  confirmBigBtnText: { fontSize: 16, fontWeight: '800', color: C.white },
  declineSmallBtn: {
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.error,
  },
  declineSmallBtnText: { fontSize: 14, fontWeight: '700', color: C.error },
  confirmBannerPayout: { fontSize: 12, color: C.textSecondary, textAlign: 'center' },
  })
}
