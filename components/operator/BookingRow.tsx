import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { Badge } from '@/components/ui/Badge'
import { formatDateRange } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import type { Booking } from '@/types'

interface BookingRowProps {
  booking: Booking
  onPress: () => void
  onConfirm?: () => void
  onDecline?: () => void
}

export function BookingRow({ booking, onPress, onConfirm, onDecline }: BookingRowProps) {
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

const styles = StyleSheet.create({
  row: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
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
  guest: { fontSize: 15, fontWeight: '700', color: Colors.text },
  vehicle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },
  dates: { fontSize: 12, color: Colors.textTertiary },
  total: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  chevron: { fontSize: 22, color: Colors.textTertiary },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  actionBtn: { height: 36, paddingHorizontal: Spacing.base },
})
