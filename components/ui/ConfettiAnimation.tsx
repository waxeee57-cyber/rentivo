import React, { useRef, useEffect, useMemo } from 'react'
import { StyleSheet, View, Animated, Dimensions } from 'react-native'

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
  const translateY = useRef(new Animated.Value(-20)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.delay(config.delay),
        Animated.timing(translateY, { toValue: height + 80, duration: 2200, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(config.delay),
        Animated.timing(opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    ]).start()
  }, [])

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: config.color,
          width: config.size,
          height: config.size,
          borderRadius: config.size * 0.25,
          opacity,
          transform: [
            { translateX: config.x },
            { translateY },
          ],
        },
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
