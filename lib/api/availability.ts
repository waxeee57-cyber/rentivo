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

/** See the comment on the select in `getBlackoutPeriods`. */
const BLACKOUTS_MAX_ROWS = 200

export async function getBlackoutPeriods(listingId: string): Promise<BlackoutPeriod[]> {
  if (Config.useMock) return MOCK_BLACKOUTS.filter(b => b.listing_id === listingId)

  const { data, error } = await supabase
    .from('rentivo_blackout_periods')
    .select('id, listing_id, title, start_date, end_date, reason, notes')
    .eq('listing_id', listingId)
    .order('start_date', { ascending: true })
    // Bounded window, not paging: a blackout is a maintenance/holiday RANGE for ONE
    // listing, so a heavily-managed vehicle books a handful a year — 200 covers a
    // decade of them. The operator screen renders the whole list, so this stays a
    // single request; the ceiling only stops a corrupted listing from streaming the
    // table into a phone.
    .limit(BLACKOUTS_MAX_ROWS)

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

  const { data, error } = await supabase
    .from('rentivo_blackout_periods')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) throw error
  // A DELETE that matched nothing returns no error, so the screen removed the row
  // from local state and said "Period removed" while the listing stayed blocked —
  // the operator would only find out when bookings kept getting refused.
  if (!data || data.length === 0) {
    throw new Error('Blackout period not found, or you are not permitted to remove it')
  }
}

export function isDateBlocked(date: string, blackouts: BlackoutPeriod[]): boolean {
  return blackouts.some(b => date >= b.start_date && date <= b.end_date)
}
