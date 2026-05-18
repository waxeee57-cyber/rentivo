import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { Spacing, Radius } from '@/constants/colors'
import { FleetCard } from '@/components/operator/FleetCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useFleet } from '@/lib/hooks/useFleet'
import { useToastStore } from '@/lib/store/useToastStore'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import { useColors } from '@/lib/hooks/useColors'

function OperatorSetupWizard({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const C = useColors()
  const wizardStyles = useMemo(() => makeWizardStyles(C), [C])
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

function makeWizardStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  card: {
    backgroundColor: C.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  emoji: { fontSize: 56, marginBottom: Spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  steps: { width: '100%', gap: Spacing.sm, marginBottom: Spacing.xl },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.primary,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 14,
    fontWeight: '800',
    color: C.textInverse,
  },
  stepText: { fontSize: 15, fontWeight: '600', color: C.text },
  startBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    marginBottom: Spacing.sm,
  },
  startBtnText: { fontSize: 16, fontWeight: '800', color: C.textInverse },
  skipBtn: { paddingVertical: Spacing.sm },
  skipBtnText: { fontSize: 14, color: C.textTertiary },
}) }

export default function FleetScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { operator, language } = useAuthStore()
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
    if (Config.useMock) await new Promise(r => setTimeout(r, 600))
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
    } catch { /* user dismissed share sheet — not an error */ }
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
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
          ListHeaderComponent={
            <>
              <TouchableOpacity
                style={styles.shareRow}
                onPress={handleShare}
                accessibilityLabel="Share my listing"
                accessibilityRole="button"
              >
                <Text style={styles.shareText}>🔗 Share my listing</Text>
              </TouchableOpacity>
              <View style={styles.rentalOsCard}>
                <View style={styles.rentalOsLeft}>
                  <Text style={styles.rentalOsTitle}>🔄 Import from RentalOS</Text>
                  <Text style={styles.rentalOsSubtitle}>Sync your fleet in 1 tap — no double bookings</Text>
                </View>
                <View style={styles.soonBadge}>
                  <Text style={styles.soonText}>Soon</Text>
                </View>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.fleetCardWrap}>
              <FleetCard
                listing={item}
                onEdit={() => router.push(`/(operator)/fleet/${item.id}`)}
                onToggleAvailable={available => {
                  toggleAvailability(item.id, available)
                  showToast({ message: available ? 'Vehicle is now live!' : 'Vehicle paused.', type: 'info' })
                }}
              />
              <View style={[
                styles.availBadge,
                item.available ? styles.availBadgeLive : styles.availBadgePaused,
              ]}>
                <Text style={[
                  styles.availBadgeText,
                  item.available ? styles.availBadgeTextLive : styles.availBadgeTextPaused,
                ]}>
                  {item.available
                    ? (language === 'hu' ? 'Aktív' : 'Live')
                    : (language === 'hu' ? 'Szüneteltetve' : 'Paused')}
                </Text>
              </View>
            </View>
          )}
        />
      )}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          router.push('/(operator)/fleet/new' as Parameters<typeof router.push>[0])
        }}
        accessibilityLabel="Add new vehicle"
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  // Availability badge overlay on fleet cards
  fleetCardWrap: { position: 'relative' },
  availBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  availBadgeLive: { backgroundColor: C.successSurface, borderWidth: 1, borderColor: C.success },
  availBadgePaused: { backgroundColor: C.surfaceWarm, borderWidth: 1, borderColor: C.border },
  availBadgeText: { fontSize: 11, fontWeight: '700' },
  availBadgeTextLive: { color: C.success },
  availBadgeTextPaused: { color: C.textTertiary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    marginBottom: Spacing.base,
  },
  title: { fontSize: 26, fontWeight: '800', color: C.text },
  list: { paddingHorizontal: Spacing.base },
  shareRow: {
    backgroundColor: C.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: C.primary,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  shareText: { fontSize: 14, fontWeight: '600', color: C.primary },
  rentalOsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  rentalOsLeft: { flex: 1 },
  rentalOsTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  rentalOsSubtitle: { fontSize: 12, color: C.textSecondary },
  soonBadge: {
    backgroundColor: C.warningSurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.warning,
  },
  soonText: { fontSize: 11, fontWeight: '700', color: C.warning },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: C.textInverse, fontWeight: '300', lineHeight: 32 },
  })
}
