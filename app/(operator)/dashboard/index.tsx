import React, { useMemo, useEffect, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { subDays, format, startOfMonth } from 'date-fns'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { QuickStats } from '@/components/operator/QuickStats'
import { BookingRow } from '@/components/operator/BookingRow'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useOperatorBookings } from '@/lib/hooks/useOperatorBookings'
import { useFleet } from '@/lib/hooks/useFleet'
import { useNotificationStore } from '@/lib/store/useNotificationStore'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import { formatEUR, formatEURDecimal } from '@/lib/utils/formatCurrency'
import { t } from '@/constants/i18n'
import { getTierProgress } from '@/lib/operator-tier'
import { TierBadge } from '@/components/operator/TierBadge'
import { useColors } from '@/lib/hooks/useColors'

const MOCK_REVENUE_BARS = [
  { label: 'Fri', revenue: 85 },
  { label: 'Sat', revenue: 130 },
  { label: 'Sun', revenue: 170 },
  { label: 'Mon', revenue: 45 },
  { label: 'Tue', revenue: 95 },
  { label: 'Wed', revenue: 154 },
  { label: 'Thu', revenue: 60 },
]

function RevenueSparkline({ bookings }: { bookings: { total_amount: number; start_date: string }[] }) {
  const C = useColors()
  const sparkStyles = useMemo(() => makeSparkStyles(C), [C])
  const bars = useMemo(() => {
    if (Config.useMock) return MOCK_REVENUE_BARS
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(today, 6 - i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const dayRevenue = bookings
        .filter(b => b.start_date === dateStr)
        .reduce((sum, b) => sum + b.total_amount, 0)
      return { label: format(d, 'EEE'), revenue: dayRevenue }
    })
  }, [bookings])

  const max = Math.max(...bars.map(b => b.revenue), 1)
  const hasRevenue = bars.some(b => b.revenue > 0)

  return (
    <View style={sparkStyles.container}>
      <View style={sparkStyles.chartRow}>
        {/* € axis — a chart without a scale is a wireframe, not data */}
        <View style={sparkStyles.axis}>
          <Text style={sparkStyles.axisLabel}>€{hasRevenue ? Math.round(max) : 100}</Text>
          <Text style={sparkStyles.axisLabel}>€{hasRevenue ? Math.round(max / 2) : 50}</Text>
          <Text style={sparkStyles.axisLabel}>€0</Text>
        </View>
        <View style={sparkStyles.bars}>
          {bars.map((bar, i) => (
            <View key={i} style={sparkStyles.barCol}>
              <View style={sparkStyles.barTrack}>
                <View
                  style={[
                    sparkStyles.barFill,
                    { height: `${Math.max((bar.revenue / max) * 100, bar.revenue > 0 ? 8 : 0)}%` },
                  ]}
                />
              </View>
              {bar.revenue > 0 && (
                <Text style={sparkStyles.barValue}>{formatEUR(bar.revenue).replace('€', '')}</Text>
              )}
              <Text style={sparkStyles.barLabel}>{bar.label}</Text>
            </View>
          ))}
        </View>
      </View>
      {!hasRevenue && (
        <View style={sparkStyles.zeroOverlay} pointerEvents="none">
          <Text style={sparkStyles.zeroText}>No revenue yet — trends appear after your first confirmed booking</Text>
        </View>
      )}
    </View>
  )
}

function makeSparkStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  container: { marginTop: Spacing.sm },
  chartRow: { flexDirection: 'row', gap: Spacing.sm },
  axis: { justifyContent: 'space-between', height: 80, paddingBottom: 0 },
  axisLabel: { fontFamily: Fonts.regular, fontSize: 9, color: C.textTertiary, fontVariant: ['tabular-nums'] },
  zeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  zeroText: {
    fontFamily: Fonts.regular, fontSize: 12,
    color: C.textSecondary,
    textAlign: 'center',
    backgroundColor: C.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: {
    width: '100%',
    flex: 1,
    backgroundColor: C.surfaceWarm,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: C.primary, borderRadius: 4, minHeight: 0 },
  barValue: { fontFamily: Fonts.regular, fontSize: 8, color: C.textTertiary, marginTop: 2 },
  barLabel: { fontSize: 9, color: C.textTertiary, fontFamily: Fonts.semibold, marginTop: 1 },
}) }

interface QuickActionCardProps {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  route?: string
  externalUrl?: string
  badge?: number
}

