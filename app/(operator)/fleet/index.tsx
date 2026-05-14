import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { FleetCard } from '@/components/operator/FleetCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useFleet } from '@/lib/hooks/useFleet'
import { useToastStore } from '@/lib/store/useToastStore'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'

function OperatorSetupWizard({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <View style={wizardStyles.container}>
      <View style={wizardStyles.card}>
        <Text style={wizardStyles.emoji}>🎉</Text>
        <Text style={wizardStyles.title}>Welcome to Rentivo!</Text>
        <Text style={wizardStyles.subtitle}>Let's get you set up in 3 steps so you can start receiving bookings.</Text>
        <View style={wizardStyles.steps}>
          <View style={wizardStyles.step}>
            <Text style={wizardStyles.stepNum}>1</Text>
            <Text style={wizardStyles.stepText}>Add your first vehicle</Text>
          </View>
          <View style={wizardStyles.step}>
            <Text style={wizardStyles.stepNum}>2</Text>
            <Text style={wizardStyles.stepText}>Set your availability</Text>
          </View>
          <View style={wizardStyles.step}>
            <Text style={wizardStyles.stepNum}>3</Text>
            <Text style={wizardStyles.stepText}>Share your listing</Text>
          </View>
        </View>
        <TouchableOpacity style={wizardStyles.startBtn} onPress={onStart}>
          <Text style={wizardStyles.startBtnText}>Start setup →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={wizardStyles.skipBtn} onPress={onSkip}>
          <Text style={wizardStyles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const wizardStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  emoji: { fontSize: 56, marginBottom: Spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  steps: { width: '100%', gap: Spacing.sm, marginBottom: Spacing.xl },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textInverse,
  },
  stepText: { fontSize: 15, fontWeight: '600', color: Colors.text },
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

export default function FleetScreen() {
  const { operator } = useAuthStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? null)
  const { fleet, loading, toggleAvailability, refetch } = useFleet(opId)
  const { showToast } = useToastStore()
  const [refreshing, setRefreshing] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardChecked, setWizardChecked] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('operator_setup_complete').then(val => {
      if (val !== 'true') setShowWizard(true)
    }).catch(() => {}).finally(() => setWizardChecked(true))
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    refetch()
    await new Promise(r => setTimeout(r, 600))
    setRefreshing(false)
  }, [refetch])

  const dismissWizard = async () => {
    await AsyncStorage.setItem('operator_setup_complete', 'true')
    setShowWizard(false)
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out my vehicle listing on Rentivo!',
        title: 'My Rentivo listing',
      })
    } catch {}
  }

  if (!wizardChecked || loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Fleet</Text>
        </View>
        <View style={styles.list}>{Array(3).fill(null).map((_, i) => <SkeletonCard key={i} />)}</View>
      </SafeAreaView>
    )
  }

  if (showWizard && fleet.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Fleet</Text>
        </View>
        <OperatorSetupWizard
          onStart={() => {
            void dismissWizard()
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push('/(operator)/fleet/new' as Parameters<typeof router.push>[0])
          }}
          onSkip={() => dismissWizard()}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Fleet</Text>
        <HelpTooltip
          title="Your fleet"
          description="Manage all your vehicles here. Toggle availability, edit details, and track bookings."
          faqs={[
            { q: 'How do I pause a vehicle?', a: 'Toggle the switch on the vehicle card to make it unavailable.' },
            { q: 'Can I add multiple vehicles?', a: 'Yes — tap the + button to add as many as you need.' },
          ]}
        />
      </View>
      {fleet.length === 0 ? (
        <EmptyState
          emoji="🚗"
          title="Your fleet is empty"
          subtitle="Add your first vehicle to start getting bookings"
          action={{ label: '+ Add vehicle', onPress: () => router.push('/(operator)/fleet/new' as Parameters<typeof router.push>[0]) }}
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListHeaderComponent={
            <TouchableOpacity style={styles.shareRow} onPress={handleShare}>
              <Text style={styles.shareText}>🔗 Share my listing</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <FleetCard
              listing={item}
              onEdit={() => router.push(`/(operator)/fleet/${item.id}`)}
              onToggleAvailable={available => {
                toggleAvailability(item.id, available)
                showToast({ message: available ? 'Vehicle is now live!' : 'Vehicle paused.', type: 'info' })
              }}
            />
          )}
        />
      )}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          router.push('/(operator)/fleet/new' as Parameters<typeof router.push>[0])
        }}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    marginBottom: Spacing.base,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  list: { paddingHorizontal: Spacing.base },
  shareRow: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  shareText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
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
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: Colors.textInverse, fontWeight: '300', lineHeight: 32 },
})
