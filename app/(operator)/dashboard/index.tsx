import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing } from '@/constants/colors'
import { QuickStats } from '@/components/operator/QuickStats'
import { BookingRow } from '@/components/operator/BookingRow'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useOperatorBookings } from '@/lib/hooks/useOperatorBookings'
import { useFleet } from '@/lib/hooks/useFleet'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'

export default function DashboardScreen() {
  const { operator } = useAuthStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? null)
  const { bookings, loading, error } = useOperatorBookings(opId)
  const { fleet } = useFleet(opId)

  const opName = Config.useMock ? MOCK_OPERATOR.name : (operator?.name ?? 'Operator')

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toISOString().split('T')[0]
  const todayPickups = bookings.filter(b => b.start_date === today && b.status !== 'cancelled')

  if (error) return <ErrorState message={error} />

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>{greeting}, {opName.split(' ')[0]} 👋</Text>

        {loading ? (
          <SkeletonCard />
        ) : (
          <QuickStats bookings={bookings} totalVehicles={fleet.length} />
        )}

        {todayPickups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Pickups</Text>
            {todayPickups.map(b => (
              <BookingRow
                key={b.id}
                booking={b}
                onPress={() => router.push(`/(operator)/bookings/${b.id}`)}
              />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Bookings</Text>
          {loading
            ? Array(3).fill(null).map((_, i) => <SkeletonCard key={i} />)
            : bookings.slice(0, 5).map(b => (
              <BookingRow
                key={b.id}
                booking={b}
                onPress={() => router.push(`/(operator)/bookings/${b.id}`)}
              />
            ))
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  greeting: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: Spacing.xl },
  section: { marginTop: Spacing.xl },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, color: Colors.textTertiary, marginBottom: Spacing.md,
  },
})
