import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Radius, Spacing } from '@/constants/colors'
import { Badge } from '@/components/ui/Badge'
import { formatDateRange } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import type { Booking } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

interface BookingRowProps {
  booking: Booking
  onPress: () => void
  onConfirm?: () => void
  onDecline?: () => void
}

export function BookingRow({ booking, onPress, onConfirm, onDecline }: BookingRowProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.main}>
        <View style={styles.left}>
          <Text style={styles.guest} numberOfLines={1}>{booking.guest_name}</Text>
          <Text style={styles.vehicle} numberOfLines={1}>{booking.listing?.title ?? 'Vehicle'}</Text>
          <Text style={styles.dates}>{formatDateRange(booking.start_date, booking.end_date)}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.total}>{formatEURDecimal(booking.total_amount)}</Text>
          <Badge label={booking.status} variant={booking.status} />
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>

      {booking.status === 'pending' && (onConfirm || onDecline) && (
        <View style={styles.actions}>
          {onDecline && (
            <Button title="Decline" onPress={onDecline} variant="ghost" style={styles.actionBtn} />
          )}
          {onConfirm && (
            <Button title="Confirm" onPress={onConfirm} style={styles.actionBtn} />
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  row: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
  },
  left: { flex: 1 },
  right: { alignItems: 'flex-end', marginRight: Spacing.sm },
  guest: { fontSize: 15, fontWeight: '700', color: C.text },
  vehicle: { fontSize: 13, color: C.textSecondary, marginBottom: 2 },
  dates: { fontSize: 12, color: C.textTertiary },
  total: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 4 },
  chevron: { fontSize: 22, color: C.textTertiary },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    gap: Spacing.sm,
  },
  actionBtn: { height: 36, paddingHorizontal: Spacing.base },
  })
}
