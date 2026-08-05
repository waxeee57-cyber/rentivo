import { supabase } from '@/lib/supabase'
import { captureException } from '@/lib/sentry'
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

// `listing_id` / `operator_id` are deliberately NOT part of the caller's
// contract. They are derived from `booking_id` below, so an inspection screen
// physically cannot supply a wrong or empty value for them.
export type DamageReportDraft =
  Omit<DamageReport, 'id' | 'created_at' | 'listing_id' | 'operator_id'> &
  Partial<Pick<DamageReport, 'listing_id' | 'operator_id'>>

export async function createDamageReport(
  report: DamageReportDraft,
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

  // Resolve the owning listing and operator HERE rather than trusting the
  // caller. Both inspection screens passed `''` for these UUID columns, so
  // Postgres rejected every insert with "invalid input syntax for type uuid" -
  // after all six photos had already uploaded - and a bare `catch` upstream
  // turned it into a generic toast. No damage report has ever been stored, and
  // every deposit dispute has therefore had zero evidence behind it.
  //
  // Deriving them from `booking_id` means a screen cannot get this wrong
  // again, and it cannot disagree with the booking either.
  const resolved: DamageReportDraft = { ...report }
  if (!resolved.listing_id || !resolved.operator_id) {
    const { data: booking, error: bookingError } = await supabase
      .from('rentivo_bookings')
      .select('listing_id, operator_id')
      .eq('id', report.booking_id)
      .single()

    if (bookingError) throw bookingError
    resolved.listing_id = resolved.listing_id || booking?.listing_id
    resolved.operator_id = resolved.operator_id || booking?.operator_id
  }

  // Both columns are NOT NULL uuid. Failing here is louder and cheaper than a
  // Postgres constraint error thrown after six photo uploads.
  if (!resolved.listing_id || !resolved.operator_id) {
    throw new Error(`Damage report for booking ${report.booking_id} has no listing/operator to attach to`)
  }

  const { data, error } = await supabase
    .from('rentivo_damage_reports')
    .insert(resolved)
    .select()
    .single()

  if (error) throw error

  // Mark the booking so the inspection stops being offered and both parties
  // stop seeing "Pending". Four screens read `pickup_damage_done` /
  // `return_damage_done`; until now NOTHING wrote them, so the same inspection
  // could be filed unlimited times and the badge never changed.
  const doneColumn = report.type === 'pickup' ? 'pickup_damage_done' : 'return_damage_done'
  const { error: flagError } = await supabase
    .from('rentivo_bookings')
    .update({ [doneColumn]: true })
    .eq('id', report.booking_id)

  // Deliberately not fatal: the report itself is stored, which is the part that
  // matters for a dispute. But it must be visible, because a silently unset
  // flag is what let duplicate inspections happen.
  if (flagError) captureException(flagError, { where: 'createDamageReport.flag', bookingId: report.booking_id })

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
