import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import { getOperatorAnalytics } from '@/lib/api/analytics'
import type { OperatorAnalytics } from '@/lib/api/analytics'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'

const tr = t

type Period = 'week' | 'month' | 'quarter' | 'year'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
]

export default function AnalyticsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { operator, language } = useAuthStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? '')

  const [period, setPeriod] = useState<Period>('month')
  const [analytics, setAnalytics] = useState<OperatorAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const periodLabels: Record<Period, string> = {
    week: tr('opSetWeek', language),
    month: tr('opSetMonth', language),
    quarter: tr('opSetQuarter', language),
    year: tr('opSetYear', language),
  }

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
          accessibilityLabel={tr('opSetGoBack', language)}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{tr('opSetAnalytics', language)}</Text>
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
              {periodLabels[p.key]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={styles.loadingText}>{tr('opSetLoadingAnalytics', language)}</Text>
        </View>
      ) : error != null ? (
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={40} color={C.warning} style={styles.errorEmoji} importantForAccessibility="no" />
          <Text style={styles.errorText}>{tr('opSetAnalyticsLoadFailed', language)}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void load()}
            accessibilityLabel={tr('opSetRetryAnalytics', language)}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>{tr('opSetTryAgain', language)}</Text>
          </TouchableOpacity>
        </View>
      ) : analytics == null || analytics.totalBookings === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="bar-chart-outline" size={48} color={C.textTertiary} style={styles.emptyEmoji} importantForAccessibility="no" />
          <Text style={styles.emptyTitle}>{tr('opSetNoData', language)}</Text>
          <Text style={styles.emptySubtitle}>
            {tr('opSetAnalyticsEmpty', language)}
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
              <Text style={styles.kpiLabel}>{tr('opSetRevenue', language)}</Text>
            </Card>
            <Card style={styles.kpi}>
              <Text style={styles.kpiValue}>{analytics.totalBookings}</Text>
              <Text style={styles.kpiLabel}>{t('bookings', language)}</Text>
            </Card>
          </View>

          {/* KPI row 2 */}
          <View style={styles.kpiRow}>
            <Card style={styles.kpi}>
              <Text style={styles.kpiValue}>
                €{analytics.avgBookingValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
              <Text style={styles.kpiLabel}>{tr('opSetAvgValue', language)}</Text>
            </Card>
            <Card style={styles.kpi}>
              <Text style={styles.kpiValue}>{analytics.occupancyRate}%</Text>
              <Text style={styles.kpiLabel}>{tr('opSetOccupancy', language)}</Text>
            </Card>
          </View>

          {/* Best performer */}
          {analytics.bestListingTitle != null && (
            <Card style={styles.bestCard}>
              <Text style={styles.bestLabel}>{tr('opSetTopPerformer', language)}</Text>
              <Text style={styles.bestTitle}>{analytics.bestListingTitle}</Text>
              <Text style={styles.bestRevenue}>
                €{analytics.bestListingRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} revenue this period
              </Text>
            </Card>
          )}

          {/* Revenue breakdown bar chart */}
          {analytics.revenueByPeriod.length > 0 && (
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>{tr('opSetRevenueBreakdown', language)}</Text>
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

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

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
    color: C.text,
    fontSize: 20,
    fontFamily: Fonts.extrabold,
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
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  periodBtnActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  periodText: { color: C.textSecondary, fontSize: 13, fontFamily: Fonts.semibold },
  periodTextActive: { color: C.background },

  // States
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  loadingText: {
    color: C.textSecondary,
    fontFamily: Fonts.regular, fontSize: 14,
    marginTop: Spacing.md,
  },
  errorEmoji: { marginBottom: Spacing.md },
  errorText: {
    color: C.textSecondary,
    fontFamily: Fonts.regular, fontSize: 14,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  retryBtn: {
    backgroundColor: C.primarySurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: C.primary,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: C.primary, fontSize: 14, fontFamily: Fonts.semibold },
  emptyEmoji: { marginBottom: Spacing.md },
  emptyTitle: { color: C.text, fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.sm },
  emptySubtitle: {
    color: C.textSecondary,
    fontFamily: Fonts.regular, fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Scrollable content
  content: { padding: Spacing.base, paddingBottom: 100 },

  // KPI cards
  kpiRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  kpi: { flex: 1, alignItems: 'center', padding: Spacing.base },
  kpiValue: { color: C.primary, fontSize: 22, fontFamily: Fonts.extrabold },
  kpiLabel: { color: C.textSecondary, fontSize: 12, marginTop: 4, fontFamily: Fonts.semibold },

  // Best performer
  bestCard: { padding: Spacing.base, marginBottom: Spacing.md },
  bestLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    color: C.primary,
    marginBottom: Spacing.xs,
  },
  bestTitle: { color: C.text, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 4 },
  bestRevenue: { color: C.textSecondary, fontFamily: Fonts.regular, fontSize: 13 },

  // Bar chart
  chartCard: { padding: Spacing.base },
  chartTitle: {
    color: C.text,
    fontSize: 15,
    fontFamily: Fonts.bold,
    marginBottom: Spacing.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  barLabel: { color: C.textSecondary, fontSize: 11, width: 52, fontFamily: Fonts.medium },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: C.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    backgroundColor: C.primary,
    borderRadius: 4,
  },
  barAmount: {
    color: C.text,
    fontSize: 11,
    width: 52,
    textAlign: 'right',
    fontFamily: Fonts.semibold,
  },
  })
}
