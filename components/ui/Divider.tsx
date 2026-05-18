import React, { useMemo } from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { Colors, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface DividerProps {
  style?: ViewStyle
}

export function Divider({ style }: DividerProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return <View style={[styles.divider, style]} />
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: Spacing.base,
  },
  })
}
