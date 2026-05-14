import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native'
import { Colors, Radius, Spacing } from '@/constants/colors'

interface CategoryPillProps {
  label: string
  emoji?: string
  active?: boolean
  onPress?: () => void
  style?: ViewStyle
}

export function CategoryPill({ label, emoji, active = false, onPress, style }: CategoryPillProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive, style]}
      activeOpacity={0.7}
    >
      {emoji && <Text style={styles.emoji}>{emoji}</Text>}
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginRight: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowOpacity: 0.12,
    elevation: 3,
  },
  emoji: { fontSize: 14, marginRight: 4 },
  label: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  labelActive: { color: Colors.textInverse },
})
