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

  if (error) return null
  return data as DamageReport
}

export async function createDamageReport(
  report: Omit<DamageReport, 'id' | 'created_at'>,
): Promise<DamageReport> {
  const { data, error } = await supabase
    .from('rentivo_damage_reports')
    .insert(report)
    .select()
    .single()

  if (error) throw error
  return data as DamageReport
}

export async function updateDamageReport(id: string, updates: Partial<DamageReport>): Promise<void> {
  const { error } = await supabase
    .from('rentivo_damage_reports')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}
