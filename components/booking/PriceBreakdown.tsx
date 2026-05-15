import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing } from '@/constants/colors'
import { Divider } from '@/components/ui/Divider'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import type { PriceCalculation } from '@/types'

interface PriceBreakdownProps {
  calculation: PriceCalculation
  compact?: boolean
  insuranceName?: string
  insurancePricePerDay?: number
  totalDays?: number
}

export function PriceBreakdown({
  calculation,
  compact = false,
  insuranceName,
  insurancePricePerDay,
  totalDays,
}: PriceBreakdownProps) {
  const insuranceTotal =
    insurancePricePerDay !== undefined && insurancePricePerDay > 0 && totalDays !== undefined
      ? insurancePricePerDay * totalDays
      : null

  return (
    <View style={styles.container}>
      <Row label={calculation.breakdown} value={formatEURDecimal(calculation.subtotal)} />
      <Row label="Service fee (2.5%)" value={formatEURDecimal(calculation.platformFee)} />
      {insuranceTotal !== null && insuranceName !== undefined && (
        <Row
          label={`${insuranceName} insurance`}
          value={formatEURDecimal(insuranceTotal)}
        />
      )}
      <Divider style={{ marginVertical: Spacing.sm }} />
      <Row
        label="Total"
        value={formatEURDecimal(calculation.total + (insuranceTotal ?? 0))}
        bold
      />
      {!compact && calculation.deposit > 0 && (
        <Row
          label="Security deposit (refundable)"
          value={formatEURDecimal(calculation.deposit)}
          note
        />
      )}
    </View>
  )
}

function Row({
  label, value, bold, note,
}: { label: string; value: string; bold?: boolean; note?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, note && styles.note, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.value, note && styles.note, bold && styles.bold]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {},
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  label: { fontSize: 14, color: Colors.textSecondary, flex: 1, paddingRight: Spacing.sm },
  value: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  bold: { fontWeight: '700', fontSize: 16, color: Colors.text },
  note: { fontSize: 12, color: Colors.textTertiary },
})
