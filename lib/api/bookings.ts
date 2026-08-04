import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { MOCK_BOOKINGS } from '@/lib/mockData'
import type { PagingOptions } from '@/lib/api/listings'
import type { Booking, BookingStatus } from '@/types'

/**
 * Hard cap for the booking list queries. Each one selects nested listing + operator
 * rows, so an unbounded select grows quadratically with account age. Callers can page
 * past this with `paging`; nobody gets the whole table in one response any more.
 */
export const BOOKINGS_MAX_ROWS = 100

function pageRange(paging?: PagingOptions): { from: number; to: number } {
  const page = Math.max(0, paging?.page ?? 0)
  const pageSize = paging?.pageSize ?? BOOKINGS_MAX_ROWS
  const from = page * pageSize
  return { from, to: from + pageSize - 1 }
}

export async function fetchUserBookings(userId: string, paging?: PagingOptions): Promise<Booking[]> {
  if (Config.useMock) return MOCK_BOOKINGS

  const { from, to } = pageRange(paging)
  const { data, error } = await supabase
    .from('rentivo_bookings')
    .select('*, listing:rentivo_listings(*,operator:rentivo_operators(*)), operator:rentivo_operators(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  return (data as Booking[]) ?? []
}

export async function fetchBooking(id: string): Promise<Booking | null> {
  if (Config.useMock) return MOCK_BOOKINGS.find(b => b.id === id) ?? null

  const { data, error } = await supabase
    .from('rentivo_bookings')
    .select('*, listing:rentivo_listings(*,operator:rentivo_operators(*)), operator:rentivo_operators(*)')
    .eq('id', id)
    .single()

  // PGRST116 = "no rows returned". Every other error (RLS denial, network drop) used
  // to collapse into `null` and render as a blank "booking not found" screen.
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as Booking
}

export async function fetchOperatorBookings(operatorId: string, paging?: PagingOptions): Promise<Booking[]> {
  if (Config.useMock) return MOCK_BOOKINGS

  const { from, to } = pageRange(paging)
  const { data, error } = await supabase
    .from('rentivo_bookings')
    .select('*, listing:rentivo_listings(*), operator:rentivo_operators(*)')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  return (data as Booking[]) ?? []
}

export async function fetchHostBookings(hostId: string, paging?: PagingOptions): Promise<Booking[]> {
  if (Config.useMock) return MOCK_BOOKINGS

  // Join through listings to filter by host_id
  const { from, to } = pageRange(paging)
  const { data, error } = await supabase
    .from('rentivo_bookings')
    .select('*, listing:rentivo_listings!inner(*)')
    .eq('listing.host_id', hostId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  return (data as Booking[]) ?? []
}

/**
 * Inputs the client may send when creating a booking. NOTE: deliberately contains
 * NO money fields — total_amount / subtotal / platform_fee / price_per_day /
 * deposit_amount / promo_discount are all derived SERVER-side by the create-booking
 * edge function from the listing + these parameters. The client can no longer
 * dictate the charge.
 */
export interface CreateBookingInput {
  listing_id: string
  start_date: string
  end_date: string
  rental_type?: 'daily' | 'hourly'
  total_hours?: number | null
  insurance_id?: string
  promo_code?: string | null
  guest_name?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  guest_nationality?: string | null
  driver_license_no?: string | null
  pickup_time?: string | null
  return_time?: string | null
  pickup_location?: string | null
  notes?: string | null
  flight_number?: string | null
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<{ id: string; total_amount: number; deposit_amount: number }> {
  if (Config.useMock) {
    return { id: `mock-${Math.random().toString(36).slice(2, 8)}`, total_amount: 0, deposit_amount: 0 }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const res = await fetch(`${Config.supabaseUrl}/functions/v1/create-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: Config.supabaseAnonKey,
    },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create booking' }))
    throw new Error((err as { error?: string }).error ?? 'Failed to create booking')
  }

  const raw = await res.json() as { booking_id: string; total_amount: number; deposit_amount: number }
  return { id: raw.booking_id, total_amount: raw.total_amount, deposit_amount: raw.deposit_amount }
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
  // Mock mode used to fall through to a real UPDATE. supabase-js reports NO error for
  // a zero-row update, so the caller showed "Booking confirmed" while nothing changed
  // (and against production data at that). `createBooking` above already gates here.
  if (Config.useMock) return

  const { error } = await supabase
    .from('rentivo_bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

/**
 * Cancel a booking AND issue the refund the UI promises.
 *
 * The old path was a bare `UPDATE status='cancelled'` while the screen displayed
 * "If you cancel now: 100% refund (€X)" — the money never moved. The refund
 * amount is derived server-side from the listing's cancellation policy; the
 * client cannot influence it.
 */
export async function cancelBooking(id: string): Promise<{
  refundAmount: number
  refundPercent: number
  alreadyCancelled: boolean
}> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not signed in')

  const res = await fetch(`${Config.supabaseUrl}/functions/v1/cancel-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: Config.supabaseAnonKey,
    },
    body: JSON.stringify({ booking_id: id }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to cancel booking' }))
    throw new Error((err as { error?: string }).error ?? 'Failed to cancel booking')
  }

  const raw = await res.json() as {
    refund_amount?: number
    refund_percent?: number
    already_cancelled?: boolean
  }
  return {
    refundAmount: raw.refund_amount ?? 0,
    refundPercent: raw.refund_percent ?? 0,
    alreadyCancelled: raw.already_cancelled === true,
  }
}
