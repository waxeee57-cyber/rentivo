import React, { useMemo, useEffect, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { subDays, format, startOfMonth } from 'date-fns'
import { Colors, Spacing, Radius } from '@/constants/colors'
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

  return (
    <View style={sparkStyles.container}>
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
  )
}

const sparkStyles = StyleSheet.create({
  container: { marginTop: Spacing.sm },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: {
    width: '100%',
    flex: 1,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: Colors.primary, borderRadius: 4, minHeight: 0 },
  barValue: { fontSize: 8, color: Colors.textTertiary, marginTop: 2 },
  barLabel: { fontSize: 9, color: Colors.textTertiary, fontWeight: '600', marginTop: 1 },
})

interface QuickActionCardProps {
  icon: string
  label: string
  route?: string
  externalUrl?: string
  badge?: number
}

function QuickActionCard({ icon, label, route, externalUrl, badge }: QuickActionCardProps) {
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
        <Text style={qaStyles.icon}>{icon}</Text>
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

const qaStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
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
  icon: { fontSize: 28 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: Colors.textInverse },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
})

export default function DashboardScreen() {
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
          <Text style={styles.stripeBannerText}>
            {language === 'hu'
              ? '⚡ Állítsd be a kifizetéseket a foglalások fogadásához →'
              : '⚡ Set up payouts to accept bookings →'}
          </Text>
        </TouchableOpacity>
      )}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>{greeting}, {opName.split(' ')[0]} 👋</Text>

        {/* Monthly stats */}
        <View style={styles.monthlyStats}>
          <View style={[styles.monthlyStatCard, styles.monthlyStatPrimary]}>
            <Text style={styles.monthlyStatValue}>{formatEURDecimal(monthlyRevenue)}</Text>
            <Text style={styles.monthlyStatLabel}>
              {language === 'hu' ? 'Havi bevétel' : 'Revenue this month'}
            </Text>
          </View>
          <View style={styles.monthlyStatCard}>
            <Text style={styles.monthlyStatValueAlt}>{monthlyBookings}</Text>
            <Text style={styles.monthlyStatLabel}>
              {language === 'hu' ? 'Foglalás' : 'Bookings'}
            </Text>
          </View>
        </View>

        {/* Quick action cards — 2×2 grid */}
        <View style={styles.quickActionsGrid}>
          <View style={styles.quickActionsRow}>
            <QuickActionCard
              icon="＋"
              label={t('addVehicle', language)}
              route="/(operator)/fleet/new"
            />
            <QuickActionCard
              icon="📋"
              label={t('bookings', language)}
              route="/(operator)/bookings"
              badge={pendingCount}
            />
          </View>
          <View style={styles.quickActionsRow}>
            <QuickActionCard
              icon="💬"
              label={t('messages', language)}
              route="/(operator)/messages"
              badge={unreadCount > 0 ? unreadCount : undefined}
            />
            <QuickActionCard
              icon="💳"
              label={language === 'hu' ? 'Kifizetés' : 'Payouts'}
              externalUrl="https://dashboard.stripe.com/express"
            />
          </View>
        </View>

        {loading ? (
          <SkeletonCard />
        ) : (
          <QuickStats bookings={bookings} totalVehicles={fleet.length} />
        )}

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
                  <Text style={styles.scheduleLabelText}>🔑 Pickups</Text>
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
                  <Text style={styles.scheduleLabelText}>🏁 Returns</Text>
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
              <Text style={styles.emptyScheduleEmoji}>☀️</Text>
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
                <Text style={styles.emptyScheduleEmoji}>📅</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  greeting: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: Spacing.xl },

  // Stripe onboarding banner
  stripeBanner: {
    backgroundColor: Colors.warning,
    paddingVertical: 12,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
  },
  stripeBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.background,
  },

  // Monthly stats row
  monthlyStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  monthlyStatCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthlyStatPrimary: {
    backgroundColor: Colors.primarySubtle,
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  monthlyStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 4,
  },
  monthlyStatValueAlt: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  monthlyStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
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
    fontSize: 13, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, color: Colors.textSecondary, marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  scheduleLabel: { marginBottom: Spacing.sm },
  scheduleLabelText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  emptySchedule: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyScheduleEmoji: { fontSize: 32, marginBottom: Spacing.sm },
  emptyScheduleText: { fontSize: 14, color: Colors.textTertiary },
  emptyAction: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  emptyActionText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
})
