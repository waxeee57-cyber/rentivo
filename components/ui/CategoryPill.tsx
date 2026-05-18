import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Radius, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface CategoryPillProps {
  label: string
  emoji?: string
  icon?: React.ComponentProps<typeof Ionicons>['name']
  active?: boolean
  onPress?: () => void
  style?: ViewStyle
}

export function CategoryPill({ label, emoji, icon, active = false, onPress, style }: CategoryPillProps) {
  const C = useColors()

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pill,
        {
          borderColor: active ? C.primary : C.border,
          backgroundColor: active ? C.primary : C.surface,
          shadowOpacity: active ? 0.12 : 0.04,
          elevation: active ? 3 : 1,
        },
        style,
      ]}
      activeOpacity={0.7}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={14}
          color={active ? C.textInverse : C.textSecondary}
          style={styles.icon}
        />
      )}
      {emoji && !icon && <Text style={styles.emoji}>{emoji}</Text>}
      <Text style={[styles.label, { color: active ? C.textInverse : C.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginRight: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  icon: { marginRight: 4 },
  emoji: { fontSize: 14, marginRight: 4 },
  label: { fontSize: 13, fontWeight: '500' },
})
