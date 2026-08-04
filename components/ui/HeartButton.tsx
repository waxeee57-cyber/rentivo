import React, { useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, ViewStyle } from 'react-native'
import { useColors } from '@/lib/hooks/useColors'
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring, withTiming,
} from 'react-native-reanimated'
import { notificationAsync, NotificationFeedbackType } from 'expo-haptics'

// Two-stage pop: a quick 18% swell, then a settle. The old version ran
// 1.4 -> 0.9 -> 1.0 at damping 5, which visibly bounced; at damping >= 15 the
// heart acknowledges the tap without turning into a toy.
const POP_IN = { damping: 15, stiffness: 420 } as const
const SETTLE = { damping: 18, stiffness: 320 } as const

// +/-6 degrees over ~210ms. Enough to read as a nudge, small enough that it
// never looks like the icon is wobbling loose.
const TILT_DEG = 6
const TILT_STEP_MS = 70

interface HeartButtonProps {
  isWishlisted: boolean
  onToggle: () => void
  size?: number
  containerStyle?: ViewStyle
}

export function HeartButton({ isWishlisted, onToggle, size = 24, containerStyle }: HeartButtonProps) {
  const C = useColors()
  const scale = useSharedValue(1)
  const rotate = useSharedValue(0)

  // Both values live on the UI thread, so the heart keeps animating even
  // while the wishlist mutation is in flight on the JS thread.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }))

  const handlePress = useCallback(() => {
    scale.value = withSequence(withSpring(1.18, POP_IN), withSpring(1, SETTLE))
    rotate.value = withSequence(
      withTiming(-TILT_DEG, { duration: TILT_STEP_MS }),
      withTiming(TILT_DEG, { duration: TILT_STEP_MS }),
      withTiming(0, { duration: TILT_STEP_MS }),
    )

    // Add vs. remove get different signatures so the outcome is legible
    // without looking. Rejection swallowed: no haptic engine must not break
    // the toggle itself.
    notificationAsync(
      isWishlisted ? NotificationFeedbackType.Warning : NotificationFeedbackType.Success,
    ).catch(() => {})

    onToggle()
  }, [isWishlisted, onToggle, scale, rotate])

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.container, containerStyle]}
      accessibilityLabel={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      accessibilityRole="button"
      // `selected` lets a screen reader announce the current state rather than
      // only the action the label describes.
      accessibilityState={{ selected: isWishlisted }}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={isWishlisted ? 'heart' : 'heart-outline'}
          size={size}
          color={isWishlisted ? C.error : C.white}
          importantForAccessibility="no"
        />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
