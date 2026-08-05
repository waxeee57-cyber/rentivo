import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { BookingRow } from '@/components/operator/BookingRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useOperatorBookings } from '@/lib/hooks/useOperatorBookings'
import { useToastStore } from '@/lib/store/useToastStore'
import { updateBookingStatus, cancelBooking } from '@/lib/api/bookings'
import { captureException } from '@/lib/sentry'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import { t, type TranslationKey } from '@/constants/i18n'
import type { BookingStatus } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

type Tab = 'pending' | 'confirmed' | 'active' | 'completed'
const TABS: { key: Tab; labelKey: TranslationKey }[] = [
  { key: 'pending', labelKey: 'tabNew' },
  { key: 'confirmed', labelKey: 'confirmed' },
  { key: 'active', labelKey: 'active' },
  { key: 'completed', labelKey: 'tabCompleted' },
]

const EMPTY_MESSAGES: Record<Tab, {
  icon: React.ComponentProps<typeof Ionicons>['name']
  title: string
  subtitle: string
}> = {
  pending: {
    icon: 'calendar-outline',
    title: 'No new requests',
    subtitle: 'New booking requests will appear here',
  },
  confirmed: {
    icon: 'checkmark-circle-outline',
    title: 'No confirmed bookings',
    subtitle: 'Confirmed bookings will appear here',
  },
  active: {
    icon: 'car-sport-outline',
    title: 'No active rentals',
    subtitle: 'Rentals in progress will appear here',
  },
  completed: {
    icon: 'time-outline',
    title: 'No completed bookings',
    subtitle: 'Past completed bookings will appear here',
  },
}

export default function OperatorBookingsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { operator, language } = useAuthStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? null)
  const { bookings, loading, refetch } = useOperatorBookings(opId)
  const { showToast } = useToastStore()
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [refreshing, setRefreshing] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)

  const filtered = bookings.filter(b => b.status === activeTab)
  const pendingCount = bookings.filter(b => b.status === 'pending').length

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    refetch()
    if (Config.useMock) await new Promise(r => setTimeout(r, 600))
    setRefreshing(false)
  }, [refetch])

  const handleConfirm = async () => {
    if (!confirmingId) return
    const id = confirmingId
    setConfirmingId(null)
    try {
      await updateBookingStatus(id, 'confirmed')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: 'Booking confirmed ✓', type: 'success' })
      refetch()
    } catch {
      showToast({ message: 'Failed to confirm booking. Try again.', type: 'error' })
    }
  }

  const handleDecline = async () => {
    if (!decliningId) return
    const id = decliningId
    setDecliningId(null)
    try {
      // The confirm sheet promises the guest is "refunded according to the
      // cancellation policy". This used to call updateBookingStatus, which
      // only flips a column - so a paid guest lost their money against a
      // written promise on screen. cancelBooking() is the only path that
      // reaches stripe.refunds.create.
      const result = await cancelBooking(id)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      showToast({
        message: result.refundAmount > 0
          ? t('opBkDeclinedRefunded', language, { amount: formatEUR(result.refundAmount, language) })
          : t('opBkDeclined', language),
        type: 'info',
      })
      refetch()
    } catch (e) {
      captureException(e, { screen: 'operator/bookings', action: 'decline', bookingId: id })
      showToast({ message: 'Failed to decline booking. Try again.', type: 'error' })
    }
  }

  const emptyInfo = EMPTY_MESSAGES[activeTab]

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>{t('bookings', language)}</Text>

      <View style={styles.tabs}>
        {TABS.map(tab => {
          const count = tab.key === 'pending' ? pendingCount : 0
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {t(tab.labelKey, language)}
              </Text>
              {tab.key === 'pending' && count > 0 && (
                <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      {loading ? (
        <View style={styles.list}>{Array(3).fill(null).map((_, i) => <SkeletonCard key={i} />)}</View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={emptyInfo.icon}
          title={emptyInfo.title}
          subtitle={emptyInfo.subtitle}
          action={activeTab === 'pending' ? {
            label: 'Share my listing',
            onPress: () => router.push('/(operator)/fleet' as Parameters<typeof router.push>[0]),
          } : undefined}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={b => b.id}
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
          renderItem={({ item }) => (
            <BookingRow
              booking={item}
              onPress={() => router.push(`/(operator)/bookings/${item.id}`)}
              onConfirm={item.status === 'pending' ? () => setConfirmingId(item.id) : undefined}
              onDecline={item.status === 'pending' ? () => setDecliningId(item.id) : undefined}
            />
          )}
        />
      )}

      <ConfirmSheet
        visible={!!confirmingId}
        title="Confirm this booking?"
        message="The guest will be notified and can complete their pickup."
        confirmLabel="✓ Confirm booking"
        confirmVariant="primary"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmingId(null)}
      />

      <ConfirmSheet
        visible={!!decliningId}
        title="Decline this booking?"
        message="The guest will be notified and refunded according to the cancellation policy."
        confirmLabel="Decline"
        confirmVariant="danger"
        onConfirm={handleDecline}
        onCancel={() => setDecliningId(null)}
      />
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  title: { fontFamily: 'Manrope_800ExtraBold', fontSize: 26, letterSpacing: -0.6, color: C.text, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, marginBottom: Spacing.md },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    gap: 4,
  },
  tabActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabText: { fontSize: 12, fontFamily: Fonts.semibold, color: C.textSecondary },
  tabTextActive: { color: C.textInverse },
  tabBadge: {
    backgroundColor: C.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeActive: { backgroundColor: C.textInverse },
  tabBadgeText: { fontSize: 9, fontFamily: Fonts.extrabold, color: C.text },
  tabBadgeTextActive: { color: C.error },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 100 },
  })
}
