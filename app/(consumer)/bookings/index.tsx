import React, { useState, useRef, useCallback, useMemo } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, Animated, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Spacing, Radius } from '@/constants/colors'
import { BookingCard } from '@/components/booking/BookingCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useBookings } from '@/lib/hooks/useBookings'
import { Config } from '@/constants/config'
import { t, type TranslationKey } from '@/constants/i18n'
import type { Booking, BookingStatus } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

type TabKey = 'upcoming' | 'active' | 'past'

const TABS: { key: TabKey; labelKey: TranslationKey }[] = [
  { key: 'upcoming', labelKey: 'upcoming' },
  { key: 'active', labelKey: 'active' },
  { key: 'past', labelKey: 'tabPast' },
]

const UPCOMING_STATUSES: BookingStatus[] = ['confirmed', 'pending']
const ACTIVE_STATUSES: BookingStatus[] = ['active']
const PAST_STATUSES: BookingStatus[] = ['completed', 'cancelled']

const { width } = Dimensions.get('window')
const TAB_WIDTH = width / TABS.length

function filterBookings(bookings: Booking[], tab: TabKey): Booking[] {
  switch (tab) {
    case 'upcoming': return bookings.filter(b => UPCOMING_STATUSES.includes(b.status))
    case 'active':   return bookings.filter(b => ACTIVE_STATUSES.includes(b.status))
    case 'past':     return bookings.filter(b => PAST_STATUSES.includes(b.status))
  }
}

const EMPTY_MESSAGES: Record<TabKey, {
  emoji: string
  title: string
  subtitle: string
  action?: { label: string; tab?: TabKey; route?: string }
}> = {
  upcoming: {
    emoji: '🌴',
    title: 'No upcoming trips',
    subtitle: 'Ready for your next adventure?',
    action: { label: 'Explore vehicles →', route: '/(consumer)/explore' },
  },
  active: {
    emoji: '🚗',
    title: 'No active rentals',
    subtitle: 'Your current rentals will appear here',
    action: { label: 'View upcoming →', tab: 'upcoming' },
  },
  past: {
    emoji: '📚',
    title: 'No past trips yet',
    subtitle: 'Your completed rentals will appear here',
    action: { label: 'Start exploring →', route: '/(consumer)/explore' },
  },
}

export default function BookingsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { user, language } = useAuthStore()
  const userId = Config.useMock ? 'usr-001' : (user?.id ?? null)
  const { bookings, loading, error, refetch } = useBookings(userId)
  const [selectedTab, setSelectedTab] = useState<TabKey>('upcoming')
  const [refreshing, setRefreshing] = useState(false)
  const indicatorAnim = useRef(new Animated.Value(0)).current

  const handleTabPress = (key: TabKey, index: number) => {
    setSelectedTab(key)
    Animated.timing(indicatorAnim, {
      toValue: index * TAB_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    refetch()
    if (Config.useMock) await new Promise(r => setTimeout(r, 600))
    setRefreshing(false)
  }, [refetch])

  if (error) return <ErrorState message={error} onRetry={refetch} />

  const upcomingCount = filterBookings(bookings, 'upcoming').length
  const activeCount = filterBookings(bookings, 'active').length
  const pastCount = filterBookings(bookings, 'past').length
  const counts: Record<TabKey, number> = { upcoming: upcomingCount, active: activeCount, past: pastCount }

  const filtered = filterBookings(bookings, selectedTab)
  const emptyInfo = EMPTY_MESSAGES[selectedTab]

  const handleEmptyAction = (info: typeof emptyInfo) => {
    if (!info.action) return
    if (info.action.route) {
      router.push(info.action.route as Parameters<typeof router.push>[0])
    } else if (info.action.tab) {
      const tabIndex = TABS.findIndex(t => t.key === info.action!.tab)
      handleTabPress(info.action.tab!, tabIndex)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>{t('myTrips', language)}</Text>

      {/* Tab bar with counts */}
      <View style={styles.tabBar}>
        {TABS.map((tab, index) => {
          const count = counts[tab.key]
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => handleTabPress(tab.key, index)}
              accessibilityLabel={t(tab.labelKey, language)}
              accessibilityRole="tab"
            >
              <View style={styles.tabInner}>
                <Text style={[styles.tabLabel, selectedTab === tab.key && styles.tabLabelActive]}>
                  {t(tab.labelKey, language)}
                </Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, selectedTab === tab.key && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, selectedTab === tab.key && styles.tabBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )
        })}
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: TAB_WIDTH, transform: [{ translateX: indicatorAnim }] },
          ]}
        />
      </View>

      {loading ? (
        <View style={styles.list}>
          {Array(3).fill(null).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji={emptyInfo.emoji}
          title={emptyInfo.title}
          subtitle={emptyInfo.subtitle}
          action={emptyInfo.action
            ? { label: emptyInfo.action.label, onPress: () => handleEmptyAction(emptyInfo) }
            : undefined
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={b => b.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
          renderItem={({ item }) => (
            <View>
              <BookingCard
                booking={item}
                onPress={() => router.push(`/(consumer)/bookings/${item.id}`)}
              />
              {item.status === 'active' && (
                <View style={styles.activeActions}>
                  <TouchableOpacity
                    style={styles.activeActionBtn}
                    onPress={() => router.push(`/(consumer)/bookings/${item.id}`)}
                    accessibilityLabel="View contract"
                    accessibilityRole="button"
                  >
                    <Text style={styles.activeActionText}>📋 View contract</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.activeActionBtn}
                    onPress={() => router.push(`/(consumer)/bookings/chat/${item.id}` as Parameters<typeof router.push>[0])}
                    accessibilityLabel="Message host"
                    accessibilityRole="button"
                  >
                    <Text style={styles.activeActionText}>💬 Message</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    position: 'relative',
    marginBottom: Spacing.base,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textTertiary,
  },
  tabLabelActive: { color: C.primary },
  tabBadge: {
    backgroundColor: C.border,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: { backgroundColor: C.primarySurface },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: C.textTertiary },
  tabBadgeTextActive: { color: C.primaryDark },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    height: 2,
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
  },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 100 },
  activeActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  activeActionBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  activeActionText: { fontSize: 13, fontWeight: '600', color: C.text },
  })
}
