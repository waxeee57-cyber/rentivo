import { useEffect } from 'react'
import * as Location from 'expo-location'
import { useLocationStore } from '@/lib/store/useLocationStore'

export function useLocation() {
  const { latitude, longitude, setLocation } = useLocationStore()

  useEffect(() => {
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const loc = await Location.getCurrentPositionAsync({})
      setLocation(loc.coords.latitude, loc.coords.longitude)
    })()
  }, [setLocation])

  return { latitude, longitude }
}
