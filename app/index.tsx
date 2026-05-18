import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Redirect, router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import { useColors } from '@/lib/hooks/useColors'
import type { UserRole } from '@/types'

export default function Index() {
  const C = useColors()
  const { role, setRole, setLanguage } = useAuthStore()
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const check = async () => {
      // Auto-detect language on first launch
      try {
        const storedLang = await AsyncStorage.getItem('user_language')
        if (!storedLang) {
          const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en'
          const detected: 'en' | 'es' | 'hu' =
            locale.startsWith('es') ? 'es' :
            locale.startsWith('hu') ? 'hu' :
            'en'
          setLanguage(detected)
          await AsyncStorage.setItem('user_language', detected)
        }
      } catch {}

      // Check if onboarding has been completed
      try {
        const done = await AsyncStorage.getItem('onboarding_complete')
        if (done !== 'true') {
          setShowOnboarding(true)
        }
      } catch {}
      setOnboardingChecked(true)
    }
    void check()
  }, [setLanguage])

  const handleOnboardingComplete = async (selectedRole?: UserRole) => {
    await AsyncStorage.setItem('onboarding_complete', 'true')
    if (selectedRole) {
      setRole(selectedRole)
    }
    setShowOnboarding(false)

    // Navigate based on role
    const r = selectedRole ?? role
    if (r === 'operator') router.replace('/(operator)/dashboard')
    else if (r === 'host') router.replace('/(host)/listings')
    else router.replace('/(consumer)/explore')
  }

  if (!onboardingChecked) {
    return <View style={{ flex: 1, backgroundColor: C.background }} />
  }

  if (showOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />
  }

  if (Config.useMock) {
    if (role === 'operator') return <Redirect href="/(operator)/dashboard" />
    if (role === 'host') return <Redirect href="/(host)/listings" />
    return <Redirect href="/(consumer)/explore" />
  }

  if (role === 'operator') return <Redirect href="/(operator)/dashboard" />
  if (role === 'host') return <Redirect href="/(host)/listings" />
  if (role === 'consumer') return <Redirect href="/(consumer)/explore" />
  // No role set — send to role selection screen
  return <Redirect href="/auth" />
}
