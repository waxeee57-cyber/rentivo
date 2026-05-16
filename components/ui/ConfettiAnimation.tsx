import React, { useEffect, useMemo } from 'react'
import { StyleSheet, View, Dimensions } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence,
  cancelAnimation,
} from 'react-native-reanimated'

const { width, height } = Dimensions.get('window')
const COLORS = ['#E8A44A', '#10B981', '#6366F1', '#EC4899', '#F59E0B', '#FFFFFF', '#3B82F6']

interface ParticleConfig {
  id: number
  color: string
  x: number
  delay: number
  rotation: number
  size: number
}

function ConfettiParticle({ config }: { config: ParticleConfig }) {
  const translateY = useSharedValue(-20)
  const opacity = useSharedValue(0)

  useEffect(() => {
    translateY.value = withDelay(config.delay, withTiming(height + 80, { duration: 2200 }))
    opacity.value = withDelay(
      config.delay,
      withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(1, { duration: 1600 }),
        withTiming(0, { duration: 280 }),
      ),
    )
    return () => {
      cancelAnimation(translateY)
      cancelAnimation(opacity)
    }
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: config.x },
      { translateY: translateY.value },
      { rotate: `${config.rotation}deg` },
    ],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: config.color,
          width: config.size,
          height: config.size,
          borderRadius: config.size * 0.25,
        },
        style,
      ]}
    />
  )
}

export function ConfettiAnimation() {
  const particles = useMemo<ParticleConfig[]>(() => (
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      x: ((i * 37 + 17) % width) - width / 2,
      delay: (i * 53) % 800,
      rotation: (i * 61) % 360,
      size: 6 + (i % 3) * 3,
    }))
  ), [])

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map(config => (
        <ConfettiParticle key={config.id} config={config} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    left: '50%',
  },
})
