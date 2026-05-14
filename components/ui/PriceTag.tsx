import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing } from '@/constants/colors'
import { formatEUR } from '@/lib/utils/formatCurrency'

interface PriceTagProps {
  pricePerDay: number
  large?: boolean
}

export function PriceTag({ pricePerDay, large = false }: PriceTagProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.price, large && styles.priceLarge]}>{formatEUR(pricePerDay)}</Text>
      <Text style={[styles.unit, large && styles.unitLarge]}> / day</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  price: { fontSize: 16, fontWeight: '700', color: Colors.text },
  priceLarge: { fontSize: 24 },
  unit: { fontSize: 13, color: Colors.textSecondary },
  unitLarge: { fontSize: 16 },
})
