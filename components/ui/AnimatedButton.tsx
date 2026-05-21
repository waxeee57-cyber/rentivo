import React, { useMemo } from 'react'
import {
  Pressable, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics'
import { Radius, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface AnimatedButtonProps {
  title: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
  fullWidth?: boolean
  accessibilityLabel?: string
  haptic?: boolean
}

export function AnimatedButton({
  title, onPress, variant = 'primary',
  loading = false, disabled = false,
  style, textStyle, fullWidth = false,
  accessibilityLabel, haptic = true,
}: AnimatedButtonProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const scale = useSharedValue(1)
  const isDisabled = disabled || loading

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPressIn={() => {
        if (isDisabled) return
        scale.value = withSpring(0.95, { damping: 12, stiffness: 200 })
        if (haptic) void impactAsync(ImpactFeedbackStyle.Light)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 })
      }}
      onPress={isDisabled ? undefined : onPress}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
    >
      <Animated.View style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        animatedStyle,
        style,
      ]}>
        {loading
          ? <ActivityIndicator
              color={variant === 'primary' ? C.textInverse : C.primary}
              size="small"
            />
          : <Text style={[
              styles.text,
              variant === 'primary' && styles.primaryText,
              variant === 'secondary' && styles.secondaryText,
              variant === 'ghost' && styles.ghostText,
              variant === 'danger' && styles.dangerText,
              textStyle,
            ]}>
              {title}
            </Text>
        }
      </Animated.View>
    </Pressable>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  fullWidth: { alignSelf: 'stretch' },
  primary: { backgroundColor: C.primary },
  secondary: { backgroundColor: C.primarySurface, borderWidth: 1, borderColor: C.primary },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  danger: { backgroundColor: C.errorSurface, borderWidth: 1, borderColor: C.error },
  disabled: { opacity: 0.5 },
  text: { fontSize: 15, fontWeight: '600' },
  primaryText: { color: C.textInverse },
  secondaryText: { color: C.primary },
  ghostText: { color: C.textSecondary },
  dangerText: { color: C.error },
  })
}
