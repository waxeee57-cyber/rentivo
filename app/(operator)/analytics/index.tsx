import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import { getOperatorAnalytics } from '@/lib/api/analytics'
import type { OperatorAnalytics } from '@/lib/api/analytics'

type Period = 'week' | 'month' | 'quarter' | 'year'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
]

export default function AnalyticsScreen() {
  const { operator } = useAuthStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? '')

  const [period, setPeriod] = useState<Period>('month')
  const [analytics, setAnalytics] = useState<OperatorAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getOperatorAnalytics(opId, period)
      setAnalytics(data)
    } catch {
      setError('Failed to load analytics. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [opId, period])

  useEffect(() => { void load() }, [load])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Analytics</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Period selector */}
      <View style={styles.periods}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => setPeriod(p.key)}
            accessibilityLabel={`Period ${p.label}`}
            accessibilityRole="button"
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : error != null ? (
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void load()}
            accessibilityLabel="Retry loading analytics"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : analytics == null || analytics.totalBookings === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySubtitle}>
            Analytics will appear once you have confirmed or completed bookings.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* KPI row 1 */}
          <View style={styles.kpiRow}>
            <Card style={styles.kpi}>
              <Text style={styles.kpiValue}>
                €{analytics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
              <Text style={styles.kpiLabel}>Revenue</Text>
            </Card>
            <Card style={styles.kpi}>
              <Text style={styles.kpiValue}>{analytics.totalBookings}</Text>
              <Text style={styles.kpiLabel}>Bookings</Text>
            </Card>
          </View>

          {/* KPI row 2 */}
          <View style={styles.kpiRow}>
            <Card style={styles.kpi}>
              <Text style={styles.kpiValue}>
                €{analytics.avgBookingValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
              <Text style={styles.kpiLabel}>Avg Value</Text>
            </Card>
            <Card style={styles.kpi}>
              <Text style={styles.kpiValue}>{analytics.occupancyRate}%</Text>
              <Text style={styles.kpiLabel}>Occupancy</Text>
            </Card>
          </View>

          {/* Best performer */}
          {analytics.bestListingTitle != null && (
            <Card style={styles.bestCard}>
              <Text style={styles.bestLabel}>TOP PERFORMER</Text>
              <Text style={styles.bestTitle}>{analytics.bestListingTitle}</Text>
              <Text style={styles.bestRevenue}>
                €{analytics.bestListingRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} revenue this period
              </Text>
            </Card>
          )}

          {/* Revenue breakdown bar chart */}
          {analytics.revenueByPeriod.length > 0 && (
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Revenue Breakdown</Text>
              {analytics.revenueByPeriod.map((item, i) => {
                const maxAmount = Math.max(
                  ...analytics.revenueByPeriod.map(x => x.amount),
                  1,
                )
                const pct = Math.round((item.amount / maxAmount) * 100)
                // TypeScript needs a string literal type for percentage widths
                const barWidthValue: `${number}%` = `${pct}%`
                return (
                  <View key={i} style={styles.barRow}>
                    <Text style={styles.barLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: barWidthValue }]} />
                    </View>
                    <Text style={styles.barAmount}>
                      €{Math.round(item.amount)}
                    </Text>
                  </View>
                )
              })}
            </Card>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSpacer: { minWidth: 44 },

  // Period selector
  periods: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  periodBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  periodText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  periodTextActive: { color: Colors.background },

  // States
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: Spacing.md,
  },
  errorEmoji: { fontSize: 40, marginBottom: Spacing.md },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  retryBtn: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: Spacing.sm },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Scrollable content
  content: { padding: Spacing.base, paddingBottom: 100 },

  // KPI cards
  kpiRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  kpi: { flex: 1, alignItems: 'center', padding: Spacing.base },
  kpiValue: { color: Colors.primary, fontSize: 22, fontWeight: '800' },
  kpiLabel: { color: Colors.textSecondary, fontSize: 12, marginTop: 4, fontWeight: '600' },

  // Best performer
  bestCard: { padding: Spacing.base, marginBottom: Spacing.md },
  bestLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  bestTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  bestRevenue: { color: Colors.textSecondary, fontSize: 13 },

  // Bar chart
  chartCard: { padding: Spacing.base },
  chartTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  barLabel: { color: Colors.textSecondary, fontSize: 11, width: 52, fontWeight: '500' },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  barAmount: {
    color: Colors.text,
    fontSize: 11,
    width: 52,
    textAlign: 'right',
    fontWeight: '600',
  },
})
