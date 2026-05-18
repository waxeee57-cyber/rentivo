import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing } from '@/constants/colors'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { useColors } from '@/lib/hooks/useColors'

interface PriceTagProps {
  pricePerDay: number
  large?: boolean
}

export function PriceTag({ pricePerDay, large = false }: PriceTagProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.row}>
      <Text style={[styles.price, large && styles.priceLarge]}>{formatEUR(pricePerDay)}</Text>
      <Text style={[styles.unit, large && styles.unitLarge]}> / day</Text>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  price: { fontSize: 16, fontWeight: '700', color: C.text },
  priceLarge: { fontSize: 24 },
  unit: { fontSize: 13, color: C.textSecondary },
  unitLarge: { fontSize: 16 },
  })
}
