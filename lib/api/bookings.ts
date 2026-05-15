import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { MOCK_BOOKINGS } from '@/lib/mockData'
import type { Booking, BookingStatus } from '@/types'

export async function fetchUserBookings(userId: string): Promise<Booking[]> {
  if (Config.useMock) return MOCK_BOOKINGS

  const { data, error } = await supabase
    .from('rentivo_bookings')
    .select('*, listing:rentivo_listings(*,operator:rentivo_operators(*)), operator:rentivo_operators(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

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

  if (error) return null
  return data as Booking
}

export async function fetchOperatorBookings(operatorId: string): Promise<Booking[]> {
  if (Config.useMock) return MOCK_BOOKINGS

  const { data, error } = await supabase
    .from('rentivo_bookings')
    .select('*, listing:rentivo_listings(*), operator:rentivo_operators(*)')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as Booking[]) ?? []
}

export async function fetchHostBookings(hostId: string): Promise<Booking[]> {
  if (Config.useMock) return MOCK_BOOKINGS

  // Join through listings to filter by host_id
  const { data, error } = await supabase
    .from('rentivo_bookings')
    .select('*, listing:rentivo_listings!inner(*)')
    .eq('listing.host_id', hostId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as Booking[]) ?? []
}

export async function createBooking(
  booking: Omit<Booking, 'id' | 'created_at' | 'pickup_damage_done' | 'return_damage_done' | 'has_damage_claim'>,
): Promise<Booking> {
  const { data, error } = await supabase
    .from('rentivo_bookings')
    .insert({
      ...booking,
      pickup_damage_done: false,
      return_damage_done: false,
      has_damage_claim: false,
    })
    .select()
    .single()

  if (error) throw error
  return data as Booking
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { error } = await supabase
    .from('rentivo_bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function updateBooking(id: string, updates: Partial<Booking>): Promise<void> {
  const { error } = await supabase
    .from('rentivo_bookings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
