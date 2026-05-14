import React from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { MOCK_HOST_LISTING } from '@/lib/mockData'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { Config } from '@/constants/config'
import type { Listing } from '@/types'

function HostListingCard({ listing }: { listing: Listing }) {
  const [available, setAvailable] = React.useState(listing.available)

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardImage}>
          <Text style={{ fontSize: 36 }}>🚗</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.cardPrice}>{formatEURDecimal(listing.price_per_day)}/day</Text>
          <View style={styles.cardStats}>
            <Text style={styles.cardStat}>📅 {listing.booking_count} bookings/month</Text>
            <Text style={styles.cardStat}>★ {listing.rating}</Text>
          </View>
        </View>
        <View style={styles.toggleCol}>
          <Switch
            value={available}
            onValueChange={setAvailable}
            trackColor={{ false: Colors.border, true: Colors.success }}
            thumbColor={Colors.text}
          />
          <Text style={styles.toggleLabel}>{available ? 'Live' : 'Paused'}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push(`/(consumer)/listing/${listing.id}`)}
        >
          <Text style={styles.editBtnText}>View listing</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editBtn}>
          <Text style={styles.editBtnText}>Edit →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function HostListingsScreen() {
  const listings: Listing[] = Config.useMock ? [MOCK_HOST_LISTING] : []

  if (listings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>Your vehicles</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🚗</Text>
          <Text style={styles.emptyTitle}>List your first vehicle</Text>
          <Text style={styles.emptySubtitle}>Earn money from your car, boat or bike</Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => router.push('/(host)/listings/new')}
          >
            <Text style={styles.startBtnText}>Get started →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Your vehicles</Text>

      <FlatList
        data={listings}
        keyExtractor={l => l.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <HostListingCard listing={item} />}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(host)/listings/new')}
      >
        <Text style={styles.fabText}>+ List something new</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    marginBottom: Spacing.base,
  },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 100 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  cardImage: {
    width: 72,
    height: 72,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  cardPrice: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginBottom: 4 },
  cardStats: { flexDirection: 'row', gap: Spacing.base },
  cardStat: { fontSize: 12, color: Colors.textSecondary },
  toggleCol: { alignItems: 'center', gap: 4 },
  toggleLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },

  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  editBtn: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surfaceWarm,
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing.xl },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  startBtnText: { fontSize: 16, fontWeight: '800', color: Colors.textInverse },

  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { fontSize: 15, fontWeight: '800', color: Colors.textInverse },
})
