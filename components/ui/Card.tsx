import React, { useMemo } from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { Colors, Radius, Spacing } from '@/constants/colors'
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 2,
  },
  })
}
