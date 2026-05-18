import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Spacing, Typography } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { Button } from '@/components/ui/Button'

interface EmptyStateProps {
  emoji?: string
  title: string
  subtitle?: string
  action?: { label: string; onPress: () => void }
  secondaryAction?: { label: string; onPress: () => void }
}

export function EmptyState({ emoji = '📭', title, subtitle, action, secondaryAction }: EmptyStateProps) {
  const C = useColors()

  return (
    <View style={styles.container}>
      <View style={[styles.emojiWrap, { backgroundColor: C.surfaceWarm, borderColor: C.borderWarm }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={[styles.title, { color: C.text }]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: C.textSecondary }]}>{subtitle}</Text>}
      {action && (
        <Button
          title={action.label}
          onPress={action.onPress}
          style={styles.actionBtn}
        />
      )}
      {secondaryAction && (
        <Button
          title={secondaryAction.label}
          onPress={secondaryAction.onPress}
          variant="ghost"
          style={{ marginTop: Spacing.sm }}
        />
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
    minHeight: 300,
    maxWidth: '100%',
    alignSelf: 'center',
    width: '100%',
  },
  emojiWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
  },
  emoji: { fontSize: 56 },
  title: {
    ...Typography.h3,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    marginTop: Spacing.xl,
    minWidth: 200,
  },
})
