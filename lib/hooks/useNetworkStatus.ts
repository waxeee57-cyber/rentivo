import { useState, useEffect, useRef, useCallback } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { useToastStore } from '@/lib/store/useToastStore'

async function checkConnectivity(): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      signal: ctrl.signal,
      cache: 'no-store',
    })
    clearTimeout(id)
    return res.ok
  } catch {
    return false
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const wasOfflineRef = useRef(false)
  const { showToast } = useToastStore()

  const handleConnectivityChange = useCallback(async () => {
    const online = await checkConnectivity()
    if (!online && !wasOfflineRef.current) {
      wasOfflineRef.current = true
      showToast({ message: 'No internet connection', type: 'error' })
    }
    if (online && wasOfflineRef.current) {
      wasOfflineRef.current = false
      showToast({ message: 'Back online ✓', type: 'success' })
    }
    setIsOnline(online)
  }, [showToast])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void handleConnectivityChange()
    })
    return () => sub.remove()
  }, [handleConnectivityChange])

  return { isOnline }
}
