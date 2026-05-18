import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { formatEUR, formatEURDecimal } from '@/lib/utils/formatCurrency'
import { useColors } from '@/lib/hooks/useColors'

interface BookingBarProps {
  pricePerDay: number
  totalDays?: number
  totalAmount?: number
  onPress: () => void
  disabled?: boolean
}

export function BookingBar({ pricePerDay, totalDays, totalAmount, onPress, disabled }: BookingBarProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const insets = useSafeAreaInsets()

  const handlePress = () => {
    if (!disabled) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onPress()
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + Spacing.sm }]}>
      <View style={styles.left}>
        <Text style={styles.price}>{formatEUR(pricePerDay)}</Text>
        <Text style={styles.unit}> / day</Text>
        {totalDays && totalAmount && (
          <Text style={styles.total}>{`${totalDays} days · ${formatEURDecimal(totalAmount)}`}</Text>
        )}
      </View>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.85}
        style={[styles.bookBtn, disabled && styles.bookBtnDisabled]}
      >
        <Text style={styles.bookBtnText}>
          {disabled ? 'Select dates first' : 'Book now'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  left: { flex: 1 },
  price: { fontSize: 20, fontWeight: '700', color: C.text },
  unit: { fontSize: 13, color: C.textSecondary },
  total: { fontSize: 12, color: C.textTertiary, marginTop: 2 },
  bookBtn: {
    minHeight: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginLeft: Spacing.base,
  },
  bookBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  bookBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textInverse,
  },
  })
}
