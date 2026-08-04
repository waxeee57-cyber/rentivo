import { useEffect } from 'react'
import * as Location from 'expo-location'
import { useLocationStore } from '@/lib/store/useLocationStore'

export function useLocation() {
  const { latitude, longitude, setLocation } = useLocationStore()

  useEffect(() => {
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const servicesOn = await Location.hasServicesEnabledAsync()
        if (!servicesOn) return
        const loc = await Location.getCurrentPositionAsync({})
        setLocation(loc.coords.latitude, loc.coords.longitude)
      } catch {
        // Location unavailable (services off, emulator without GPS, denied at OS level, etc.)
        // — silently fall back to no-location state instead of an uncaught rejection.
      }
    })()
  }, [setLocation])

  return { latitude, longitude }
}
