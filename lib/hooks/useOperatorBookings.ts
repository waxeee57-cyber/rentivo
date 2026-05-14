import { useState, useEffect, useCallback } from 'react'
import { fetchOperatorBookings } from '@/lib/api/bookings'
import type { Booking } from '@/types'

export function useOperatorBookings(operatorId: string | null) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!operatorId) { setLoading(false); return }
    setLoading(true)
    try {
      const data = await fetchOperatorBookings(operatorId)
      setBookings(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [operatorId])

  useEffect(() => { void load() }, [load])

  return { bookings, loading, error, refetch: load }
}
