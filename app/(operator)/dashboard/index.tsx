import React, { useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { subDays, format, parseISO } from 'date-fns'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { QuickStats } from '@/components/operator/QuickStats'
import { BookingRow } from '@/components/operator/BookingRow'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useOperatorBookings } from '@/lib/hooks/useOperatorBookings'
import { useFleet } from '@/lib/hooks/useFleet'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import { formatEUR } from '@/lib/utils/formatCurrency'

const QUICK_ACTIONS = [
  { icon: '＋', label: 'Add vehicle', route: '/(operator)/fleet/add' },
  { icon: '📋', label: 'Bookings', route: '/(operator)/bookings' },
  { icon: '💬', label: 'Messages', route: '/(operator)/bookings' },
] as const

function RevenueSparkline({ bookings }: { bookings: { total_amount: number; start_date: string }[] }) {
  const bars = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(today, 6 - i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const dayRevenue = bookings
        .filter(b => b.start_date === dateStr)
        .reduce((sum, b) => sum + b.total_amount, 0)
      return { label: format(d, 'EEE'), revenue: dayRevenue, dateStr }
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
  barFill: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
    minHeight: 0,
  },
  barValue: { fontSize: 8, color: Colors.textTertiary, marginTop: 2 },
  barLabel: { fontSize: 9, color: Colors.textTertiary, fontWeight: '600', marginTop: 1 },
})

export default function DashboardScreen() {
  const { operator } = useAuthStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? null)
  const { bookings, loading, error } = useOperatorBookings(opId)
  const { fleet } = useFleet(opId)

  const opName = Config.useMock ? MOCK_OPERATOR.name : (operator?.name ?? 'Operator')
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toISOString().split('T')[0]

  const todayPickups = bookings.filter(b => b.start_date === today && b.status !== 'cancelled')
  const todayReturns = bookings.filter(b => b.end_date === today && b.status === 'active')

  if (error) return <ErrorState message={error} />

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>{greeting}, {opName.split(' ')[0]} 👋</Text>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickAction}
              onPress={() => router.push(action.route as any)}
            >
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionIconText}>{action.icon}</Text>
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <SkeletonCard />
        ) : (
          <QuickStats bookings={bookings} totalVehicles={fleet.length} />
        )}

        {/* 7-day revenue sparkline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue — last 7 days</Text>
          <View style={styles.card}>
            <RevenueSparkline bookings={bookings.map(b => ({ total_amount: b.total_amount, start_date: b.start_date }))} />
          </View>
        </View>

        {/* Today's schedule */}
        {(todayPickups.length > 0 || todayReturns.length > 0) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
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
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <View style={[styles.card, styles.emptySchedule]}>
              <Text style={styles.emptyScheduleEmoji}>☀️</Text>
              <Text style={styles.emptyScheduleText}>No pickups or returns today</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Bookings</Text>
          {loading
            ? Array(3).fill(null).map((_, i) => <SkeletonCard key={i} />)
            : bookings.slice(0, 5).map(b => (
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

  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  quickActionIconText: { fontSize: 20 },
  quickActionLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },

  section: { marginTop: Spacing.xl },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, color: Colors.textTertiary, marginBottom: Spacing.md,
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
  scheduleLabel: {
    marginBottom: Spacing.sm,
  },
  scheduleLabelText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  emptySchedule: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyScheduleEmoji: { fontSize: 32, marginBottom: Spacing.sm },
  emptyScheduleText: { fontSize: 14, color: Colors.textTertiary },
})
