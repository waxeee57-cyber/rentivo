import React, { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { BookingRow } from '@/components/operator/BookingRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useOperatorBookings } from '@/lib/hooks/useOperatorBookings'
import { updateBookingStatus } from '@/lib/api/bookings'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import type { BookingStatus } from '@/types'

type Tab = 'pending' | 'confirmed' | 'active' | 'completed'
const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'New' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
]

export default function OperatorBookingsScreen() {
  const { operator } = useAuthStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? null)
  const { bookings, loading, refetch } = useOperatorBookings(opId)
  const [activeTab, setActiveTab] = useState<Tab>('pending')

  const filtered = bookings.filter(b => b.status === activeTab)

  const handleConfirm = async (bookingId: string) => {
    try {
      await updateBookingStatus(bookingId, 'confirmed')
      refetch()
    } catch {
      Alert.alert('Error', 'Failed to confirm booking')
    }
  }

  const handleDecline = (bookingId: string) => {
    Alert.alert('Decline booking?', 'Please provide a reason.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateBookingStatus(bookingId, 'cancelled')
            refetch()
          } catch {
            Alert.alert('Error', 'Failed to decline booking')
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Bookings</Text>

      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.list}>{Array(3).fill(null).map((_, i) => <SkeletonCard key={i} />)}</View>
      ) : filtered.length === 0 ? (
        <EmptyState emoji="📅" title={`No ${activeTab} bookings`} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={b => b.id}
          contentContainerStyle={styles.list}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item }) => (
            <BookingRow
              booking={item}
              onPress={() => router.push(`/(operator)/bookings/${item.id}`)}
              onConfirm={item.status === 'pending' ? () => handleConfirm(item.id) : undefined}
              onDecline={item.status === 'pending' ? () => handleDecline(item.id) : undefined}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, marginBottom: Spacing.md },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.textInverse },
  list: { paddingHorizontal: Spacing.base },
})
