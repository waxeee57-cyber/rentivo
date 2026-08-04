import React, { useMemo } from 'react'
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { Spacing, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface LoadingOverlayProps {
  message?: string
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <ActivityIndicator size="large" color={C.primary} />
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  box: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  message: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary },
  })
}
