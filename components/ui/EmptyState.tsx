import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Typography } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { Button } from '@/components/ui/Button'

interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Ionicons>['name']
  title: string
  subtitle?: string
  action?: { label: string; onPress: () => void }
  secondaryAction?: { label: string; onPress: () => void }
}

export function EmptyState({ icon, title, subtitle, action, secondaryAction }: EmptyStateProps) {
  const C = useColors()
  const iconName = icon ?? 'file-tray-outline'

  return (
    <View style={styles.container}>
      {/* Purely decorative — the icon repeats what the title already says.
          Both props are needed: `accessibilityElementsHidden` is the iOS
          switch, `no-hide-descendants` the Android one (plain "no" on a
          parent still leaves its children focusable). */}
      <View
        style={[styles.emojiWrap, { backgroundColor: C.surfaceWarm, borderColor: C.borderWarm }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons name={iconName} size={40} color={C.textTertiary} importantForAccessibility="no" />
      </View>
      {/* Announced as ONE element: a screen reader reads "No trips yet.
          Your booked stays will show up here." instead of stopping twice. */}
      <View accessible accessibilityRole="text" style={styles.textGroup}>
        <Text style={[styles.title, { color: C.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: C.textSecondary }]}>{subtitle}</Text>}
      </View>
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
  // stretch + center keeps the wrapped Texts at the exact width and
  // alignment they had as direct children of `container`.
  textGroup: { alignSelf: 'stretch', alignItems: 'center' },
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
