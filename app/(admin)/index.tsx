import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'

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

export default function AdminDashboard() {
  const C = useColors()
  const { language } = useAuthStore()
  const styles = useMemo(() => makeStyles(C), [C])
  const sections = [
    { title: t('admOperators', language), route: '/(admin)/operators' },
    { title: t('admUsers', language), route: '/(admin)/users' },
    { title: t('admPromoCodes', language), route: '/(admin)/promo-codes' },
  ]
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
        // All four errors were discarded, so a broken dashboard and an empty
        // platform rendered identically. Note this only catches hard failures:
        // rentivo_bookings has admin RLS for neither SELECT nor anything else,
        // so the two booking queries succeed and return nothing, and the
        // "active bookings" and "revenue" tiles read 0 / EUR 0 no matter how
        // much money the platform has taken. Fixing that needs an admin SELECT
        // policy on rentivo_bookings; it cannot be done from this file.
        const failed = [usersRes, opsRes, bookingsRes, revenueRes].filter(r => r.error)
        if (failed.length > 0) {
          setStats(null)
          return
        }
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
    { label: t('admUsers', language), value: stats.users.toLocaleString() },
    { label: t('admOperators', language), value: stats.operators.toLocaleString() },
    { label: t('admActiveBookings', language), value: stats.activeBookings.toLocaleString() },
    { label: t('admRevenueEur', language), value: `€${stats.revenueEur.toLocaleString()}` },
  ] : []

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('admDashboardTitle', language)}</Text>
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginVertical: Spacing.xl }} />
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
            key={s.route}
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

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.extrabold,
    color: C.text,
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
    fontFamily: Fonts.extrabold,
    color: C.primary,
  },
  statLabel: {
    fontFamily: Fonts.regular, fontSize: 12,
    color: C.textSecondary,
    marginTop: 4,
  },
  navCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    minHeight: 56,
    borderWidth: 1,
    borderColor: C.border,
  },
  navTitle: {
    fontSize: 16,
    color: C.text,
    fontFamily: Fonts.semibold,
  },
  chevron: {
    fontFamily: Fonts.regular, fontSize: 22,
    color: C.textTertiary,
  },
  })
}
