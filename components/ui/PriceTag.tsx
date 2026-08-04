import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Spacing, Fonts } from '@/constants/colors'
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
  price: { fontSize: 16, fontFamily: Fonts.bold, color: C.text },
  priceLarge: { fontFamily: Fonts.regular, fontSize: 24 },
  unit: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary },
  unitLarge: { fontFamily: Fonts.regular, fontSize: 16 },
  })
}
