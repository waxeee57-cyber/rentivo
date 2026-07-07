import React, { useMemo, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Spacing, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { MOCK_HOST, MOCK_HOST_LISTING, MOCK_BOOKINGS } from '@/lib/mockData'
import { useHostBookings } from '@/lib/hooks/useBookings'
import { formatEURDecimal, formatPricePerDay } from '@/lib/utils/formatCurrency'
import { formatDateRange } from '@/lib/utils/formatDate'
import { Config } from '@/constants/config'
import { t } from '@/constants/i18n'

function DashboardSkeleton() {
  const C = useColors()
  const opacity = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.8, duration: 1000, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
    ])).start()
  }, [opacity])
  const skStyles = useMemo(() => makeSkStyles(C), [C])
  return (
    <SafeAreaView style={skStyles.container} edges={['top']}>
      <View style={{ padding: Spacing.base }}>
        <Animated.View style={[skStyles.title, { opacity }]} />
        <View style={skStyles.statsGrid}>
          {[0, 1, 2, 3].map(i => (
            <Animated.View key={i} style={[skStyles.statCard, { opacity }]} />
          ))}
        </View>
        <Animated.View style={[skStyles.card, { opacity }]} />
        <Animated.View style={[skStyles.cardShort, { opacity }]} />
        <Animated.View style={[skStyles.cardShort, { opacity }]} />
      </View>
    </SafeAreaView>
  )
}

function makeSkStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  title: { height: 30, width: '60%', backgroundColor: C.surface, borderRadius: Radius.md, marginBottom: Spacing.xl },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  statCard: { flex: 1, minWidth: '45%', height: 70, backgroundColor: C.surface, borderRadius: Radius.xl },
  card: { height: 100, backgroundColor: C.surface, borderRadius: Radius.xl, marginBottom: Spacing.md },
  cardShort: { height: 64, backgroundColor: C.surface, borderRadius: Radius.xl, marginBottom: Spacing.sm },
  })
}

