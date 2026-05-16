import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'

interface DashboardStats {
  users: number
  operators: number
  activeBookings: number
  revenueEur: number
}

const MOCK_STATS: DashboardStats = {
  users: 1247,
  operators: 89,
  activeBookings: 34,
  revenueEur: 48200,
}

const sections = [
  { title: 'Operators', route: '/(admin)/operators' },
  { title: 'Users', route: '/(admin)/users' },
  { title: 'Promo Codes', route: '/(admin)/promo-codes' },
]

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(Config.useMock ? MOCK_STATS : null)
  const [loading, setLoading] = useState(!Config.useMock)

  useEffect(() => {
    if (Config.useMock) return
    const load = async () => {
      setLoading(true)
      try {
        const [usersRes, opsRes, bookingsRes, revenueRes] = await Promise.all([
          supabase.from('rentivo_users').select('id', { count: 'exact', head: true }),
          supabase.from('rentivo_operators').select('id', { count: 'exact', head: true }),
          supabase.from('rentivo_bookings')
            .select('id', { count: 'exact', head: true })
            .in('status', ['confirmed', 'active']),
          supabase.from('rentivo_bookings')
            .select('total_amount')
            .eq('payment_status', 'paid'),
        ])
        const revenue = (revenueRes.data ?? []).reduce(
          (sum, b) => sum + ((b.total_amount as number | null) ?? 0), 0
        )
        setStats({
          users: usersRes.count ?? 0,
          operators: opsRes.count ?? 0,
          activeBookings: bookingsRes.count ?? 0,
          revenueEur: Math.round(revenue),
        })
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const statItems = stats ? [
    { label: 'Users', value: stats.users.toLocaleString() },
    { label: 'Operators', value: stats.operators.toLocaleString() },
    { label: 'Active Bookings', value: stats.activeBookings.toLocaleString() },
    { label: 'Revenue (EUR)', value: `€${stats.revenueEur.toLocaleString()}` },
  ] : []

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Admin Panel</Text>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.xl }} />
        ) : (
          <View style={styles.statsGrid}>
            {statItems.map((s) => (
              <Card key={s.label} style={styles.statCard}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </Card>
            ))}
          </View>
        )}
        {sections.map((s) => (
          <TouchableOpacity
            key={s.title}
            style={styles.navCard}
            onPress={() => router.push(s.route as Parameters<typeof router.push>[0])}
            accessibilityLabel={s.title}
            accessibilityRole="button"
          >
            <Text style={styles.navTitle}>{s.title}</Text>
            <Text style={styles.chevron}>{'›'}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    padding: Spacing.base,
    paddingBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  navCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    minHeight: 56,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navTitle: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 22,
    color: Colors.textTertiary,
  },
})
