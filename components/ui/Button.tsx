import React from 'react'
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native'
import { Radius, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
  fullWidth?: boolean
  accessibilityLabel?: string
}

export function Button({
  title, onPress, variant = 'primary',
  loading = false, disabled = false,
  style, textStyle, fullWidth = false,
  accessibilityLabel,
}: ButtonProps) {
  const C = useColors()
  const isDisabled = disabled || loading

  const variantContainerStyle: ViewStyle = (() => {
    switch (variant) {
      case 'primary':   return { backgroundColor: C.primary }
      case 'secondary': return { backgroundColor: C.primarySurface, borderWidth: 1, borderColor: C.primary }
      case 'ghost':     return { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border }
      case 'danger':    return { backgroundColor: C.errorSurface, borderWidth: 1, borderColor: C.error }
    }
  })()

  const variantTextColor: TextStyle = (() => {
    switch (variant) {
      case 'primary':   return { color: C.textInverse }
      case 'secondary': return { color: C.primary }
      case 'ghost':     return { color: C.textSecondary }
      case 'danger':    return { color: C.error }
    }
  })()

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        variantContainerStyle,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.8}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? C.textInverse : C.primary} size="small" />
        : <Text style={[styles.text, variantTextColor, textStyle]}>{title}</Text>}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  text: { fontSize: 15, fontWeight: '600' },
})
