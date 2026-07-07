import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Spacing } from '@/constants/colors'
import { Divider } from '@/components/ui/Divider'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import type { PriceCalculation } from '@/types'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'

interface PriceBreakdownProps {
  calculation: PriceCalculation
  compact?: boolean
  insuranceName?: string
  insurancePricePerDay?: number
  totalDays?: number
  language?: 'en' | 'es' | 'hu'
}

export function PriceBreakdown({
  calculation,
  compact = false,
  insuranceName,
  insurancePricePerDay,
  totalDays,
  language = 'en',
}: PriceBreakdownProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
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
          label={t('depositRefundable', language)}
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
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.row}>
      <Text style={[styles.label, note && styles.note, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.value, note && styles.note, bold && styles.bold]}>{value}</Text>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {},
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  label: { fontSize: 14, color: C.textSecondary, flex: 1, paddingRight: Spacing.sm },
  value: { fontSize: 14, color: C.text, fontWeight: '500' },
  bold: { fontWeight: '700', fontSize: 16, color: C.text },
  note: { fontSize: 12, color: C.textTertiary },
  })
}
