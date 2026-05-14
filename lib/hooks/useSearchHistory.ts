import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'rentivo_search_history'
const MAX_ITEMS = 5

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) setHistory(JSON.parse(raw) as string[])
      })
      .catch(() => {})
  }, [])

  const addSearch = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    setHistory(prev => {
      const filtered = prev.filter(h => h.toLowerCase() !== trimmed.toLowerCase())
      const next = [trimmed, ...filtered].slice(0, MAX_ITEMS)
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const clearHistory = useCallback(async () => {
    setHistory([])
    await AsyncStorage.removeItem(STORAGE_KEY)
  }, [])

  return { history, addSearch, clearHistory }
}