export default function HostDashboardScreen() {
  const C = useColors()
  const { host, language } = useAuthStore()
  const hostId = Config.useMock ? MOCK_HOST.id : (host?.id ?? null)
  const { bookings, loading } = useHostBookings(hostId)
  const hostData = Config.useMock ? MOCK_HOST : host
  const firstName = hostData?.name?.split(' ')[0] ?? 'Host'

  const today = new Date().toISOString().split('T')[0]
  const thisMonth = new Date().toISOString().slice(0, 7)

  const monthlyEarnings = useMemo(() => {
    if (Config.useMock) return 42000
    return bookings
      .filter(b => b.start_date.startsWith(thisMonth) && b.status !== 'cancelled')
      .reduce((sum, b) => sum + (b.total_amount - b.platform_fee), 0)
  }, [bookings, thisMonth])

  const upcomingPickups = useMemo(() => {
    if (Config.useMock) return 2
    return bookings.filter(b => b.start_date >= today && (b.status === 'confirmed' || b.status === 'pending')).length
  }, [bookings, today])

  const activeRentals = useMemo(() => {
    if (Config.useMock) return 1
    return bookings.filter(b => b.status === 'active').length
  }, [bookings])

  const rating = Config.useMock ? MOCK_HOST.rating : (host?.rating ?? 0)

  const recentBookings = Config.useMock ? MOCK_BOOKINGS.slice(0, 3) : bookings.slice(0, 3)

  const styles = useMemo(() => makeStyles(C), [C])

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>Hi {firstName} 👋</Text>

        {/* Quick stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Text style={styles.statValuePrimary}>{formatEURDecimal(monthlyEarnings)}</Text>
            <Text style={styles.statLabelLight}>{t('earnedThisMonth', language)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{upcomingPickups}</Text>
            <Text style={styles.statLabel}>{t('hostBUpcomingPickups', language)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeRentals}</Text>
            <Text style={styles.statLabel}>{t('activeRentals', language)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>★{rating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{t('rating', language)}</Text>
          </View>
        </View>

        {/* Earnings overview */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsTitle}>{t('hostBEarningsOverview', language)}</Text>
          <View style={styles.earningsRow}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsAmount}>{formatEURDecimal(monthlyEarnings)}</Text>
              <Text style={styles.earningsLabel}>{t('hostBThisMonth', language)}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              <Text style={styles.earningsAmount}>{formatEURDecimal(Config.useMock ? 38500 : 0)}</Text>
              <Text style={styles.earningsLabel}>{t('hostBLastMonth', language)}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              <Text style={styles.earningsAmount}>{formatEURDecimal(Config.useMock ? 420000 : 0)}</Text>
              <Text style={styles.earningsLabel}>{t('hostBAllTime', language)}</Text>
            </View>
          </View>
        </View>

        {/* Your listings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('hostBYourListings', language)}</Text>
            <TouchableOpacity
              onPress={() => router.push('/(host)/listings')}
              accessibilityLabel={t('hostBSeeAllListings', language)}
              accessibilityRole="button"
            >
              <Text style={styles.seeAll}>{t('hostBSeeAll', language)}</Text>
            </TouchableOpacity>
          </View>

          {Config.useMock ? (
            <TouchableOpacity
              style={styles.listingCard}
              onPress={() => router.push(`/(consumer)/listing/${MOCK_HOST_LISTING.id}`)}
              accessibilityLabel={`View listing: ${MOCK_HOST_LISTING.title}`}
              accessibilityRole="button"
            >
              <View style={styles.listingEmoji}>
                <Text style={{ fontSize: 32 }}>🚗</Text>
              </View>
              <View style={styles.listingInfo}>
                <Text style={styles.listingTitle} numberOfLines={1}>{MOCK_HOST_LISTING.title}</Text>
                <Text style={styles.listingPrice}>
                  {formatPricePerDay(MOCK_HOST_LISTING.price_per_day, language)}
                </Text>
                <View style={styles.listingStats}>
                  <Text style={styles.listingStatText}>📅 {MOCK_HOST_LISTING.booking_count} bookings</Text>
                  <Text style={styles.listingStatText}>★ {MOCK_HOST_LISTING.rating}</Text>
                </View>
              </View>
              <View style={styles.listingBadge}>
                <Text style={styles.listingBadgeText}>{t('fleetLive', language)}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyListings}>
              <Text style={styles.emptyEmoji}>🚗</Text>
              <Text style={styles.emptyText}>{t('hostBNoListingsYet', language)}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(host)/listings/new')}
            accessibilityLabel={t('hostBAddListing', language)}
            accessibilityRole="button"
          >
            <Text style={styles.addBtnText}>{t('hostBAddListing', language)}</Text>
          </TouchableOpacity>
        </View>

        {/* Recent bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('recentBookings', language)}</Text>
            <TouchableOpacity
              onPress={() => router.push('/(host)/bookings')}
              accessibilityLabel={t('hostBSeeAllBookings', language)}
              accessibilityRole="button"
            >
              <Text style={styles.seeAll}>{t('hostBSeeAll', language)}</Text>
            </TouchableOpacity>
          </View>

          {recentBookings.length === 0 ? (
            <View style={styles.emptyListings}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyText}>{t('noBookingsYet', language)}</Text>
            </View>
          ) : recentBookings.map(b => (
            <TouchableOpacity
              key={b.id}
              style={styles.bookingRow}
              onPress={() => router.push(`/(host)/bookings/${b.id}`)}
              accessibilityLabel={`Booking from ${b.guest_name}, ${b.status}`}
              accessibilityRole="button"
            >
              <View style={styles.bookingAvatar}>
                <Text style={styles.bookingAvatarText}>{b.guest_name[0]}</Text>
              </View>
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingGuest}>{b.guest_name}</Text>
                <Text style={styles.bookingDates}>
                  {formatDateRange(b.start_date, b.end_date)}
                </Text>
              </View>
              <View style={[
                styles.bookingStatusBadge,
                b.status === 'confirmed' && styles.statusConfirmed,
                b.status === 'pending' && styles.statusPending,
                b.status === 'active' && styles.statusActive,
                b.status === 'completed' && styles.statusCompleted,
              ]}>
                <Text style={styles.bookingStatusText}>{b.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('hostBTipsTitle', language)}</Text>
          <View style={styles.tipsBox}>
            {[
              { emoji: '📸', tip: t('hostBTip1', language) },
              { emoji: '⚡', tip: t('hostBTip2', language) },
              { emoji: '📅', tip: t('hostBTip3', language) },
            ].map(({ emoji, tip }) => (
              <View key={emoji} style={styles.tipRow}>
                <Text style={styles.tipEmoji}>{emoji}</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    marginBottom: Spacing.xl,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
  },
  statCardPrimary: {
    backgroundColor: C.primarySubtle,
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 4 },
  statValuePrimary: { fontSize: 24, fontWeight: '800', color: C.primary, marginBottom: 4 },
  statLabel: { fontSize: 12, color: C.textSecondary },
  statLabelLight: { fontSize: 12, color: C.primary, fontWeight: '600' },

  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seeAll: { fontSize: 13, color: C.primary, fontWeight: '600' },

  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.sm,
  },
  listingEmoji: {
    width: 64,
    height: 64,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingInfo: { flex: 1 },
  listingTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  listingPrice: { fontSize: 13, color: C.primary, fontWeight: '600', marginBottom: 4 },
  listingStats: { flexDirection: 'row', gap: Spacing.md },
  listingStatText: { fontSize: 12, color: C.textSecondary },
  listingBadge: {
    backgroundColor: C.successSurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  listingBadgeText: { fontSize: 11, fontWeight: '700', color: C.success },

  emptyListings: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.sm,
  },
  emptyEmoji: { fontSize: 32, marginBottom: Spacing.sm },
  emptyText: { fontSize: 14, color: C.textTertiary },

  addBtn: {
    borderWidth: 1.5,
    borderColor: C.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    minHeight: 44,
  },
  addBtnText: { fontSize: 14, color: C.primary, fontWeight: '700' },

  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  bookingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingAvatarText: { fontSize: 16, fontWeight: '700', color: C.primary },
  bookingInfo: { flex: 1 },
  bookingGuest: { fontSize: 14, fontWeight: '600', color: C.text },
  bookingDates: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  bookingStatusBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: C.surfaceWarm,
  },
  statusConfirmed: { backgroundColor: C.successSurface },
  statusPending: { backgroundColor: C.warningSurface },
  statusActive: { backgroundColor: C.infoSurface },
  statusCompleted: { backgroundColor: C.surfaceWarm },
  bookingStatusText: { fontSize: 11, fontWeight: '700', color: C.textSecondary },

  tipsBox: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  tipEmoji: { fontSize: 20, width: 28 },
  tipText: { flex: 1, fontSize: 13, color: C.textSecondary, lineHeight: 20 },

  earningsCard: { backgroundColor: C.surface, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.xl, borderWidth: 1, borderColor: C.border },
  earningsTitle: { fontSize: 12, fontWeight: '700', color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  earningsRow: { flexDirection: 'row', alignItems: 'center' },
  earningsItem: { flex: 1, alignItems: 'center' },
  earningsAmount: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 2 },
  earningsLabel: { fontSize: 11, color: C.textTertiary, fontWeight: '600' },
  earningsDivider: { width: 1, height: 36, backgroundColor: C.border },
  })
}
