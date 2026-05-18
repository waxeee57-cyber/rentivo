import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Radius, Spacing } from '@/constants/colors'
import type { BookingStatus } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | BookingStatus

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  style?: ViewStyle
}

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const VARIANT_COLORS: Record<string, { bg: string; text: string }> = {
    success:   { bg: C.successSurface, text: C.success },
    warning:   { bg: C.warningSurface, text: C.primaryDark },
    error:     { bg: C.errorSurface,   text: C.error },
    info:      { bg: C.infoSurface,    text: C.info },
    neutral:   { bg: C.surfaceWarm,    text: C.textSecondary },
    pending:   { bg: C.warningSurface, text: C.primaryDark },
    confirmed: { bg: C.successSurface, text: C.success },
    active:    { bg: C.primarySurface, text: C.primaryDark },
    completed: { bg: C.surfaceWarm,    text: C.textSecondary },
    cancelled: { bg: C.errorSurface,   text: C.error },
    disputed:  { bg: C.errorSurface,   text: C.error },
  }
  const colors = VARIANT_COLORS[variant] ?? VARIANT_COLORS.neutral
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '600' },
  })
}
