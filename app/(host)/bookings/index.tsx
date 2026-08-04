import React, { useState, useMemo } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts, Typography } from '@/constants/colors'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { useToastStore } from '@/lib/store/useToastStore'
import { MOCK_BOOKINGS } from '@/lib/mockData'
import { Config } from '@/constants/config'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useHostBookings } from '@/lib/hooks/useBookings'
import { formatDateRange } from '@/lib/utils/formatDate'
import { updateBookingStatus } from '@/lib/api/bookings'
import type { Booking, BookingStatus } from '@/types'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'

type Tab = 'pending' | 'confirmed' | 'past'
const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'past', label: 'Past' },
]

function BookingCard({
  booking,
  onConfirm,
  onDecline,
}: {
  booking: Booking
  onConfirm?: () => void
  onDecline?: () => void
}) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language } = useAuthStore()
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(host)/bookings/${booking.id}`)}
      accessibilityLabel={`Booking from ${booking.guest_name}, ${booking.status}`}
      accessibilityRole="button"
    >
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{booking.guest_name[0]}</Text>
        </View>
        <View style={styles.guestInfo}>
          <Text style={styles.guestName}>{booking.guest_name}</Text>
          <Text style={styles.dates}>
            {formatDateRange(booking.start_date, booking.end_date)}
          </Text>
          <Text style={styles.price}>
            {booking.total_days} days · {booking.total_amount > 0 ? `€${booking.total_amount.toFixed(2)}` : '—'}
          </Text>
          {(booking.status === 'confirmed' || booking.status === 'completed' || booking.status === 'active') && (
            <Text style={styles.payout}>
              You receive: €{(booking.total_amount * 0.85).toFixed(2)} · 2 business days
            </Text>
          )}
        </View>
        <View style={[
          styles.statusBadge,
          booking.status === 'confirmed' && styles.statusConfirmed,
          booking.status === 'pending' && styles.statusPending,
          booking.status === 'active' && styles.statusActive,
          booking.status === 'completed' && styles.statusCompleted,
        ]}>
          <Text style={styles.statusText}>{booking.status}</Text>
        </View>
      </View>

      {(onConfirm || onDecline) && (
        <View style={styles.actions}>
          {onDecline && (
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={onDecline}
              accessibilityLabel={t('hostBDeclineBooking', language)}
              accessibilityRole="button"
            >
              <Text style={styles.declineBtnText}>{t('declineBooking', language)}</Text>
            </TouchableOpacity>
          )}
          {onConfirm && (
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={onConfirm}
              accessibilityLabel={t('confirmBooking', language)}
              accessibilityRole="button"
            >
              <Text style={styles.confirmBtnText}>{t('confirmBooking', language)}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function HostBookingsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const { showToast } = useToastStore()
  const { host, language } = useAuthStore()
  const hostId = Config.useMock ? 'host-001' : (host?.id ?? null)
  const { bookings: liveBookings, loading } = useHostBookings(hostId)
  const [bookings, setBookings] = useState<Booking[]>(
    Config.useMock ? MOCK_BOOKINGS : []
  )

  // Sync live bookings to local state (preserves optimistic updates)
  React.useEffect(() => {
    if (!Config.useMock && liveBookings.length > 0) {
      setBookings(liveBookings)
    }
  }, [liveBookings])

  const filtered = bookings.filter(b => {
    if (activeTab === 'pending') return b.status === 'pending'
    if (activeTab === 'confirmed') return b.status === 'confirmed' || b.status === 'active'
    return b.status === 'completed' || b.status === 'cancelled'
  })

  const EMPTY_MESSAGES: Record<Tab, {
    icon: React.ComponentProps<typeof Ionicons>['name']
    title: string
    subtitle: string
  }> = {
    pending: { icon: 'calendar-outline', title: t('hostBNoPendingRequests', language), subtitle: t('hostBNoPendingSubtitle', language) },
    confirmed: { icon: 'cash-outline', title: t('hostBNoConfirmedBookings', language), subtitle: t('hostBNoConfirmedSubtitle', language) },
    past: { icon: 'time-outline', title: t('hostBNoPastBookings', language), subtitle: t('hostBNoPastSubtitle', language) },
  }

  const handleConfirm = async (bookingId: string) => {
    try {
      if (!Config.useMock) {
        await updateBookingStatus(bookingId, 'confirmed')
      }
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'confirmed' as BookingStatus } : b))
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: t('hostBToastConfirmed', language), type: 'success' })
    } catch {
      showToast({ message: t('hostBToastConfirmFail', language), type: 'error' })
    }
  }

  const handleDecline = async () => {
    if (!decliningId) return
    const id = decliningId
    setDecliningId(null)
    try {
      if (!Config.useMock) {
        await updateBookingStatus(id, 'cancelled')
      }
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' as BookingStatus } : b))
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      showToast({ message: t('hostBToastDeclined', language), type: 'info' })
    } catch {
      showToast({ message: t('hostBToastDeclineFail', language), type: 'error' })
    }
  }

  if (loading && !Config.useMock) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>{t('bookings', language)}</Text>
        <SkeletonCard />
        <SkeletonCard />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>{t('bookings', language)}</Text>

      <View style={styles.tabs}>
        {TABS.map(tab => {
          const label = tab.key === 'pending' ? t('pending', language) : tab.key === 'confirmed' ? t('confirmed', language) : t('tabPast', language)
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="button"
              accessibilityLabel={label}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon={EMPTY_MESSAGES[activeTab].icon}
          title={EMPTY_MESSAGES[activeTab].title}
          subtitle={EMPTY_MESSAGES[activeTab].subtitle}
          action={activeTab === 'pending' ? {
            label: t('hostBViewMyListings', language),
            onPress: () => router.push('/(host)/listings' as Parameters<typeof router.push>[0]),
          } : undefined}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={b => b.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onConfirm={item.status === 'pending' ? () => handleConfirm(item.id) : undefined}
              onDecline={item.status === 'pending' ? () => setDecliningId(item.id) : undefined}
            />
          )}
        />
      )}

      <ConfirmSheet
        visible={!!decliningId}
        title={t('opBkDeclineTitle', language)}
        message={t('hostBDeclineMsg', language)}
        confirmLabel={t('declineBooking', language)}
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
  title: {
    fontSize: 26,
    fontFamily: Fonts.extrabold,
    color: C.text,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    minHeight: 44,
  },
  tabActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabText: { fontSize: 12, fontFamily: Fonts.semibold, color: C.textSecondary },
  tabTextActive: { color: C.textInverse },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 100 },

  card: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    // Identity chip, not an action — neutral ink pair, brand accent reserved
    // for the primary CTA / active tab.
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontFamily: Fonts.bold, color: C.text },
  guestInfo: { flex: 1 },
  guestName: { fontSize: 15, fontFamily: Fonts.bold, color: C.text },
  dates: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  // Price in ink on the shared price scale (tabular numerals), never brand orange.
  price: { ...Typography.priceS, color: C.text, marginTop: 2 },
  payout: { fontSize: 11, color: C.success, fontFamily: Fonts.semibold, marginTop: 1 },
  statusBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: C.surfaceWarm,
  },
  statusConfirmed: { backgroundColor: C.successSurface },
  statusPending: { backgroundColor: C.warningSurface },
  statusActive: { backgroundColor: C.infoSurface },
  statusCompleted: { backgroundColor: C.surfaceWarm },
  statusText: { fontSize: 11, fontFamily: Fonts.bold, color: C.textSecondary },

  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  declineBtn: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.error,
    backgroundColor: C.errorSurface,
    minHeight: 44,
  },
  declineBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: C.error },
  confirmBtn: {
    flex: 2,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    minHeight: 44,
  },
  confirmBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: C.textInverse },

  })
}
