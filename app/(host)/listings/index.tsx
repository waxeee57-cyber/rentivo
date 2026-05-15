import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Switch, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { MOCK_HOST_LISTING } from '@/lib/mockData'
import { formatPricePerDay } from '@/lib/utils/formatCurrency'
import { Config } from '@/constants/config'
import { useAuthStore } from '@/lib/store/useAuthStore'
import type { Listing } from '@/types'

function HostSetupWizard({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <View style={wizardStyles.wrap}>
      <View style={wizardStyles.card}>
        <Text style={wizardStyles.emoji}>💰</Text>
        <Text style={wizardStyles.title}>Welcome! Let's start earning</Text>
        <View style={wizardStyles.earningsBox}>
          <Text style={wizardStyles.earningsLabel}>Vehicles like yours earn</Text>
          <Text style={wizardStyles.earningsAmount}>~€450/month</Text>
          <Text style={wizardStyles.earningsLabel}>on Rentivo</Text>
        </View>
        <Text style={wizardStyles.subtitle}>
          List your vehicle in 5 minutes and start getting bookings.
        </Text>
        <TouchableOpacity style={wizardStyles.startBtn} onPress={onStart}>
          <Text style={wizardStyles.startBtnText}>List my vehicle →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={wizardStyles.skipBtn} onPress={onSkip}>
          <Text style={wizardStyles.skipBtnText}>I'll do it later</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const wizardStyles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emoji: { fontSize: 56, marginBottom: Spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: Spacing.md },
  earningsBox: {
    backgroundColor: Colors.successSurface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success,
    width: '100%',
  },
  earningsLabel: { fontSize: 13, color: Colors.success },
  earningsAmount: { fontSize: 32, fontWeight: '900', color: Colors.success, marginVertical: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    marginBottom: Spacing.sm,
  },
  startBtnText: { fontSize: 16, fontWeight: '800', color: Colors.textInverse },
  skipBtn: { paddingVertical: Spacing.sm },
  skipBtnText: { fontSize: 14, color: Colors.textTertiary },
})

function HostListingCard({ listing, language }: { listing: Listing; language: 'en' | 'es' | 'hu' }) {
  const [available, setAvailable] = React.useState(listing.available)

  const handleShare = async () => {
    await Share.share({ message: `Check out my listing on Rentivo! rentivo.domrol.com/listing/${listing.id}` })
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardImage}>
          <Text style={{ fontSize: 36 }}>🚗</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.cardPrice}>{formatPricePerDay(listing.price_per_day, language)}</Text>
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
          accessibilityLabel="View listing"
          accessibilityRole="button"
        >
          <Text style={styles.editBtnText}>View listing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push(`/(host)/listings/new` as Parameters<typeof router.push>[0])}
          accessibilityLabel="Edit listing"
          accessibilityRole="button"
        >
          <Text style={styles.editBtnText}>Edit →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => { void handleShare() }}
          accessibilityLabel="Share listing"
          accessibilityRole="button"
        >
          <Text style={styles.editBtnText}>↗ Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function HostListingsScreen() {
  const { language } = useAuthStore()
  const listings: Listing[] = Config.useMock ? [MOCK_HOST_LISTING] : []
  const [showWizard, setShowWizard] = useState(false)
  const [wizardChecked, setWizardChecked] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('host_setup_complete').then(val => {
      if (val !== 'true') setShowWizard(true)
    }).catch(() => {}).finally(() => setWizardChecked(true))
  }, [])

  const dismissWizard = async () => {
    await AsyncStorage.setItem('host_setup_complete', 'true')
    setShowWizard(false)
  }

  if (!wizardChecked) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>Your vehicles</Text>
        <View style={styles.list}><SkeletonCard /></View>
      </SafeAreaView>
    )
  }

  if (showWizard && listings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>Your vehicles</Text>
        <HostSetupWizard
          onStart={() => {
            void dismissWizard()
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push('/(host)/listings/new' as Parameters<typeof router.push>[0])
          }}
          onSkip={() => dismissWizard()}
        />
      </SafeAreaView>
    )
  }

  if (listings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>Your vehicles</Text>
        <EmptyState
          emoji="🏠"
          title="Nothing listed yet"
          subtitle="List your vehicle in 5 minutes and start earning"
          action={{
            label: 'List something →',
            onPress: () => router.push('/(host)/listings/new' as Parameters<typeof router.push>[0]),
          }}
        />
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
        renderItem={({ item }) => <HostListingCard listing={item} language={language} />}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          router.push('/(host)/listings/new' as Parameters<typeof router.push>[0])
        }}
        accessibilityLabel="List something new"
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+ List something new</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.importBtn}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          router.push('/(host)/listings/add-external' as Parameters<typeof router.push>[0])
        }}
        accessibilityLabel="Import from Airbnb or Booking.com"
        accessibilityRole="button"
      >
        <Text style={styles.importBtnText}>↗ Import from Airbnb / Booking.com</Text>
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
    justifyContent: 'center',
    backgroundColor: Colors.surfaceWarm,
    minHeight: 44,
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text },

  fab: {
    position: 'absolute',
    bottom: Spacing.xxxl + Spacing.xl,
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
  importBtn: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  importBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
})
