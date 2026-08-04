import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Switch, Share, ScrollView, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { Spacing, Radius, Fonts, Typography } from '@/constants/colors'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useHostListings } from '@/lib/hooks/useListings'
import { formatPricePerDay } from '@/lib/utils/formatCurrency'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { Listing } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

function HostSetupWizard({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const C = useColors()
  const { language } = useAuthStore()
  const wizardStyles = useMemo(() => makeWizardStyles(C), [C])
  return (
    <ScrollView
      style={wizardStyles.scroll}
      contentContainerStyle={wizardStyles.wrap}
      showsVerticalScrollIndicator={false}
    >
      <View style={wizardStyles.card}>
        <View style={wizardStyles.markCircle}>
          <Ionicons name="cash-outline" size={30} color={C.success} />
        </View>
        <Text style={wizardStyles.title}>{t('hostLWelcomeTitle', language)}</Text>
        <View style={wizardStyles.earningsBox}>
          <Text style={wizardStyles.earningsLabel}>{t('hostLVehiclesLikeYoursEarn', language)}</Text>
          <Text style={wizardStyles.earningsAmount} numberOfLines={1} adjustsFontSizeToFit>
            {language === 'hu' ? '~180 000 Ft/hó' : language === 'es' ? '~450 €/mes' : '~€450/month'}
          </Text>
          <Text style={wizardStyles.earningsLabel}>{t('hostLOnRentivo', language)}</Text>
        </View>
        <Text style={wizardStyles.subtitle}>{t('hostLListIn5min', language)}</Text>
        <TouchableOpacity
          style={wizardStyles.startBtn}
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={t('hostLListMyVehicle', language)}
        >
          <Text style={wizardStyles.startBtnText}>{t('hostLListMyVehicle', language)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={wizardStyles.skipBtn}
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={t('hostLDoItLater', language)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={wizardStyles.skipBtnText}>{t('hostLDoItLater', language)}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function makeWizardStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  scroll: { flex: 1 },
  // flexGrow (not flex) + centering: if the card is taller than the viewport
  // it scrolls instead of overflowing the screen title above and tab bar below.
  wrap: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.base,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  markCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emoji: { fontFamily: Fonts.regular, fontSize: 56, marginBottom: Spacing.md },
  title: { fontSize: 22, fontFamily: Fonts.extrabold, color: C.text, textAlign: 'center', marginBottom: Spacing.md },
  earningsBox: {
    backgroundColor: C.successSurface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: C.success,
    width: '100%',
  },
  earningsLabel: { fontFamily: Fonts.regular, fontSize: 13, color: C.success },
  earningsAmount: { fontSize: 32, fontFamily: Fonts.extrabold, color: C.success, marginVertical: 4 },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
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

function HostListingCard({ listing, language }: { listing: Listing; language: 'en' | 'es' | 'hu' }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [available, setAvailable] = React.useState(listing.available)

  const handleShare = async () => {
    await Share.share({ message: `Check out my listing on Rentivo! rentivo.domrol.com/listing/${listing.id}` })
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardImage}>
          <Ionicons name="car-sport-outline" size={36} color={C.textTertiary} importantForAccessibility="no" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.cardPrice}>{formatPricePerDay(listing.price_per_day, language)}</Text>
          <View style={styles.cardStats}>
            <View style={styles.cardStatItem}>
              <Ionicons name="calendar-outline" size={12} color={C.textSecondary} importantForAccessibility="no" />
              <Text style={styles.cardStat}>{listing.booking_count} bookings/month</Text>
            </View>
            <Text style={styles.cardStat}>★ {listing.rating}</Text>
          </View>
        </View>
        <View style={styles.toggleCol}>
          <Switch
            value={available}
            onValueChange={setAvailable}
            trackColor={{ false: C.border, true: C.success }}
            thumbColor={C.text}
          />
          <Text style={styles.toggleLabel}>{available ? t('fleetLive', language) : t('opFleetBadgePaused', language)}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push(`/(consumer)/listing/${listing.id}`)}
          accessibilityRole="button"
          accessibilityLabel={t('hostLViewListing', language)}
        >
          <Text style={styles.editBtnText}>{t('hostLViewListing', language)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push(`/(host)/listings/new` as Parameters<typeof router.push>[0])}
          accessibilityRole="button"
          accessibilityLabel={t('hostLEditArrow', language)}
        >
          <Text style={styles.editBtnText}>{t('hostLEditArrow', language)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => { void handleShare() }}
          accessibilityRole="button"
          accessibilityLabel={t('hostLShareArrow', language)}
        >
          <Text style={styles.editBtnText}>{t('hostLShareArrow', language)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function HostListingsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language, host } = useAuthStore()
  // Was `Config.useMock ? [MOCK_HOST_LISTING] : []` with no fetch anywhere in the
  // file — every host in a shipped build saw "nothing listed yet" forever.
  const { listings, loading, error, refetch } = useHostListings(host?.id)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardChecked, setWizardChecked] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('host_setup_complete').then(val => {
      if (val !== 'true') setShowWizard(true)
    }).catch(() => {}).finally(() => setWizardChecked(true))
  }, [])

  const handleRefresh = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setRefreshing(true)
    refetch()
  }, [refetch])

  // The hook owns the request lifecycle, so the pull-to-refresh spinner follows it
  // instead of a timer that lies about whether anything was fetched.
  useEffect(() => {
    if (!loading) setRefreshing(false)
  }, [loading])

  const dismissWizard = async () => {
    await AsyncStorage.setItem('host_setup_complete', 'true')
    setShowWizard(false)
  }

  // `loading` is part of the gate now: without it the wizard/empty branches below
  // would flash before the first response lands and wrongly claim "no listings".
  if (!wizardChecked || (loading && !refreshing)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>{t('hostLYourVehicles', language)}</Text>
        <View style={styles.list}><SkeletonCard /></View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>{t('hostLYourVehicles', language)}</Text>
        <ErrorState message={error} onRetry={refetch} />
      </SafeAreaView>
    )
  }

  if (showWizard && listings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>{t('hostLYourVehicles', language)}</Text>
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
        <Text style={styles.title}>{t('hostLYourVehicles', language)}</Text>
        <EmptyState
          icon="home-outline"
          title={t('hostLNothingListedYet', language)}
          subtitle={t('hostLNothingListedYetSub', language)}
          action={{
            label: t('hostLListMyVehicle', language),
            onPress: () => router.push('/(host)/listings/new' as Parameters<typeof router.push>[0]),
          }}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>{t('hostLYourVehicles', language)}</Text>

      <FlatList
        data={listings}
        keyExtractor={l => l.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
        renderItem={({ item }) => <HostListingCard listing={item} language={language} />}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          router.push('/(host)/listings/new' as Parameters<typeof router.push>[0])
        }}
        accessibilityRole="button"
        accessibilityLabel={t('hostLListSomethingNew', language)}
      >
        <Text style={styles.fabText}>{t('hostLListSomethingNew', language)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.importBtn}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          router.push('/(host)/listings/add-external' as Parameters<typeof router.push>[0])
        }}
        accessibilityRole="button"
        accessibilityLabel={t('hostLImportExternal', language)}
      >
        <Text style={styles.importBtnText}>{t('hostLImportExternal', language)}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  title: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 26,
    letterSpacing: -0.6,
    color: C.text,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    marginBottom: Spacing.base,
  },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 100 },

  card: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  cardImage: {
    width: 72,
    height: 72,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: C.text, marginBottom: 2 },
  // Price in ink on the shared price scale (tabular numerals), never brand orange.
  cardPrice: { ...Typography.priceS, color: C.text, marginBottom: 4 },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.base },
  cardStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStat: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary },
  toggleCol: { alignItems: 'center', gap: 4 },
  toggleLabel: { fontSize: 10, fontFamily: Fonts.semibold, color: C.textSecondary },

  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: Spacing.md,
  },
  editBtn: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceWarm,
    minHeight: 44,
  },
  editBtnText: { fontSize: 13, fontFamily: Fonts.semibold, color: C.text },

  fab: {
    position: 'absolute',
    bottom: Spacing.xxxl + Spacing.xl,
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { fontSize: 15, fontFamily: Fonts.extrabold, color: C.textInverse },
  importBtn: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: C.surface,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  importBtnText: { fontSize: 13, fontFamily: Fonts.semibold, color: C.textSecondary },
  })
}
