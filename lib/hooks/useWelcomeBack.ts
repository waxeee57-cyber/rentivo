import { useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const LAST_OPENED_KEY = 'rentivo_last_opened'
const DAYS_THRESHOLD = 7

export function useWelcomeBack() {
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const raw = await AsyncStorage.getItem(LAST_OPENED_KEY)
        const now = Date.now()

        if (raw) {
          const lastOpened = parseInt(raw, 10)
          const daysSince = (now - lastOpened) / (1000 * 60 * 60 * 24)
          if (daysSince >= DAYS_THRESHOLD) {
            setShowWelcomeBack(true)
          }
        }

        await AsyncStorage.setItem(LAST_OPENED_KEY, String(now))
      } catch {
        // AsyncStorage unavailable
      }
    }
    void check()
  }, [])

  const dismiss = () => setShowWelcomeBack(false)

  return { showWelcomeBack, dismiss }
}
