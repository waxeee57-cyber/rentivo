import React, { useMemo, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts, Typography } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { MOCK_HOST } from '@/lib/mockData'
import { useHostDashboard } from '@/lib/hooks/useHostDashboard'
import { ErrorState } from '@/components/ui/ErrorState'
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
  // Every figure below used to be either a `Config.useMock ? n : 0` constant or a
  // sum over unpaid bookings. The hook derives all of them from this host's real
  // listings and PAID bookings, and owns one loading/error lifecycle for them.
  const {
    listings, recentBookings,
    earningsThisMonth, earningsLastMonth, earningsAllTime,
    upcomingPickups, activeRentals,
    loading, error, refetch,
  } = useHostDashboard(hostId)
  const hostData = Config.useMock ? MOCK_HOST : host
  const firstName = hostData?.name?.split(' ')[0] ?? 'Host'

  const rating = Config.useMock ? MOCK_HOST.rating : (host?.rating ?? 0)

  const styles = useMemo(() => makeStyles(C), [C])

  if (loading) {
    return <DashboardSkeleton />
  }

  // A failed load used to render as a confident €0 across every card. Say the
  // numbers could not be fetched instead of publishing a wrong one.
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ErrorState message={error} onRetry={refetch} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>Hi {firstName}</Text>

        {/* Quick stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Text style={styles.statValuePrimary}>{formatEURDecimal(earningsThisMonth, language)}</Text>
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
              <Text style={styles.earningsAmount}>{formatEURDecimal(earningsThisMonth, language)}</Text>
              <Text style={styles.earningsLabel}>{t('hostBThisMonth', language)}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              {/* Was `Config.useMock ? 38500 : 0`, so a live host saw a flat €0
                  for last month no matter what they had earned. */}
              <Text style={styles.earningsAmount}>{formatEURDecimal(earningsLastMonth, language)}</Text>
              <Text style={styles.earningsLabel}>{t('hostBLastMonth', language)}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              {/* Same for all time: `Config.useMock ? 420000 : 0`. */}
              <Text style={styles.earningsAmount}>{formatEURDecimal(earningsAllTime, language)}</Text>
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

          {/* Was `Config.useMock ? <one hardcoded fixture card> : <empty state>`,
              so a real host's listings section was empty forever however many
              vehicles they had listed. These are their actual rows. */}
          {listings.length === 0 ? (
            <View style={styles.emptyListings}>
              <Ionicons name="car-sport-outline" size={32} color={C.textTertiary} style={styles.emptyEmoji} importantForAccessibility="no" />
              <Text style={styles.emptyText}>{t('hostBNoListingsYet', language)}</Text>
            </View>
          ) : listings.slice(0, 3).map(listing => (
            <TouchableOpacity
              key={listing.id}
              style={styles.listingCard}
              onPress={() => router.push(`/(consumer)/listing/${listing.id}`)}
              accessibilityLabel={`${t('hostLViewListing', language)}: ${listing.title}`}
              accessibilityRole="button"
            >
              <View style={styles.listingEmoji}>
                <Ionicons name="car-sport-outline" size={32} color={C.textTertiary} importantForAccessibility="no" />
              </View>
              <View style={styles.listingInfo}>
                <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
                <Text style={styles.listingPrice}>
                  {formatPricePerDay(listing.price_per_day, language)}
                </Text>
                <View style={styles.listingStats}>
                  <View style={styles.listingStat}>
                    <Ionicons name="calendar-outline" size={12} color={C.textSecondary} importantForAccessibility="no" />
                    <Text style={styles.listingStatText}>{listing.booking_count} bookings</Text>
                  </View>
                  <Text style={styles.listingStatText}>★ {listing.rating}</Text>
                </View>
              </View>
              {/* The badge was a constant "Live" before, so a paused listing
                  still advertised itself as bookable. `available` is the real
                  column; there is no `is_active` on rentivo_listings. */}
              <View style={styles.listingBadge}>
                <Text style={styles.listingBadgeText}>
                  {listing.available ? t('fleetLive', language) : t('opFleetBadgePaused', language)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

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
              <Ionicons name="calendar-outline" size={32} color={C.textTertiary} style={styles.emptyEmoji} importantForAccessibility="no" />
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
            {([
              { icon: 'camera-outline', tip: t('hostBTip1', language) },
              { icon: 'flash-outline', tip: t('hostBTip2', language) },
              { icon: 'calendar-outline', tip: t('hostBTip3', language) },
            ] as { icon: React.ComponentProps<typeof Ionicons>['name']; tip: string }[]).map(({ icon, tip }) => (
              <View key={icon} style={styles.tipRow}>
                <Ionicons name={icon} size={20} color={C.textSecondary} style={styles.tipEmoji} importantForAccessibility="no" />
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
    fontFamily: Fonts.extrabold,
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
  statValue: { fontSize: 20, fontFamily: Fonts.extrabold, color: C.text, marginBottom: 4 },
  statValuePrimary: { fontSize: 24, fontFamily: Fonts.extrabold, color: C.primary, marginBottom: 4 },
  statLabel: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary },
  statLabelLight: { fontSize: 12, color: C.primary, fontFamily: Fonts.semibold },

  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: C.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seeAll: { fontSize: 13, color: C.primary, fontFamily: Fonts.semibold },

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
  listingTitle: { fontSize: 14, fontFamily: Fonts.bold, color: C.text, marginBottom: 2 },
  // Price in ink on the shared price scale (tabular numerals), never brand orange.
  listingPrice: { ...Typography.priceS, color: C.text, marginBottom: 4 },
  listingStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  listingStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listingStatText: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary },
  listingBadge: {
    backgroundColor: C.successSurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  listingBadgeText: { fontSize: 11, fontFamily: Fonts.bold, color: C.success },

  emptyListings: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.sm,
  },
  emptyEmoji: { marginBottom: Spacing.sm },
  emptyText: { fontFamily: Fonts.regular, fontSize: 14, color: C.textTertiary },

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
  addBtnText: { fontSize: 14, color: C.primary, fontFamily: Fonts.bold },

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
    // Identity chip, not an action — neutral ink pair, brand accent reserved
    // for the primary CTA / active tab.
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingAvatarText: { fontSize: 16, fontFamily: Fonts.bold, color: C.text },
  bookingInfo: { flex: 1 },
  bookingGuest: { fontSize: 14, fontFamily: Fonts.semibold, color: C.text },
  bookingDates: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary, marginTop: 2 },
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
  bookingStatusText: { fontSize: 11, fontFamily: Fonts.bold, color: C.textSecondary },

  tipsBox: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  tipEmoji: { width: 28 },
  tipText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, lineHeight: 20 },

  earningsCard: { backgroundColor: C.surface, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.xl, borderWidth: 1, borderColor: C.border },
  earningsTitle: { fontSize: 12, fontFamily: Fonts.bold, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  earningsRow: { flexDirection: 'row', alignItems: 'center' },
  earningsItem: { flex: 1, alignItems: 'center' },
  earningsAmount: { fontSize: 16, fontFamily: Fonts.extrabold, color: C.text, marginBottom: 2 },
  earningsLabel: { fontSize: 11, color: C.textTertiary, fontFamily: Fonts.semibold },
  earningsDivider: { width: 1, height: 36, backgroundColor: C.border },
  })
}
