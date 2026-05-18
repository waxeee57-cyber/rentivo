import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { differenceInDays, parseISO } from 'date-fns'
import { Radius, Spacing, Shadow, Typography } from '@/constants/colors'
import { formatDateRange } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import type { Booking } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

interface BookingCardProps {
  booking: Booking
  onPress: () => void
}

type StatusKey = 'confirmed' | 'pending' | 'active' | 'completed' | 'cancelled'

function PulsingDot() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
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

function BookingCardComponent({ booking, onPress }: BookingCardProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const STATUS_CONFIG: Record<StatusKey, { bg: string; border: string; text: string; label: string; showPulse?: boolean }> = {
    confirmed: { bg: C.successSurface, border: C.success, text: C.success, label: 'Confirmed' },
    pending: { bg: C.transparent, border: C.warning, text: C.warning, label: 'Pending' },
    active: { bg: C.successSurface, border: C.success, text: C.success, label: 'Active', showPulse: true },
    completed: { bg: C.surfaceWarm, border: C.border, text: C.textSecondary, label: 'Completed' },
    cancelled: { bg: C.errorSurface, border: C.error, text: C.error, label: 'Cancelled' },
  }
  const statusKey = (booking.status in STATUS_CONFIG ? booking.status : 'pending') as StatusKey
  const config = STATUS_CONFIG[statusKey]
  const imageUri = booking.listing?.images?.[0] ?? booking.listing?.cover_image_url ?? null

  const daysUntil = booking.status === 'confirmed' || booking.status === 'pending'
    ? differenceInDays(parseISO(booking.start_date), new Date())
    : null

  const handleInspectPress = useCallback(() => {
    router.push(`/(consumer)/damage/pickup/${booking.id}`)
  }, [booking.id])

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {/* Image */}
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>🚗</Text>
        </View>
      )}

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
              onPress={handleInspectPress}
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

export const BookingCard = React.memo(BookingCardComponent)
export default BookingCard

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
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
  imagePlaceholder: {
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 28 },
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
    color: C.text,
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
    backgroundColor: C.success,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  operatorText: {
    fontSize: 14,
    color: C.text,
    marginBottom: 2,
  },
  dates: {
    fontSize: 15,
    color: C.text,
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
    color: C.primary,
  },
  inspectBtn: {
    backgroundColor: C.primarySubtle,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.borderGold,
  },
  inspectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primaryDark,
  },
  countdown: {
    fontSize: 12,
    color: C.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  })
}
