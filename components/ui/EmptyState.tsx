import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing, Radius, Typography } from '@/constants/colors'
import { Button } from '@/components/ui/Button'

interface EmptyStateProps {
  emoji?: string
  title: string
  subtitle?: string
  action?: { label: string; onPress: () => void }
  secondaryAction?: { label: string; onPress: () => void }
}

export function EmptyState({ emoji = '📭', title, subtitle, action, secondaryAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.emojiWrap}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
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
    backgroundColor: Colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderWarm,
  },
  emoji: { fontSize: 56 },
  title: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
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
