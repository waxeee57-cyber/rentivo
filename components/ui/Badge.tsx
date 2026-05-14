import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Colors, Radius, Spacing } from '@/constants/colors'
import type { BookingStatus } from '@/types'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | BookingStatus

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  style?: ViewStyle
}

const VARIANT_COLORS: Record<string, { bg: string; text: string }> = {
  success:   { bg: Colors.successSurface, text: Colors.success },
  warning:   { bg: Colors.warningSurface, text: Colors.primaryDark },
  error:     { bg: Colors.errorSurface,   text: Colors.error },
  info:      { bg: Colors.infoSurface,    text: Colors.info },
  neutral:   { bg: Colors.surfaceWarm,    text: Colors.textSecondary },
  pending:   { bg: Colors.warningSurface, text: Colors.primaryDark },
  confirmed: { bg: Colors.successSurface, text: Colors.success },
  active:    { bg: Colors.primarySurface, text: Colors.primaryDark },
  completed: { bg: Colors.surfaceWarm,    text: Colors.textSecondary },
  cancelled: { bg: Colors.errorSurface,   text: Colors.error },
  disputed:  { bg: Colors.errorSurface,   text: Colors.error },
}

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const colors = VARIANT_COLORS[variant] ?? VARIANT_COLORS.neutral
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '600' },
})
