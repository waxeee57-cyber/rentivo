import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { getPricingSuggestions, type PricingSuggestion } from '@/lib/api/pricingSuggestions'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'

interface Props {
  listingId: string
  city: string
  category: string
  currentPrice: number
}

export function PricingInsightWidget({ listingId, city, category, currentPrice }: Props) {
  const [data, setData] = useState<PricingSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getPricingSuggestions(listingId, city, category, currentPrice)
      setData(result)
      setExpanded(true)
    } catch {
      setError('Could not load suggestions')
    } finally {
      setLoading(false)
    }
  }

  if (!expanded && !loading) {
    return (
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => void load()}
        accessibilityLabel="Get AI pricing suggestions"
        accessibilityRole="button"
      >
        <Text style={styles.triggerIcon}>AI</Text>
        <Text style={styles.triggerText}>Get AI pricing insights</Text>
        <Text style={styles.triggerChevron}>›</Text>
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} size="small" />
        <Text style={styles.loadingText}>Analyzing market data...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => void load()} accessibilityLabel="Retry" accessibilityRole="button">
          <Text style={styles.retry}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!data) return null

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Pricing Insights</Text>
      <View style={styles.priceRow}>
        <View style={styles.priceCell}>
          <Text style={styles.priceLabel}>Min</Text>
          <Text style={styles.priceVal}>{formatEURDecimal(data.suggested_min)}</Text>
        </View>
        <View style={[styles.priceCell, styles.priceCellMid]}>
          <Text style={styles.priceLabel}>Avg</Text>
          <Text style={[styles.priceVal, styles.priceValAvg]}>{formatEURDecimal(data.suggested_avg)}</Text>
        </View>
        <View style={styles.priceCell}>
          <Text style={styles.priceLabel}>Max</Text>
          <Text style={styles.priceVal}>{formatEURDecimal(data.suggested_max)}</Text>
        </View>
      </View>
      <Text style={styles.insight}>{data.insight}</Text>
      <Text style={styles.meta}>Based on {data.comparable_count} comparable listings</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, minHeight: 44,
  },
  triggerIcon: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  triggerText: { flex: 1, fontSize: 14, color: Colors.primary, fontWeight: '600' },
  triggerChevron: { fontSize: 20, color: Colors.textSecondary },
  loading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  error: { padding: Spacing.md, alignItems: 'center' },
  errorText: { fontSize: 14, color: Colors.error },
  retry: { fontSize: 14, color: Colors.primary, fontWeight: '600', marginTop: Spacing.sm },
  container: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.base,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  title: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  priceRow: { flexDirection: 'row', marginVertical: Spacing.sm },
  priceCell: { flex: 1, alignItems: 'center' },
  priceCellMid: {
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border,
  },
  priceLabel: { fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  priceVal: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 2 },
  priceValAvg: { color: Colors.primary },
  insight: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  meta: { fontSize: 11, color: Colors.textSecondary },
})
