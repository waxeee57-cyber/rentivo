import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Spacing } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { formatEUR, formatEURDecimal } from '@/lib/utils/formatCurrency'

interface BookingBarProps {
  pricePerDay: number
  totalDays?: number
  totalAmount?: number
  onPress: () => void
  disabled?: boolean
}

export function BookingBar({ pricePerDay, totalDays, totalAmount, onPress, disabled }: BookingBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + Spacing.sm }]}>
      <View style={styles.left}>
        <Text style={styles.price}>{formatEUR(pricePerDay)}</Text>
        <Text style={styles.unit}> / day</Text>
        {totalDays && totalAmount && (
          <Text style={styles.total}>{`${totalDays} days · ${formatEURDecimal(totalAmount)}`}</Text>
        )}
      </View>
      <Button
        title={disabled ? 'Select dates first' : 'Book now'}
        onPress={onPress}
        disabled={disabled}
        style={styles.button}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  left: { flex: 1 },
  price: { fontSize: 20, fontWeight: '700', color: Colors.text },
  unit: { fontSize: 13, color: Colors.textSecondary },
  total: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  button: { marginLeft: Spacing.base },
})
