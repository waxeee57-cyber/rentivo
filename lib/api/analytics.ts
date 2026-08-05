import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { MOCK_BOOKINGS, MOCK_LISTINGS } from '@/lib/mockData'
import { calculateOccupancyRate } from '@/lib/utils/fleetOccupancy'
import type { Booking } from '@/types'

export interface OperatorAnalytics {
  totalRevenue: number
  totalBookings: number
  avgBookingValue: number
  /** null when the operator has no active listings, so the screen shows a dash. */
  occupancyRate: number | null
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

/**
 * Highest-earning listing in the set. The mock branch used to report
 * `bookings[0]` with a hardcoded 'BMW 5 Series' fallback title and a revenue of
 * `totalRevenue * 0.4`, so the "Top Performer" card showed a made-up number
 * beside a real-looking name. Both branches now derive it from the bookings.
 */
function bestListingFrom(bookings: Booking[]): {
  id: string | null
  title: string | null
  revenue: number
} {
  const byListing: Record<string, { title: string; revenue: number }> = {}
  for (const b of bookings) {
    const lid = b.listing_id
    if (byListing[lid] == null) {
      byListing[lid] = { title: b.listing?.title ?? lid, revenue: 0 }
    }
    byListing[lid].revenue += b.total_amount ?? 0
  }
  const best = Object.entries(byListing).sort((a, b) => b[1].revenue - a[1].revenue)[0]
  return {
    id: best?.[0] ?? null,
    title: best?.[1]?.title ?? null,
    revenue: best != null ? Math.round(best[1].revenue * 100) / 100 : 0,
  }
}

export async function getOperatorAnalytics(
  operatorId: string,
  period: Period = 'month',
): Promise<OperatorAnalytics> {
  const periodStart = getPeriodStart(period)
  const periodEnd = new Date()

  if (Config.useMock) {
    const bookings = MOCK_BOOKINGS.filter(
      b => (b.status === 'completed' || b.status === 'confirmed') &&
        b.payment_status === 'paid',
    )
    const totalRevenue = bookings.reduce((s, b) => s + (b.total_amount ?? 0), 0)
    const best = bestListingFrom(bookings)
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalBookings: bookings.length,
      avgBookingValue: bookings.length
        ? Math.round((totalRevenue / bookings.length) * 100) / 100
        : 0,
      // Was a hardcoded 72. Mock mode now runs the same maths as live mode so the
      // number moves when the mock data does.
      occupancyRate: calculateOccupancyRate(
        bookings,
        MOCK_LISTINGS.filter(l => l.available).length,
        periodStart,
        periodEnd,
      ),
      bestListingId: best.id,
      bestListingTitle: best.title,
      bestListingRevenue: best.revenue,
      revenueByPeriod: buildRevenueByPeriod(bookings, period),
    }
  }

  const bookings: Booking[] = []
  for (let page = 0; page < ANALYTICS_MAX_PAGES; page++) {
    const from = page * ANALYTICS_PAGE_SIZE
    const { data, error } = await supabase
      .from('rentivo_bookings')
      .select('*, listing:rentivo_listings(id,title)')
      .eq('operator_id', operatorId)
      .in('status', ['completed', 'confirmed'])
      // `status` alone does not mean the money arrived. A host can flip a booking
      // to 'confirmed' by hand before any payment (handleConfirm in
      // app/(host)/bookings/index.tsx), so unpaid bookings were being counted as
      // revenue and as occupancy. This is the same "money is real" test
      // create-booking uses when deciding which bookings hold inventory.
      .in('payment_status', ['paid', 'processing'])
      .gte('created_at', periodStart.toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + ANALYTICS_PAGE_SIZE - 1)

    if (error != null || data == null) {
      return {
        totalRevenue: 0,
        totalBookings: 0,
        avgBookingValue: 0,
        // A failed query knows nothing about the fleet, so it must not claim 0%.
        occupancyRate: null,
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
  const best = bestListingFrom(bookings)

  // Occupancy needs the fleet it is measured against. `available` is the
  // listing's own on/off switch, so an operator who parked half the fleet is not
  // charged for the vehicles they deliberately took off the market. head+count
  // keeps this to a COUNT query rather than pulling the rows.
  const { count: activeListings } = await supabase
    .from('rentivo_listings')
    .select('id', { count: 'exact', head: true })
    .eq('operator_id', operatorId)
    .eq('available', true)

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalBookings: bookings.length,
    avgBookingValue: bookings.length
      ? Math.round((totalRevenue / bookings.length) * 100) / 100
      : 0,
    occupancyRate: calculateOccupancyRate(
      bookings,
      activeListings ?? 0,
      periodStart,
      periodEnd,
    ),
    bestListingId: best.id,
    bestListingTitle: best.title,
    bestListingRevenue: best.revenue,
    revenueByPeriod: buildRevenueByPeriod(bookings, period),
  }
}
