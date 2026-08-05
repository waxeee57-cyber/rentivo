import { useState, useEffect, useCallback } from 'react'
import { fetchOperatorListings, toggleListingAvailability } from '@/lib/api/listings'
import { captureException } from '@/lib/sentry'
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

  /**
   * Returns whether the write actually landed.
   *
   * It used to update local state unconditionally, and the caller neither
   * awaited nor caught it — so a rejected promise became an unhandled rejection
   * while the screen showed "Vehicle paused" over a vehicle that was still
   * bookable. The optimistic update is kept (the switch has to move instantly)
   * but it is now rolled back when the write fails.
   */
  const toggleAvailability = async (id: string, available: boolean): Promise<boolean> => {
    setFleet(prev => prev.map(l => l.id === id ? { ...l, available } : l))
    try {
      await toggleListingAvailability(id, available)
      return true
    } catch (e) {
      setFleet(prev => prev.map(l => l.id === id ? { ...l, available: !available } : l))
      captureException(e, { where: 'useFleet.toggleAvailability', listingId: id })
      return false
    }
  }

  return { fleet, loading, error, refetch: load, toggleAvailability }
}
