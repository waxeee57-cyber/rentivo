import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Share, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { Spacing, Radius, Fonts } from '@/constants/colors'
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
import { t } from '@/constants/i18n'

function OperatorSetupWizard({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const C = useColors()
  const { language } = useAuthStore()
  const wizardStyles = useMemo(() => makeWizardStyles(C), [C])
  return (
    <ScrollView
      style={wizardStyles.scroll}
      contentContainerStyle={wizardStyles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={wizardStyles.card}>
        <Ionicons
          name="sparkles"
          size={56}
          color={C.primary}
          style={wizardStyles.heroIcon}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={wizardStyles.title}>{t('opFleetWelcomeTitle', language)}</Text>
        <Text style={wizardStyles.subtitle}>{t('opFleetWelcomeSub', language)}</Text>
        <View style={wizardStyles.steps}>
          <View style={wizardStyles.step}>
            <Text style={wizardStyles.stepNum}>1</Text>
            <Text style={wizardStyles.stepText}>{t('opFleetWizardStep1', language)}</Text>
          </View>
          <View style={wizardStyles.step}>
            <Text style={wizardStyles.stepNum}>2</Text>
            <Text style={wizardStyles.stepText}>{t('opFleetWizardStep2', language)}</Text>
          </View>
          <View style={wizardStyles.step}>
            <Text style={wizardStyles.stepNum}>3</Text>
            <Text style={wizardStyles.stepText}>{t('opFleetWizardStep3', language)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={wizardStyles.startBtn}
          onPress={onStart}
          accessibilityLabel={t('opFleetWizardStart', language)}
          accessibilityRole="button"
        >
          <Text style={wizardStyles.startBtnText}>{t('opFleetWizardStart', language)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={wizardStyles.skipBtn}
          onPress={onSkip}
          accessibilityLabel={t('opFleetWizardSkip', language)}
          accessibilityRole="button"
        >
          <Text style={wizardStyles.skipBtnText}>{t('opFleetWizardSkip', language)}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function makeWizardStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  scroll: { flex: 1 },
  // flexGrow (not flex) + centering: a card taller than the viewport scrolls
  // instead of overflowing the screen title above / tab bar below.
  container: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.base,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  heroIcon: { marginBottom: Spacing.md },
  title: { fontSize: 24, fontFamily: Fonts.extrabold, color: C.text, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
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
    fontFamily: Fonts.extrabold,
    color: C.textInverse,
  },
  stepText: { fontSize: 15, fontFamily: Fonts.semibold, color: C.text },
  startBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    marginBottom: Spacing.sm,
  },
  startBtnText: { fontSize: 16, fontFamily: Fonts.extrabold, color: C.textInverse },
  skipBtn: { paddingVertical: Spacing.sm },
  skipBtnText: { fontFamily: Fonts.regular, fontSize: 14, color: C.textTertiary },
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
        message: t('opFleetShareMessage', language),
        title: t('opFleetShareTitle', language),
      })
    } catch { /* user dismissed share sheet — not an error */ }
  }

  if (!wizardChecked || loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('fleetTitle', language)}</Text>
        </View>
        <View style={styles.list}>{Array(3).fill(null).map((_, i) => <SkeletonCard key={i} />)}</View>
      </SafeAreaView>
    )
  }

  if (showWizard && fleet.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('fleetTitle', language)}</Text>
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
        <Text style={styles.title}>{t('fleetTitle', language)}</Text>
        <HelpTooltip
          title={t('opFleetHelpTitle', language)}
          description={t('opFleetHelpDesc', language)}
          faqs={[
            { q: t('opFleetFaqPauseQ', language), a: t('opFleetFaqPauseA', language) },
            { q: t('opFleetFaqMultiQ', language), a: t('opFleetFaqMultiA', language) },
          ]}
        />
      </View>
      {fleet.length === 0 ? (
        <EmptyState
          icon="car-sport-outline"
          title={t('opFleetEmptyTitle', language)}
          subtitle={t('opFleetEmptySub', language)}
          action={{ label: t('opFleetAddVehicleBtn', language), onPress: () => router.push('/(operator)/fleet/new' as Parameters<typeof router.push>[0]) }}
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
                accessibilityLabel={t('opFleetShareListing', language)}
                accessibilityRole="button"
              >
                <Ionicons
                  name="share-social-outline"
                  size={16}
                  color={C.primary}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text style={styles.shareText}>{t('opFleetShareListing', language)}</Text>
              </TouchableOpacity>
              <View style={styles.rentalOsCard}>
                <View style={styles.rentalOsLeft}>
                  <View style={styles.rentalOsTitleRow}>
                    <Ionicons
                      name="sync-outline"
                      size={14}
                      color={C.text}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    />
                    <Text style={styles.rentalOsTitle}>{t('rentalOsImport', language)}</Text>
                  </View>
                  <Text style={styles.rentalOsSubtitle}>{t('opFleetRentalOsSub', language)}</Text>
                </View>
                <View style={styles.soonBadge}>
                  <Text style={styles.soonText}>{t('opFleetSoon', language)}</Text>
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
                  showToast({ message: available ? t('opFleetToastVehicleLive', language) : t('opFleetToastVehiclePaused', language), type: 'info' })
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
                  {item.available ? t('fleetLive', language) : t('opFleetBadgePaused', language)}
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
        accessibilityLabel={t('addVehicle', language)}
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
  availBadgeText: { fontSize: 11, fontFamily: Fonts.bold },
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
  title: { fontFamily: 'Manrope_800ExtraBold', fontSize: 26, letterSpacing: -0.6, color: C.text },
  list: { paddingHorizontal: Spacing.base },
  shareRow: {
    backgroundColor: C.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: C.primary,
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  shareText: { fontSize: 14, fontFamily: Fonts.semibold, color: C.primary },
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
  rentalOsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
  rentalOsTitle: { fontSize: 14, fontFamily: Fonts.bold, color: C.text },
  rentalOsSubtitle: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary },
  soonBadge: {
    backgroundColor: C.warningSurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.warning,
  },
  soonText: { fontSize: 11, fontFamily: Fonts.bold, color: C.warning },
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
  fabText: { fontSize: 28, color: C.textInverse, fontFamily: Fonts.regular, lineHeight: 32 },
  })
}