function QuickActionCard({ icon, label, route, externalUrl, badge }: QuickActionCardProps) {
  const C = useColors()
  const qaStyles = useMemo(() => makeQaStyles(C), [C])
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (badge != null && badge > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 300, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        { iterations: 3 },
      ).start()
    }
  }, [badge])

  const handlePress = () => {
    if (externalUrl) {
      void Linking.openURL(externalUrl)
    } else if (route) {
      router.push(route as Parameters<typeof router.push>[0])
    }
  }

  return (
    <TouchableOpacity
      style={qaStyles.card}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <View style={qaStyles.iconWrap}>
        <View style={qaStyles.iconCircle}>
          {/* Quick-action nav icon, not a CTA → muted ink. */}
          <Ionicons name={icon} size={20} color={C.textSecondary} />
        </View>
        {badge != null && badge > 0 && (
          <Animated.View style={[qaStyles.badge, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={qaStyles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </Animated.View>
        )}
      </View>
      <Text style={qaStyles.label} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  )
}

function makeQaStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 80,
    justifyContent: 'center',
    gap: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    position: 'relative',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // Neutral chip — the accent tint is reserved for the CTA.
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontFamily: Fonts.regular, fontSize: 28 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: C.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, fontFamily: Fonts.extrabold, color: C.textInverse },
  label: { fontSize: 12, fontFamily: Fonts.semibold, color: C.textSecondary, textAlign: 'center' },
}) }

