import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Radius, Spacing, Fonts } from '@/constants/colors'
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
  // Status chips are passive — they must not borrow the CTA accent, which is
  // reserved for the primary button and the active tab. warning/pending used
  // primaryDark on an orange tint and active used the primary tint outright,
  // so an "Instant book" CTA and a "Pending" chip read as the same affordance.
  // Each variant now points at its own semantic pair:
  //   warning/pending -> warning ink on warning tint (5.70:1 light, 6.77:1 dark)
  //   active          -> info ink on info tint (5.18:1 light, 5.29:1 dark);
  //                      info keeps it distinct from confirmed (green),
  //                      pending (amber) and completed (neutral grey).
  const VARIANT_COLORS: Record<string, { bg: string; text: string }> = {
    success:   { bg: C.successSurface, text: C.success },
    warning:   { bg: C.warningSurface, text: C.warning },
    error:     { bg: C.errorSurface,   text: C.error },
    info:      { bg: C.infoSurface,    text: C.info },
    neutral:   { bg: C.surfaceWarm,    text: C.textSecondary },
    pending:   { bg: C.warningSurface, text: C.warning },
    confirmed: { bg: C.successSurface, text: C.success },
    active:    { bg: C.infoSurface,    text: C.info },
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
  text: { fontSize: 12, fontFamily: Fonts.semibold },
  })
}
