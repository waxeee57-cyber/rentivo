import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'

export interface BlackoutPeriod {
  id: string
  listing_id: string
  title: string
  start_date: string
  end_date: string
  reason: 'maintenance' | 'personal_use' | 'seasonal' | 'other' | null
  notes: string | null
}

export interface NewBlackoutPeriod {
  listing_id: string
  operator_id: string
  title: string
  start_date: string
  end_date: string
  reason: BlackoutPeriod['reason']
  notes: string | null
}

const MOCK_BLACKOUTS: BlackoutPeriod[] = [
  { id: 'bp-001', listing_id: 'lst-001', title: 'Annual Service', start_date: '2026-06-01', end_date: '2026-06-07', reason: 'maintenance', notes: 'Full service + tire change' },
  { id: 'bp-002', listing_id: 'lst-001', title: 'Family Holiday', start_date: '2026-08-10', end_date: '2026-08-24', reason: 'personal_use', notes: null },
]

export async function getBlackoutPeriods(listingId: string): Promise<BlackoutPeriod[]> {
  if (Config.useMock) return MOCK_BLACKOUTS.filter(b => b.listing_id === listingId)

  const { data, error } = await supabase
    .from('rentivo_blackout_periods')
    .select('id, listing_id, title, start_date, end_date, reason, notes')
    .eq('listing_id', listingId)
    .order('start_date', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function addBlackoutPeriod(period: NewBlackoutPeriod): Promise<BlackoutPeriod> {
  if (Config.useMock) {
    const { operator_id: _op, ...rest } = period
    return { ...rest, id: `bp-${Date.now()}` }
  }

  const { data, error } = await supabase
    .from('rentivo_blackout_periods')
    .insert(period)
    .select('id, listing_id, title, start_date, end_date, reason, notes')
    .single()

  if (error) throw error
  if (!data) throw new Error('No data returned')
  return data
}

export async function deleteBlackoutPeriod(id: string): Promise<void> {
  if (Config.useMock) return

  const { error } = await supabase
    .from('rentivo_blackout_periods')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export function isDateBlocked(date: string, blackouts: BlackoutPeriod[]): boolean {
  return blackouts.some(b => date >= b.start_date && date <= b.end_date)
}
