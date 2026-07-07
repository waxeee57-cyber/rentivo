import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Switch, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { Spacing, Radius } from '@/constants/colors'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { MOCK_HOST_LISTING } from '@/lib/mockData'
import { formatPricePerDay } from '@/lib/utils/formatCurrency'
import { Config } from '@/constants/config'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { Listing } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

function HostSetupWizard({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const C = useColors()
  const { language } = useAuthStore()
  const wizardStyles = useMemo(() => makeWizardStyles(C), [C])
  return (
    <View style={wizardStyles.wrap}>
      <View style={wizardStyles.card}>
        <Text style={wizardStyles.emoji}>💰</Text>
        <Text style={wizardStyles.title}>{t('hostLWelcomeTitle', language)}</Text>
        <View style={wizardStyles.earningsBox}>
          <Text style={wizardStyles.earningsLabel}>{t('hostLVehiclesLikeYoursEarn', language)}</Text>
          <Text style={wizardStyles.earningsAmount}>~€450/month</Text>
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
    </View>
  )
}

function makeWizardStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  card: {
    backgroundColor: C.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emoji: { fontSize: 56, marginBottom: Spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: Spacing.md },
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
  earningsLabel: { fontSize: 13, color: C.success },
  earningsAmount: { fontSize: 32, fontWeight: '900', color: C.success, marginVertical: 4 },
  subtitle: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
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
        <Text style={styles.title}>{t('hostLYourVehicles', language)}</Text>
        <View style={styles.list}><SkeletonCard /></View>
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
          emoji="🏠"
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
    fontSize: 26,
    fontWeight: '800',
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
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  cardPrice: { fontSize: 13, color: C.primary, fontWeight: '600', marginBottom: 4 },
  cardStats: { flexDirection: 'row', gap: Spacing.base },
  cardStat: { fontSize: 12, color: C.textSecondary },
  toggleCol: { alignItems: 'center', gap: 4 },
  toggleLabel: { fontSize: 10, fontWeight: '600', color: C.textSecondary },

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
  editBtnText: { fontSize: 13, fontWeight: '600', color: C.text },

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
  fabText: { fontSize: 15, fontWeight: '800', color: C.textInverse },
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
  importBtnText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  })
}
