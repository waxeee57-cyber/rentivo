import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, subMonths } from 'date-fns'
import { fetchHostListings } from '@/lib/api/listings'
import { fetchHostBookings } from '@/lib/api/bookings'
import { ownerPayout } from '@/lib/utils/payout'
import { Config } from '@/constants/config'
import { MOCK_HOST_LISTING, MOCK_BOOKINGS } from '@/lib/mockData'
import { captureException } from '@/lib/sentry'
import type { Booking, Listing } from '@/types'

/**
 * Money only counts once it has actually been PAID.
 *
 * `status` alone does not mean paid: a booking sits at status 'confirmed' with
 * payment_status 'pending' for the whole window between request and checkout,
 * and the dashboard used to add those up as earnings. Filtering on
 * payment_status is the only thing that means the money moved.
 */
function isPaid(b: Booking): boolean {
  return b.payment_status === 'paid'
}

/** Month bucket for a booking as 'YYYY-MM'. `start_date` is a DATE column. */
function monthKey(b: Booking): string {
  return (b.start_date ?? '').slice(0, 7)
}

/** Sum of what the HOST receives across the given bookings. */
function sumPayout(bookings: Booking[]): number {
  // ownerPayout, not `total_amount` and not `total_amount - platform_fee`: the
  // owner is transferred the rental SUBTOTAL (see lib/utils/payout.ts). The
  // gross also carries the damage waiver and delivery, which are not the host's.
  return Math.round(bookings.reduce((sum, b) => sum + ownerPayout(b), 0) * 100) / 100
}

export interface HostDashboardData {
  listings: Listing[]
  bookings: Booking[]
  recentBookings: Booking[]
  listingCount: number
  earningsThisMonth: number
  earningsLastMonth: number
  earningsAllTime: number
  upcomingPickups: number
  activeRentals: number
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Everything the host dashboard puts on screen, from one request lifecycle.
 *
 * The screen previously rendered a hardcoded €0 for last month and all time, and
 * a listings section written as `Config.useMock ? <fixture card> : <empty>` that
 * never fetched a host's listings at all. Both are derived here instead, so the
 * screen has one loading/error state to render rather than two half-wired ones.
 */
export function useHostDashboard(hostId: string | null | undefined): HostDashboardData {
  const [listings, setListings] = useState<Listing[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    if (Config.useMock) {
      // fetchHostListings' mock branch filters MOCK_LISTINGS on
      // `owner_type === 'host'`, and no entry in that array carries owner_type,
      // so it always returns []. The host fixture lives in MOCK_HOST_LISTING, so
      // read it from there and keep mock mode off Supabase entirely.
      setListings([MOCK_HOST_LISTING])
      setBookings(MOCK_BOOKINGS)
      setError(null)
      setLoading(false)
      return
    }

    // A host with no record yet has nothing to query. `.eq('host_id','')` would
    // be an invalid uuid comparison rather than an empty result.
    if (!hostId) {
      setListings([])
      setBookings([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    Promise.all([fetchHostListings(hostId), fetchHostBookings(hostId)])
      .then(([listingRows, bookingRows]) => {
        if (cancelled) return
        setListings(listingRows)
        setBookings(bookingRows)
      })
      .catch(e => {
        if (cancelled) return
        // An RLS denial or a dropped request is not something the host can act
        // on, and the old screen turned it into a confident €0. Report it and
        // let the screen say the numbers are missing.
        captureException(e, { hook: 'useHostDashboard', hostId })
        setError(String(e))
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [hostId, tick])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  const derived = useMemo(() => {
    const paid = bookings.filter(isPaid)
    const thisMonth = format(new Date(), 'yyyy-MM')
    const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM')
    const today = format(new Date(), 'yyyy-MM-dd')

    return {
      earningsThisMonth: sumPayout(paid.filter(b => monthKey(b) === thisMonth)),
      earningsLastMonth: sumPayout(paid.filter(b => monthKey(b) === lastMonth)),
      earningsAllTime: sumPayout(paid),
      // Pickups and rentals are operational counts, not money, so they are NOT
      // restricted to paid bookings — a pending request still needs collecting.
      upcomingPickups: bookings.filter(
        b => b.start_date >= today && (b.status === 'confirmed' || b.status === 'pending'),
      ).length,
      activeRentals: bookings.filter(b => b.status === 'active').length,
      recentBookings: bookings.slice(0, 3),
    }
  }, [bookings])

  return {
    listings,
    bookings,
    listingCount: listings.length,
    loading,
    error,
    refetch,
    ...derived,
  }
}
