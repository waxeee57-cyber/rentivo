import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { MOCK_LISTINGS, MOCK_OPERATOR } from '@/lib/mockData'
import type { Listing, SearchFilters } from '@/types'

export async function fetchListings(filters?: SearchFilters): Promise<Listing[]> {
  if (Config.useMock) {
    let result = [...MOCK_LISTINGS]
    if (filters?.category) result = result.filter(l => l.category === filters.category)
    if (filters?.minPrice) result = result.filter(l => l.price_per_day >= (filters.minPrice ?? 0))
    if (filters?.maxPrice) result = result.filter(l => l.price_per_day <= (filters.maxPrice ?? Infinity))
    return result
  }

  let query = supabase
    .from('rentivo_listings')
    .select('*, operator:rentivo_operators(*)')
    .eq('available', true)

  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.minPrice) query = query.gte('price_per_day', filters.minPrice)
  if (filters?.maxPrice) query = query.lte('price_per_day', filters.maxPrice)
  if (filters?.sortBy === 'price_asc') query = query.order('price_per_day', { ascending: true })
  else if (filters?.sortBy === 'price_desc') query = query.order('price_per_day', { ascending: false })
  else if (filters?.sortBy === 'rating') query = query.order('rating', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return (data as Listing[]) ?? []
}

export async function fetchListing(id: string): Promise<Listing | null> {
  if (Config.useMock) {
    return MOCK_LISTINGS.find(l => l.id === id) ?? null
  }

  const { data, error } = await supabase
    .from('rentivo_listings')
    .select('*, operator:rentivo_operators(*)')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Listing
}

export async function fetchOperatorListings(operatorId: string): Promise<Listing[]> {
  if (Config.useMock) {
    return MOCK_LISTINGS.filter(l => l.operator_id === operatorId)
  }

  const { data, error } = await supabase
    .from('rentivo_listings')
    .select('*')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as Listing[]) ?? []
}

export async function createListing(listing: Omit<Listing, 'id' | 'created_at' | 'rating' | 'review_count' | 'booking_count'>): Promise<Listing> {
  const { data, error } = await supabase
    .from('rentivo_listings')
    .insert(listing)
    .select()
    .single()

  if (error) throw error
  return data as Listing
}

export async function updateListing(id: string, updates: Partial<Listing>, operatorId?: string): Promise<void> {
  let query = supabase
    .from('rentivo_listings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (operatorId) {
    query = query.eq('operator_id', operatorId)
  }

  const { error } = await query
  if (error) throw error
}

export async function deleteListing(id: string, operatorId: string): Promise<void> {
  const { error } = await supabase
    .from('rentivo_listings')
    .delete()
    .eq('id', id)
    .eq('operator_id', operatorId)

  if (error) throw error
}

export async function toggleListingAvailability(id: string, available: boolean): Promise<void> {
  await updateListing(id, { available })
}
