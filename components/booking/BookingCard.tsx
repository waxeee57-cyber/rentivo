import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { differenceInDays, parseISO } from 'date-fns'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { formatDateRange } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import type { Booking } from '@/types'

interface BookingCardProps {
  booking: Booking
  onPress: () => void
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: '#EAF7F1', text: '#2D9B6F', label: 'Confirmed' },
  pending:   { bg: '#FFF9E6', text: '#C47D0A', label: 'Pending' },
  active:    { bg: Colors.primary, text: '#FFFFFF', label: 'Active' },
  completed: { bg: '#F0F0F0', text: '#888888', label: 'Completed' },
  cancelled: { bg: '#FDEEEE', text: '#E05252', label: 'Cancelled' },
}

export function BookingCard({ booking, onPress }: BookingCardProps) {
  const statusStyle = STATUS_STYLE[booking.status] ?? STATUS_STYLE.pending

  const daysUntil = booking.status === 'confirmed' || booking.status === 'pending'
    ? differenceInDays(parseISO(booking.start_date), new Date())
    : null

  const isActive = booking.status === 'active'

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <Image
        source={{ uri: booking.listing?.cover_image_url ?? undefined }}
        style={styles.image}
        contentFit="cover"
        placeholder="https://via.placeholder.com/100x70/F5F3EF"
      />
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>{booking.listing?.title ?? 'Vehicle'}</Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            {isActive && <View style={styles.activeDot} />}
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
          </View>
        </View>

        <Text style={styles.dates}>{formatDateRange(booking.start_date, booking.end_date)}</Text>
        <Text style={styles.operator} numberOfLines={1}>{booking.operator?.name}</Text>

        {daysUntil !== null && daysUntil >= 0 && (
          <Text style={styles.countdown}>
            {daysUntil === 0 ? 'Starts today' : `Starts in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`}
          </Text>
        )}

        <View style={styles.bottom}>
          <Text style={styles.total}>{formatEURDecimal(booking.total_amount)}</Text>
          {isActive && (
            <TouchableOpacity
              style={styles.inspectBtn}
              onPress={() => router.push(`/(consumer)/damage/pickup/${booking.id}`)}
            >
              <Text style={styles.inspectBtnText}>Start inspection →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  image: { width: 110, minHeight: 100, alignSelf: 'stretch' as const },
  info: { flex: 1, padding: Spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  dates: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  operator: { fontSize: 12, color: Colors.textTertiary, marginBottom: 4 },
  countdown: { fontSize: 11, color: Colors.primary, fontWeight: '600', marginBottom: 4 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontSize: 14, fontWeight: '700', color: Colors.text },
  inspectBtn: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  inspectBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primaryDark },
})
