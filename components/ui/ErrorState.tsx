import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Fonts } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { useColors } from '@/lib/hooks/useColors'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = 'Something went wrong', onRetry }: ErrorStateProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.container}>
      <Ionicons
        name="warning-outline"
        size={48}
        color={C.warning}
        style={styles.icon}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={styles.title}>Oops!</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button title="Try again" onPress={onRetry} variant="secondary" style={{ marginTop: Spacing.lg }} />
      )}
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },
  icon: { marginBottom: Spacing.base },
  title: { fontSize: 20, fontFamily: Fonts.bold, color: C.text, marginBottom: Spacing.sm },
  message: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
  })
}
