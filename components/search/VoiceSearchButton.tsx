import React, { useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'

interface VoiceSearchButtonProps {
  onResult: (query: string) => void
}

const MOCK_RESULTS = [
  'convertible car',
  'BMW in Marbella',
  'yacht weekend',
  'scooter Dubrovnik',
]

export function VoiceSearchButton({ onResult }: VoiceSearchButtonProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [listening, setListening] = useState(false)
  const pulse = React.useRef(new Animated.Value(1)).current

  const startListening = async () => {
    if (listening) return
    setListening(true)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 500, useNativeDriver: true }),
      ]),
    ).start()

    if (Config.useMock) {
      // Simulate voice recognition after 2 seconds
      await new Promise<void>(r => setTimeout(r, 2000))
      const result = MOCK_RESULTS[Math.floor(Math.random() * MOCK_RESULTS.length)]
      setListening(false)
      pulse.stopAnimation()
      pulse.setValue(1)
      onResult(result)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }

  return (
    <TouchableOpacity
      onPress={() => void startListening()}
      disabled={listening}
      style={styles.wrapper}
      accessibilityLabel="Voice search"
      accessibilityRole="button"
      accessibilityHint="Tap to search by voice"
    >
      <Animated.View style={[styles.btn, { transform: [{ scale: pulse }] }, listening && styles.btnListening]}>
        <Text style={styles.icon}>{listening ? '🎤' : '🎙️'}</Text>
      </Animated.View>
      {listening && <Text style={styles.label}>Listening...</Text>}
    </TouchableOpacity>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 4 },
  btn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.primarySurface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.primaryLight,
  },
  btnListening: {
    backgroundColor: C.primary,
  },
  icon: { fontSize: 18 },
  label: { fontSize: 11, color: C.primary, fontWeight: '600' },
  })
}
