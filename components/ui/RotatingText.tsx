import React, { useState, useEffect } from 'react'
import { TextStyle } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
  cancelAnimation,
} from 'react-native-reanimated'

interface RotatingTextProps {
  words: string[]
  style?: TextStyle
  interval?: number
}

export function RotatingText({ words, style, interval = 2500 }: RotatingTextProps) {
  const [index, setIndex] = useState(0)
  const opacity = useSharedValue(1)
  const translateY = useSharedValue(0)

  useEffect(() => {
    const timer = setInterval(() => {
      opacity.value = withTiming(0, { duration: 220 })
      translateY.value = withTiming(-14, { duration: 220 })

      const swap = setTimeout(() => {
        setIndex(i => (i + 1) % words.length)
        translateY.value = 14
        opacity.value = withTiming(1, { duration: 220 })
        translateY.value = withTiming(0, { duration: 220 })
      }, 230)

      return () => clearTimeout(swap)
    }, interval)

    return () => {
      clearInterval(timer)
      cancelAnimation(opacity)
      cancelAnimation(translateY)
    }
  }, [words.length, interval])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.Text style={[style, animatedStyle]}>
      {words[index]}
    </Animated.Text>
  )
}
