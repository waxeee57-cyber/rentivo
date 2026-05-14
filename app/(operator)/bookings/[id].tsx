import React from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDate, formatDateRange } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { useBooking } from '@/lib/hooks/useBookings'
import { updateBookingStatus } from '@/lib/api/bookings'
import { Config } from '@/constants/config'
import type { BookingStatus } from '@/types'

export default function OperatorBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const bookingId = Config.useMock ? (id ?? 'bk-001') : (id ?? '')
  const { booking, loading, error } = useBooking(bookingId)

  if (loading) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>
  if (error || !booking) return <ErrorState message={error ?? 'Not found'} />

  const handleStatusChange = async (status: BookingStatus) => {
    Alert.alert(
      `Mark as ${status}?`,
      `This will update the booking status to ${status}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await updateBookingStatus(booking.id, status)
              Alert.alert('Updated', `Booking marked as ${status}`)
            } catch {
              Alert.alert('Error', 'Failed to update status')
            }
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={`#${booking.id.slice(0, 8).toUpperCase()}`}
        subtitle={booking.listing?.title}
      />

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
              onPress={() => Linking.openURL(`tel:${booking.guest_phone}`)}
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

        {/* Message Guest */}
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={() => router.push(`/(operator)/bookings/chat/${booking.id}`)}
        >
          <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
          <Text style={styles.messageBtnText}>💬 Message Guest</Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          {booking.status === 'pending' && (
            <>
              <Button title="Confirm booking" onPress={() => handleStatusChange('confirmed')} fullWidth style={{ marginBottom: Spacing.sm }} />
              <Button title="Decline" onPress={() => handleStatusChange('cancelled')} variant="danger" fullWidth />
            </>
          )}
          {booking.status === 'confirmed' && (
            <Button title="Mark as active (guest picked up)" onPress={() => handleStatusChange('active')} fullWidth />
          )}
          {booking.status === 'active' && (
            <Button title="Complete rental (returned)" onPress={() => handleStatusChange('completed')} fullWidth />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  statusRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.textTertiary, marginBottom: Spacing.sm },
  guestName: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  detail: { fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },
  callBtn: { backgroundColor: Colors.primarySurface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  callBtnText: { fontSize: 14, color: Colors.primaryDark, fontWeight: '600' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 14, color: Colors.textSecondary },
  priceVal: { fontSize: 18, fontWeight: '700', color: Colors.text },
  inspRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { marginTop: Spacing.md },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    justifyContent: 'center',
  },
  messageBtnText: { fontSize: 15, color: Colors.primaryDark, fontWeight: '600' },
})
