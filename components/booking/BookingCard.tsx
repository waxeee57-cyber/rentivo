import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { Badge } from '@/components/ui/Badge'
import { formatDateRange } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import type { Booking } from '@/types'

interface BookingCardProps {
  booking: Booking
  onPress: () => void
}

export function BookingCard({ booking, onPress }: BookingCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <Image
        source={{ uri: booking.listing?.cover_image_url ?? undefined }}
        style={styles.image}
        contentFit="cover"
        placeholder="https://via.placeholder.com/100x70/F5F3EF"
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{booking.listing?.title ?? 'Vehicle'}</Text>
        <Text style={styles.dates}>{formatDateRange(booking.start_date, booking.end_date)}</Text>
        <Text style={styles.operator} numberOfLines={1}>{booking.operator?.name}</Text>
        <View style={styles.bottom}>
          <Badge label={booking.status} variant={booking.status} />
          <Text style={styles.total}>{formatEURDecimal(booking.total_amount)}</Text>
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
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  image: { width: 110, height: 90 },
  info: { flex: 1, padding: Spacing.md },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  dates: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  operator: { fontSize: 12, color: Colors.textTertiary, marginBottom: Spacing.sm },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontSize: 14, fontWeight: '700', color: Colors.text },
})
