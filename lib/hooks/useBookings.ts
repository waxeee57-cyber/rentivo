import { useState, useEffect, useCallback } from 'react'
import { fetchUserBookings, fetchBooking, fetchHostBookings } from '@/lib/api/bookings'
import type { Booking } from '@/types'

export function useBookings(userId: string | null) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    fetchUserBookings(userId)
      .then(data => { if (!cancelled) setBookings(data) })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId, tick])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { bookings, loading, error, refetch }
}

export function useHostBookings(hostId: string | null) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!hostId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    fetchHostBookings(hostId)
      .then(data => { if (!cancelled) setBookings(data) })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hostId, tick])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { bookings, loading, error, refetch }
}

export function useBooking(id: string | null) {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    fetchBooking(id)
      .then(data => { if (!cancelled) setBooking(data) })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  return { booking, loading, error }
}
