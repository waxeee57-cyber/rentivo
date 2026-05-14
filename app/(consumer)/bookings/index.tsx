import React from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing } from '@/constants/colors'
import { BookingCard } from '@/components/booking/BookingCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useBookings } from '@/lib/hooks/useBookings'
import { Config } from '@/constants/config'

export default function BookingsScreen() {
  const { user } = useAuthStore()
  const userId = Config.useMock ? 'usr-001' : (user?.id ?? null)
  const { bookings, loading, error } = useBookings(userId)

  if (error) return <ErrorState message={error} />

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>My Bookings</Text>
      {loading ? (
        <View style={styles.list}>
          {Array(3).fill(null).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : bookings.length === 0 ? (
        <EmptyState
          emoji="📅"
          title="No bookings yet"
          subtitle="Explore vehicles and make your first booking"
          action={{ label: 'Explore', onPress: () => router.push('/(consumer)/explore') }}
        />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={b => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onPress={() => router.push(`/(consumer)/bookings/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, marginBottom: Spacing.base },
  list: { paddingHorizontal: Spacing.base },
})
