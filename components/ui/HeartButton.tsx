import React, { useRef } from 'react'
import { Pressable, Animated, StyleSheet, ViewStyle } from 'react-native'
import { notificationAsync, NotificationFeedbackType } from 'expo-haptics'

interface HeartButtonProps {
  isWishlisted: boolean
  onToggle: () => void
  size?: number
  containerStyle?: ViewStyle
}

export function HeartButton({ isWishlisted, onToggle, size = 24, containerStyle }: HeartButtonProps) {
  const scale = useRef(new Animated.Value(1)).current
  const rotation = useRef(new Animated.Value(0)).current

  const rotationDeg = rotation.interpolate({
    inputRange: [-15, 0, 15],
    outputRange: ['-15deg', '0deg', '15deg'],
  })

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.4, damping: 5, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 0.9, damping: 8, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 10, useNativeDriver: true }),
    ]).start()

    Animated.sequence([
      Animated.timing(rotation, { toValue: -15, duration: 100, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: 15, duration: 100, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start()

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
      <Animated.Text style={{ fontSize: size, transform: [{ scale }, { rotate: rotationDeg }] }}>
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
