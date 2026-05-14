import React from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDate, formatDateRange, isDateToday } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { useBooking } from '@/lib/hooks/useBookings'
import { Config } from '@/constants/config'
import type { BookingStatus } from '@/types'

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

  if (loading) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>
  if (error || !booking) return <ErrorState message={error ?? 'Booking not found'} />

  const pickupToday = isDateToday(booking.start_date)
  const returnToday = isDateToday(booking.end_date)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.ref}>#{booking.id.slice(0, 8).toUpperCase()}</Text>
      </View>

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
        </Card>

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
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  back: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  ref: { fontSize: 13, color: Colors.textTertiary, fontWeight: '600' },
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
  inspectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inspLabel: { fontSize: 14, color: Colors.textSecondary },
  phoneBtn: { backgroundColor: Colors.primarySurface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center' },
  phoneBtnText: { fontSize: 15, color: Colors.primaryDark, fontWeight: '600' },
})
