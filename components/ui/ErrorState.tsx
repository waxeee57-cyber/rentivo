import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Spacing } from '@/constants/colors'
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
      <Text style={styles.emoji}>⚠️</Text>
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
  emoji: { fontSize: 48, marginBottom: Spacing.base },
  title: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: Spacing.sm },
  message: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
  })
}
