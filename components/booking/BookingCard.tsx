import React, { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { differenceInDays, parseISO } from 'date-fns'
import { Colors, Radius, Spacing, Shadow, Typography } from '@/constants/colors'
import { formatDateRange } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import type { Booking } from '@/types'

interface BookingCardProps {
  booking: Booking
  onPress: () => void
}

type StatusKey = 'confirmed' | 'pending' | 'active' | 'completed' | 'cancelled'

const STATUS_CONFIG: Record<StatusKey, { bg: string; border: string; text: string; label: string; showPulse?: boolean }> = {
  confirmed: {
    bg: Colors.successSurface,
    border: Colors.success,
    text: Colors.success,
    label: 'Confirmed',
  },
  pending: {
    bg: Colors.transparent,
    border: Colors.warning,
    text: Colors.warning,
    label: 'Pending',
  },
  active: {
    bg: Colors.successSurface,
    border: Colors.success,
    text: Colors.success,
    label: 'Active',
    showPulse: true,
  },
  completed: {
    bg: Colors.surfaceWarm,
    border: Colors.border,
    text: Colors.textSecondary,
    label: 'Completed',
  },
  cancelled: {
    bg: Colors.errorSurface,
    border: Colors.error,
    text: Colors.error,
    label: 'Cancelled',
  },
}

function PulsingDot() {
  const anim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start()
  }, [])
  return <Animated.View style={[styles.pulseDot, { opacity: anim }]} />
}

export function BookingCard({ booking, onPress }: BookingCardProps) {
  const statusKey = (booking.status in STATUS_CONFIG ? booking.status : 'pending') as StatusKey
  const config = STATUS_CONFIG[statusKey]

  const daysUntil = booking.status === 'confirmed' || booking.status === 'pending'
    ? differenceInDays(parseISO(booking.start_date), new Date())
    : null

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {/* Image */}
      <Image
        source={{ uri: booking.listing?.cover_image_url ?? undefined }}
        style={styles.image}
        contentFit="cover"
        placeholder="https://via.placeholder.com/80x80/162038/4A5E78?text=📷"
      />

      {/* Content */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>{booking.listing?.title ?? 'Vehicle'}</Text>
          {/* Status badge */}
          <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
            {config.showPulse && <PulsingDot />}
            <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
          </View>
        </View>

        <Text style={styles.operatorText} numberOfLines={1}>{booking.operator?.name}</Text>
        <Text style={styles.dates}>{formatDateRange(booking.start_date, booking.end_date)}</Text>

        <View style={styles.bottomRow}>
          <Text style={styles.total}>{formatEURDecimal(booking.total_amount)}</Text>
          {booking.status === 'active' && (
            <TouchableOpacity
              style={styles.inspectBtn}
              onPress={() => router.push(`/(consumer)/damage/pickup/${booking.id}`)}
            >
              <Text style={styles.inspectBtnText}>Start inspection →</Text>
            </TouchableOpacity>
          )}
        </View>

        {daysUntil !== null && daysUntil >= 0 && (
          <Text style={styles.countdown}>
            {daysUntil === 0 ? '⚡ Starts today' : `📅 Starts in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  image: {
    width: 80,
    minHeight: 100,
    alignSelf: 'stretch' as const,
    borderRadius: 0,
  },
  info: {
    flex: 1,
    padding: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.h4,
    color: Colors.text,
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    gap: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  operatorText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 2,
  },
  dates: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  total: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  inspectBtn: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  inspectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  countdown: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
})
