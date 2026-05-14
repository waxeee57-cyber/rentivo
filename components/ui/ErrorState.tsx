import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing } from '@/constants/colors'
import { Button } from '@/components/ui/Button'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = 'Something went wrong', onRetry }: ErrorStateProps) {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },
  emoji: { fontSize: 48, marginBottom: Spacing.base },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  message: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
})
