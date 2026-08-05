import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Radius, Spacing, Shadow, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface CategoryPillProps {
  label: string
  icon?: React.ComponentProps<typeof Ionicons>['name']
  active?: boolean
  onPress?: () => void
  style?: ViewStyle
}

export function CategoryPill({ label, icon, active = false, onPress, style }: CategoryPillProps) {
  const C = useColors()

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pill,
        {
          // Ink-filled active state — auto-themes across light/dark
          borderColor: active ? C.text : C.border,
          backgroundColor: active ? C.text : C.surface,
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
          color={active ? C.background : C.textSecondary}
          style={styles.icon}
        />
      )}
      <Text style={[styles.label, { color: active ? C.background : C.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    // 44 is the project minimum touch target (was 36). minHeight does the work
    // here — the 13px label only needs ~18px — so paddingVertical drops to 4:
    // at default text size the pill is 44 either way, and at large accessibility
    // font scales the smaller padding stops it ballooning past 44.
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginRight: Spacing.sm,
    // Shared elevation token instead of a one-off pure-black shadow. The active
    // state still overrides shadowOpacity/elevation inline to lift the pill,
    // and Shadow.sm supplies an elevation so Android renders the inactive one.
    ...Shadow.sm,
  },
  icon: { marginRight: 4 },
  label: { fontSize: 13, fontFamily: Fonts.medium },
})
