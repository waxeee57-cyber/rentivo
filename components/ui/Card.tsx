import React, { useMemo } from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { Radius, Spacing, Shadow } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle
  padding?: number
}

export function Card({ children, style, padding = Spacing.base }: CardProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  card: {
    backgroundColor: C.surfaceCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: C.border,
    // Shared elevation token instead of a one-off pure-black shadow at 0.3 —
    // 5x the design scale, which smeared grey over the warm light-mode
    // surfaces. Shadow.sm carries its own elevation, so Android still renders.
    ...Shadow.sm,
  },
  })
}
