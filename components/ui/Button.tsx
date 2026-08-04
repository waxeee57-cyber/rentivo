import React, { useCallback } from 'react'
import {
  Pressable, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics'
import { Radius, Spacing, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

// A Pressable wrapped by Reanimated rather than a Pressable *containing* an
// Animated.View: the button stays ONE box, so the `style` prop keeps landing
// on the exact element it did under the old TouchableOpacity. That is what
// lets all 29 call sites keep their margins/minWidth/flex without reflowing.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Quiet-luxury press: a 4% dip, not a bounce. High stiffness + damping 15 is
// effectively critically damped, so it settles in ~150ms and never overshoots
// past its resting size on release.
const PRESS_SPRING = { damping: 15, stiffness: 400 } as const

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
  const scale = useSharedValue(1)

  // Runs on the UI thread — the scale never crosses the JS bridge, so the
  // press stays responsive even while a submit handler blocks JS.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = useCallback(() => {
    if (isDisabled) return
    scale.value = withSpring(0.96, PRESS_SPRING)
  }, [isDisabled, scale])

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_SPRING)
  }, [scale])

  const handlePress = useCallback(() => {
    if (isDisabled) return
    // .catch swallows the rejection on platforms with no haptic engine
    // (web, older simulators) — a missing taptic must never break a tap.
    impactAsync(ImpactFeedbackStyle.Light).catch(() => {})
    onPress()
  }, [isDisabled, onPress])

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
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        styles.base,
        variantContainerStyle,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
        // Last so the transform survives a caller-supplied `style`.
        animatedStyle,
      ]}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? C.textInverse : C.primary} size="small" />
        : <Text style={[styles.text, variantTextColor, textStyle]}>{title}</Text>}
    </AnimatedPressable>
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
  text: { fontSize: 15, fontFamily: Fonts.semibold },
})