export default function DashboardScreen() {
  const C = useColors()
  const { styles, tierStyles } = useMemo(() => makeStyles(C), [C])
  const { operator, language } = useAuthStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? null)
  const { bookings, loading, error } = useOperatorBookings(opId)
  const { fleet } = useFleet(opId)
  const { unreadCount } = useNotificationStore()

  const opName = Config.useMock ? MOCK_OPERATOR.name : (operator?.name ?? 'Operator')
  const hour = new Date().getHours()
  const greeting = t(hour < 12 ? 'goodMorning' : hour < 18 ? 'goodAfternoon' : 'goodEvening', language)
  const today = new Date().toISOString().split('T')[0]

  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const todayPickups = bookings.filter(b => b.start_date === today && b.status !== 'cancelled')
  const todayReturns = bookings.filter(b => b.end_date === today && b.status === 'active')

  const monthStart = startOfMonth(new Date()).toISOString()

  const monthlyBookings = useMemo(() => {
    if (Config.useMock) return 14
    return bookings.filter(b => b.created_at >= monthStart && b.status !== 'cancelled').length
  }, [bookings, monthStart])

  const monthlyRevenue = useMemo(() => {
    if (Config.useMock) return 3840
    return bookings
      .filter(b => b.created_at >= monthStart && b.status !== 'cancelled')
      .reduce((sum, b) => sum + b.total_amount, 0)
  }, [bookings, monthStart])

  const stripeOnboarded = Config.useMock ? true : (operator?.stripe_onboarded ?? false)

  if (error) return <ErrorState message={error} />

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!stripeOnboarded && (
        <TouchableOpacity
          style={styles.stripeBanner}
          onPress={() => router.push('/auth/operator-stripe' as Parameters<typeof router.push>[0])}
          accessibilityLabel="Set up Stripe payouts"
          accessibilityRole="button"
        >
          <Ionicons name="flash-outline" size={13} color={C.background} importantForAccessibility="no" />
          <Text style={styles.stripeBannerText}>
            {t('ternSetupPayouts', language)}
          </Text>
        </TouchableOpacity>
      )}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>{greeting}, {opName.split(' ')[0]}</Text>

        {/* Monthly stats */}
        <View style={styles.monthlyStats}>
          <View style={[styles.monthlyStatCard, styles.monthlyStatPrimary]}>
            <Text style={styles.monthlyStatValue}>{formatEURDecimal(monthlyRevenue)}</Text>
            <Text style={styles.monthlyStatLabel}>
              {t('ternRevenueThisMonth', language)}
            </Text>
          </View>
          <View style={styles.monthlyStatCard}>
            <Text style={styles.monthlyStatValueAlt}>{monthlyBookings}</Text>
            <Text style={styles.monthlyStatLabel}>
              {t('bookings', language)}
            </Text>
          </View>
        </View>

        {/* Quick action cards — 2×2 grid */}
        <View style={styles.quickActionsGrid}>
          <View style={styles.quickActionsRow}>
            <QuickActionCard
              icon="add"
              label={t('addVehicle', language)}
              route="/(operator)/fleet/new"
            />
            <QuickActionCard
              icon="clipboard-outline"
              label={t('bookings', language)}
              route="/(operator)/bookings"
              badge={pendingCount}
            />
          </View>
          <View style={styles.quickActionsRow}>
            <QuickActionCard
              icon="chatbubble-ellipses-outline"
              label={t('messages', language)}
              route="/(operator)/messages"
              badge={unreadCount > 0 ? unreadCount : undefined}
            />
            <QuickActionCard
              icon="card-outline"
              label={t('ternPayouts', language)}
              externalUrl="https://dashboard.stripe.com/express"
            />
          </View>
        </View>

        {loading ? (
          <SkeletonCard />
        ) : (
          <QuickStats bookings={bookings} totalVehicles={fleet.length} />
        )}

        {/* Operator tier card */}
        {(() => {
          const opData = Config.useMock ? MOCK_OPERATOR : operator
          if (opData == null) return null
          const progress = getTierProgress(opData)
          return (
            <View style={tierStyles.card}>
              <View style={tierStyles.row}>
                <TierBadge tier={progress.current.tier} size="md" />
                {progress.next != null && (
                  <Text style={tierStyles.nextLabel}>{`→ ${progress.next.label} next`}</Text>
                )}
              </View>
              {progress.next != null && (
                <View style={tierStyles.progressBar}>
                  <View
                    style={[
                      tierStyles.progressFill,
                      { width: `${Math.round(progress.bookingsProgress * 100)}%` },
                    ]}
                  />
                </View>
              )}
              <Text style={tierStyles.hint}>
                {`${opData.total_bookings ?? 0} bookings · ${opData.avg_rating ?? opData.rating ?? 0} ★`}
              </Text>
            </View>
          )
        })()}

        {/* 7-day revenue sparkline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('revenueLast7', language)}</Text>
          <View style={styles.card}>
            <RevenueSparkline bookings={bookings.map(b => ({ total_amount: b.total_amount, start_date: b.start_date }))} />
          </View>
        </View>

        {/* Today's schedule */}
        {(todayPickups.length > 0 || todayReturns.length > 0) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('todaysSchedule', language)}</Text>
            {todayPickups.length > 0 && (
              <>
                <View style={styles.scheduleLabel}>
                  <Ionicons
                    name="key-outline"
                    size={14}
                    color={C.text}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text style={styles.scheduleLabelText}>Pickups</Text>
                </View>
                {todayPickups.map(b => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    onPress={() => router.push(`/(operator)/bookings/${b.id}`)}
                  />
                ))}
              </>
            )}
            {todayReturns.length > 0 && (
              <>
                <View style={styles.scheduleLabel}>
                  <Ionicons
                    name="flag-outline"
                    size={14}
                    color={C.text}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text style={styles.scheduleLabelText}>Returns</Text>
                </View>
                {todayReturns.map(b => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    onPress={() => router.push(`/(operator)/bookings/${b.id}`)}
                  />
                ))}
              </>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('todaysSchedule', language)}</Text>
            <View style={[styles.card, styles.emptySchedule]}>
              <Ionicons name="sunny-outline" size={28} color={C.textTertiary} />
              <Text style={styles.emptyScheduleText}>{t('noPickupsToday', language)}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('recentBookings', language)}</Text>
          {loading
            ? Array(3).fill(null).map((_, i) => <SkeletonCard key={i} />)
            : bookings.length === 0 ? (
              <View style={[styles.card, styles.emptySchedule]}>
                <Ionicons name="calendar-outline" size={28} color={C.textTertiary} />
                <Text style={styles.emptyScheduleText}>{t('noBookingsYet', language)}</Text>
                <TouchableOpacity
                  onPress={() => router.push('/(operator)/fleet/new' as Parameters<typeof router.push>[0])}
                  style={styles.emptyAction}
                >
                  <Text style={styles.emptyActionText}>{t('addFirstVehicle', language)}</Text>
                </TouchableOpacity>
              </View>
            ) : bookings.slice(0, 5).map(b => (
              <BookingRow
                key={b.id}
                booking={b}
                onPress={() => router.push(`/(operator)/bookings/${b.id}`)}
              />
            ))
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  greeting: { fontFamily: 'Manrope_800ExtraBold', fontSize: 24, letterSpacing: -0.5, color: C.text, marginBottom: Spacing.xl },

  // Stripe onboarding banner
  stripeBanner: {
    backgroundColor: C.warning,
    paddingVertical: 12,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stripeBannerText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: C.background,
  },

  // Monthly stats row
  monthlyStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  monthlyStatCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
  },
  monthlyStatPrimary: {
    backgroundColor: C.primarySubtle,
    borderColor: C.primary,
    borderWidth: 1.5,
  },
  monthlyStatValue: {
    fontSize: 18,
    fontFamily: Fonts.extrabold,
    color: C.primary,
    marginBottom: 4,
  },
  monthlyStatValueAlt: {
    fontSize: 22,
    fontFamily: Fonts.extrabold,
    color: C.text,
    marginBottom: 4,
  },
  monthlyStatLabel: {
    fontSize: 11,
    fontFamily: Fonts.semibold,
    color: C.textSecondary,
  },

  quickActionsGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  section: { marginTop: Spacing.xl },
  sectionTitle: {
    fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase',
    letterSpacing: 0.5, color: C.textSecondary, marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  scheduleLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  scheduleLabelText: { fontSize: 13, fontFamily: Fonts.bold, color: C.text },
  emptySchedule: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyScheduleEmoji: { fontFamily: Fonts.regular, fontSize: 32, marginBottom: Spacing.sm },
  emptyScheduleText: { fontFamily: Fonts.regular, fontSize: 14, color: C.textTertiary },
  emptyAction: {
    marginTop: Spacing.md,
    backgroundColor: C.primarySurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: C.primary,
  },
  emptyActionText: { fontSize: 14, fontFamily: Fonts.semibold, color: C.primary },
  })

  const tierStyles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: C.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  nextLabel: { color: C.textSecondary, fontFamily: Fonts.regular, fontSize: 13 },
  progressBar: { height: 4, backgroundColor: C.border, borderRadius: 2, marginBottom: 6 },
  progressFill: { height: 4, backgroundColor: C.primary, borderRadius: 2 },
  hint: { color: C.textSecondary, fontFamily: Fonts.regular, fontSize: 12 },
  })
  return { styles, tierStyles }
}
