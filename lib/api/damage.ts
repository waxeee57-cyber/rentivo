import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { MOCK_DAMAGE_REPORT } from '@/lib/mockData'
import type { DamageReport } from '@/types'

export async function fetchDamageReport(bookingId: string, type: 'pickup' | 'return'): Promise<DamageReport | null> {
  if (Config.useMock) {
    if (bookingId === 'bk-003' && type === 'pickup') return MOCK_DAMAGE_REPORT
    return null
  }

  const { data, error } = await supabase
    .from('rentivo_damage_reports')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('type', type)
    .single()

  // PGRST116 = "no rows returned" — the genuine not-found case. Any other error
  // (RLS denial, network drop) must surface instead of masquerading as "no report",
  // which would let a return inspection start without its pickup baseline.
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as DamageReport
}

export async function createDamageReport(
  report: Omit<DamageReport, 'id' | 'created_at'>,
): Promise<DamageReport> {
  // Mock mode must not write to production: `fetchDamageReport` above honours the
  // flag, this insert did not.
  if (Config.useMock) {
    return {
      ...report,
      id: `mock-${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
    } as DamageReport
  }

  const { data, error } = await supabase
    .from('rentivo_damage_reports')
    .insert(report)
    .select()
    .single()

  if (error) throw error
  return data as DamageReport
}

export async function updateDamageReport(id: string, updates: Partial<DamageReport>): Promise<void> {
  // Same reason as createDamageReport: no production writes while mocking.
  if (Config.useMock) return

  const { data, error } = await supabase
    .from('rentivo_damage_reports')
    .update(updates)
    .eq('id', id)
    .select('id')

  if (error) throw error
  // Zero rows matched is not an error to supabase-js. On a damage report that means
  // an assessment the operator believes they filed was never written — the evidence
  // for a deposit charge. It has to surface.
  if (!data || data.length === 0) {
    throw new Error('Damage report not found, or you are not permitted to change it')
  }
}
