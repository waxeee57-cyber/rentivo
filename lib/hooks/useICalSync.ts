import { useState, useEffect, useCallback } from 'react'
import { performICalSync } from '@/lib/ical'

interface ICalSyncResult {
  syncing: boolean
  lastSynced: Date | null
  blockedDates: string[]
  error: string | null
  manualSync: () => void
}

export function useICalSync(icalUrl: string | null): ICalSyncResult {
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const sync = useCallback(async () => {
    if (!icalUrl) return
    setSyncing(true)
    setError(null)
    const result = await performICalSync({ ical_url: icalUrl })
    if (result.error) {
      setError(result.error)
    } else {
      setBlockedDates(result.blocked)
      setLastSynced(new Date())
    }
    setSyncing(false)
  }, [icalUrl])

  useEffect(() => {
    void sync()
    // Re-sync every 4 hours
    const interval = setInterval(() => { void sync() }, 4 * 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [sync])

  return {
    syncing,
    lastSynced,
    blockedDates,
    error,
    manualSync: () => { void sync() },
  }
}
