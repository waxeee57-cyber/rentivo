import React from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { FleetCard } from '@/components/operator/FleetCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useFleet } from '@/lib/hooks/useFleet'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'

export default function FleetScreen() {
  const { operator } = useAuthStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? null)
  const { fleet, loading, toggleAvailability } = useFleet(opId)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Fleet</Text>
      {loading ? (
        <View style={styles.list}>{Array(3).fill(null).map((_, i) => <SkeletonCard key={i} />)}</View>
      ) : fleet.length === 0 ? (
        <EmptyState
          emoji="🚗"
          title="No vehicles yet"
          subtitle="Add your first vehicle to start receiving bookings"
          action={{ label: 'Add vehicle', onPress: () => router.push('/(operator)/fleet/new') }}
        />
      ) : (
        <FlatList
          data={fleet}
          keyExtractor={l => l.id}
          contentContainerStyle={styles.list}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item }) => (
            <FleetCard
              listing={item}
              onEdit={() => router.push(`/(operator)/fleet/${item.id}`)}
              onToggleAvailable={available => toggleAvailability(item.id, available)}
            />
          )}
        />
      )}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(operator)/fleet/new')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, marginBottom: Spacing.base },
  list: { paddingHorizontal: Spacing.base },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 28, color: Colors.textInverse, fontWeight: '300', lineHeight: 32 },
})
