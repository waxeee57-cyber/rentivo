import { useState, useEffect, useCallback } from 'react'
import { fetchOperatorListings, toggleListingAvailability } from '@/lib/api/listings'
import type { Listing } from '@/types'

export function useFleet(operatorId: string | null) {
  const [fleet, setFleet] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!operatorId) { setLoading(false); return }
    setLoading(true)
    try {
      const data = await fetchOperatorListings(operatorId)
      setFleet(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [operatorId])

  useEffect(() => { void load() }, [load])

  const toggleAvailability = async (id: string, available: boolean) => {
    await toggleListingAvailability(id, available)
    setFleet(prev => prev.map(l => l.id === id ? { ...l, available } : l))
  }

  return { fleet, loading, error, refetch: load, toggleAvailability }
}
