import React, { useState, useRef, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, Animated, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { BookingCard } from '@/components/booking/BookingCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useBookings } from '@/lib/hooks/useBookings'
import { Config } from '@/constants/config'
import type { Booking, BookingStatus } from '@/types'

type TabKey = 'upcoming' | 'active' | 'past'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'active', label: 'Active' },
  { key: 'past', label: 'Past' },
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

const EMPTY_MESSAGES: Record<TabKey, { emoji: string; title: string; subtitle: string }> = {
  upcoming: { emoji: '🌴', title: 'No upcoming trips', subtitle: 'Book your next adventure' },
  active:   { emoji: '🚗', title: 'No active rentals', subtitle: 'Your active rental will appear here' },
  past:     { emoji: '📅', title: 'No past trips', subtitle: 'Your completed rentals will appear here' },
}

export default function BookingsScreen() {
  const { user } = useAuthStore()
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
    await new Promise(r => setTimeout(r, 600))
    setRefreshing(false)
  }, [refetch])

  if (error) return <ErrorState message={error} />

  const upcomingCount = filterBookings(bookings, 'upcoming').length
  const activeCount = filterBookings(bookings, 'active').length
  const pastCount = filterBookings(bookings, 'past').length
  const counts: Record<TabKey, number> = { upcoming: upcomingCount, active: activeCount, past: pastCount }

  const filtered = filterBookings(bookings, selectedTab)
  const emptyInfo = EMPTY_MESSAGES[selectedTab]

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>My Trips</Text>

      {/* Tab bar with counts */}
      <View style={styles.tabBar}>
        {TABS.map((tab, index) => {
          const count = counts[tab.key]
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => handleTabPress(tab.key, index)}
            >
              <View style={styles.tabInner}>
                <Text style={[styles.tabLabel, selectedTab === tab.key && styles.tabLabelActive]}>
                  {tab.label}
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
          action={selectedTab === 'upcoming'
            ? { label: 'Explore now', onPress: () => router.push('/(consumer)/explore') }
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
              tintColor={Colors.primary}
              colors={[Colors.primary]}
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
                  >
                    <Text style={styles.activeActionText}>📋 View contract</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.activeActionBtn}
                    onPress={() => router.push(`/(consumer)/bookings/chat/${item.id}` as Parameters<typeof router.push>[0])}
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    color: Colors.textTertiary,
  },
  tabLabelActive: { color: Colors.primary },
  tabBadge: {
    backgroundColor: Colors.border,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: { backgroundColor: Colors.primarySurface },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary },
  tabBadgeTextActive: { color: Colors.primaryDark },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
  },
  list: { paddingHorizontal: Spacing.base },
  activeActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  activeActionBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeActionText: { fontSize: 13, fontWeight: '600', color: Colors.text },
})
