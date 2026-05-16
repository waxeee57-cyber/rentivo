import React, { useEffect } from 'react'
import { StyleSheet, View, ViewStyle, Dimensions } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, cancelAnimation,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, Radius } from '@/constants/colors'

const SCREEN_W = Dimensions.get('window').width

interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export function Skeleton({ width = '100%', height = 16, borderRadius = Radius.md, style }: SkeletonProps) {
  const shimmerX = useSharedValue(-SCREEN_W)

  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(SCREEN_W, { duration: 1100, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(shimmerX)
  }, [])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }))

  return (
    <View
      style={[
        { width: width as number, height, borderRadius, backgroundColor: Colors.border, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, width: SCREEN_W * 0.5 }}
        />
      </Animated.View>
    </View>
  )
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton height={160} borderRadius={12} style={{ marginBottom: 12 }} />
      <Skeleton height={16} width="70%" style={{ marginBottom: 8 }} />
      <Skeleton height={12} width="50%" style={{ marginBottom: 8 }} />
      <Skeleton height={14} width="40%" />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
})
