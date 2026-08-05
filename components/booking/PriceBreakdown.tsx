import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Spacing, Fonts } from '@/constants/colors'
import { Divider } from '@/components/ui/Divider'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import type { PriceCalculation } from '@/types'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { Config } from '@/constants/config'

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
      <Row
        label={`${t('serviceFee', language)} (${(Config.platformCut * 100).toFixed(Number.isInteger(Config.platformCut * 100) ? 0 : 1)}%)`}
        value={formatEURDecimal(calculation.platformFee)}
      />
      {insuranceTotal !== null && insuranceName !== undefined && (
        <Row
          // Category first, tier second: "Damage waiver — Full". The old
          // "{tier} {category}" order produced ungrammatical Spanish/Hungarian
          // once the category stopped being the single word "insurance".
          label={`${t('insurance', language)} — ${insuranceName}`}
          value={formatEURDecimal(insuranceTotal)}
        />
      )}
      <Divider style={{ marginVertical: Spacing.sm }} />
      <Row
        label={t('total', language)}
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
  label: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, flex: 1, paddingRight: Spacing.sm },
  value: { fontSize: 14, color: C.text, fontFamily: Fonts.medium },
  bold: { fontFamily: Fonts.bold, fontSize: 16, color: C.text },
  note: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary },
  })
}
