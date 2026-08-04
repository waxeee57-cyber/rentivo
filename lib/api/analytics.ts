import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { MOCK_BOOKINGS } from '@/lib/mockData'
import type { Booking } from '@/types'

export interface OperatorAnalytics {
  totalRevenue: number
  totalBookings: number
  avgBookingValue: number
  occupancyRate: number
  bestListingId: string | null
  bestListingTitle: string | null
  bestListingRevenue: number
  revenueByPeriod: { label: string; amount: number }[]
}

type Period = 'week' | 'month' | 'quarter' | 'year'

/** Rows per round-trip while accumulating an operator's bookings for a period. */
const ANALYTICS_PAGE_SIZE = 500

/**
 * Safety ceiling — 40 pages ≈ 20 000 bookings for ONE operator in ONE period, well
 * past any real fleet. The select below is paged rather than capped because these
 * numbers are revenue: truncating to a single page would silently under-report an
 * operator's earnings, which is worse than a slightly slower screen. The ceiling
 * exists only so a pathological account cannot pull the table into memory.
 */
const ANALYTICS_MAX_PAGES = 40

function getPeriodStart(period: Period): Date {
  const now = new Date()
  switch (period) {
    case 'week':    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    case 'month':   return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    case 'quarter': return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    case 'year':    return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  }
}

function buildRevenueByPeriod(
  bookings: Booking[],
  period: Period,
): { label: string; amount: number }[] {
  const groups: Record<string, number> = {}
  for (const b of bookings) {
    const d = new Date(b.created_at)
    let key: string
    if (period === 'week') {
      key = d.toLocaleDateString('en-US', { weekday: 'short' })
    } else if (period === 'month') {
      key = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
    } else if (period === 'quarter') {
      key = d.toLocaleDateString('en-US', { month: 'short' })
    } else {
      key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }
    groups[key] = (groups[key] ?? 0) + (b.total_amount ?? 0)
  }
  return Object.entries(groups).map(([label, amount]) => ({ label, amount }))
}

export async function getOperatorAnalytics(
  operatorId: string,
  period: Period = 'month',
): Promise<OperatorAnalytics> {
  if (Config.useMock) {
    const bookings = MOCK_BOOKINGS.filter(
      b => b.status === 'completed' || b.status === 'confirmed',
    )
    const totalRevenue = bookings.reduce((s, b) => s + (b.total_amount ?? 0), 0)
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalBookings: bookings.length,
      avgBookingValue: bookings.length
        ? Math.round((totalRevenue / bookings.length) * 100) / 100
        : 0,
      occupancyRate: 72,
      bestListingId: bookings[0]?.listing_id ?? null,
      bestListingTitle: bookings[0]?.listing?.title ?? 'BMW 5 Series',
      bestListingRevenue: Math.round(totalRevenue * 0.4 * 100) / 100,
      revenueByPeriod: buildRevenueByPeriod(bookings, period),
    }
  }

  const periodStart = getPeriodStart(period)

  const bookings: Booking[] = []
  for (let page = 0; page < ANALYTICS_MAX_PAGES; page++) {
    const from = page * ANALYTICS_PAGE_SIZE
    const { data, error } = await supabase
      .from('rentivo_bookings')
      .select('*, listing:rentivo_listings(id,title)')
      .eq('operator_id', operatorId)
      .in('status', ['completed', 'confirmed'])
      .gte('created_at', periodStart.toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + ANALYTICS_PAGE_SIZE - 1)

    if (error != null || data == null) {
      return {
        totalRevenue: 0,
        totalBookings: 0,
        avgBookingValue: 0,
        occupancyRate: 0,
        bestListingId: null,
        bestListingTitle: null,
        bestListingRevenue: 0,
        revenueByPeriod: [],
      }
    }

    bookings.push(...(data as Booking[]))
    // A short page is the last page. Ordering is stable (created_at asc) so pages
    // cannot overlap or skip rows between round-trips.
    if (data.length < ANALYTICS_PAGE_SIZE) break
  }

  const totalRevenue = bookings.reduce((s, b) => s + (b.total_amount ?? 0), 0)

  // Best listing by revenue
  const revenueByListing: Record<string, { title: string; revenue: number }> = {}
  for (const b of bookings) {
    const lid = b.listing_id
    if (revenueByListing[lid] == null) {
      revenueByListing[lid] = { title: b.listing?.title ?? lid, revenue: 0 }
    }
    revenueByListing[lid].revenue += b.total_amount ?? 0
  }
  const bestEntry = Object.entries(revenueByListing).sort(
    (a, b) => b[1].revenue - a[1].revenue,
  )[0]

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalBookings: bookings.length,
    avgBookingValue: bookings.length
      ? Math.round((totalRevenue / bookings.length) * 100) / 100
      : 0,
    occupancyRate: Math.min(100, Math.round((bookings.length / 30) * 100)),
    bestListingId: bestEntry?.[0] ?? null,
    bestListingTitle: bestEntry?.[1]?.title ?? null,
    bestListingRevenue: bestEntry != null
      ? Math.round(bestEntry[1].revenue * 100) / 100
      : 0,
    revenueByPeriod: buildRevenueByPeriod(bookings, period),
  }
}
