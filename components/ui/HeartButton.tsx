import React from 'react'
import { Pressable, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSequence, withSpring, withTiming,
} from 'react-native-reanimated'
import { notificationAsync, NotificationFeedbackType } from 'expo-haptics'

interface HeartButtonProps {
  isWishlisted: boolean
  onToggle: () => void
  size?: number
  containerStyle?: ViewStyle
}

export function HeartButton({ isWishlisted, onToggle, size = 24, containerStyle }: HeartButtonProps) {
  const scale = useSharedValue(1)
  const rotation = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }))

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(1.4, { damping: 5, stiffness: 300 }),
      withSpring(0.9, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 10, stiffness: 300 }),
    )
    rotation.value = withSequence(
      withTiming(-15, { duration: 100 }),
      withTiming(15, { duration: 100 }),
      withTiming(0, { duration: 100 }),
    )
    void notificationAsync(
      isWishlisted ? NotificationFeedbackType.Warning : NotificationFeedbackType.Success
    )
    onToggle()
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.container, containerStyle]}
      accessibilityLabel={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      accessibilityRole="button"
    >
      <Animated.Text style={[{ fontSize: size }, animatedStyle]}>
        {isWishlisted ? '❤️' : '🤍'}
      </Animated.Text>
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
