import React, { useState, useEffect, useRef } from 'react'
import { Animated, TextStyle } from 'react-native'

interface RotatingTextProps {
  words: string[]
  style?: TextStyle
  interval?: number
}

export function RotatingText({ words, style, interval = 2500 }: RotatingTextProps) {
  const [index, setIndex] = useState(0)
  const opacity = useRef(new Animated.Value(1)).current
  const translateY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -14, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setIndex(i => (i + 1) % words.length)
        translateY.setValue(14)
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start()
      })
    }, interval)

    return () => clearInterval(timer)
  }, [words.length, interval])

  return (
    <Animated.Text style={[style, { opacity, transform: [{ translateY }] }]}>
      {words[index]}
    </Animated.Text>
  )
}
