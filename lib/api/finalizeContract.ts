import { supabase } from '@/lib/supabase'
import { captureException } from '@/lib/sentry'
import { Config } from '@/constants/config'
import { buildContractPDF } from '@/lib/utils/generateContract'
import { uploadContractPDF } from '@/lib/storage'
import type { Booking } from '@/types'

/**
 * Turn two signatures into a document that exists.
 *
 * Everything needed for this was already written and NONE of it was ever
 * called: `buildContractPDF` (lib/utils/generateContract.ts), `uploadContractPDF`
 * (lib/storage.ts) and the `contract_url` column all sat unused. Both parties
 * could sign, both signatures were stored, and the rental agreement itself was
 * never produced — so "View contract" opened a URL that nothing could write, and
 * a dispute six months later had two blobs of SVG path data and no document.
 *
 * Called from both signature screens once the second signature lands.
 *
 * Deliberately non-fatal. The signatures are already committed by the time this
 * runs, and they are what carries legal weight under eIDAS; failing to render
 * the PDF must not roll that back or block the party who just signed. It is
 * reported and retried on the next signature or on demand.
 */
export async function finalizeContract(bookingId: string): Promise<string | null> {
  if (Config.useMock) return null

  try {
    const { data: booking, error } = await supabase
      .from('rentivo_bookings')
      .select('*, listing:rentivo_listings(*), operator:rentivo_operators(*), host:rentivo_hosts(*)')
      .eq('id', bookingId)
      .maybeSingle()

    if (error) throw error
    if (!booking) throw new Error(`Booking ${bookingId} not found while finalizing the contract`)

    const row = booking as Booking & {
      guest_signature?: string | null
      operator_signature_data?: string | null
      contract_url?: string | null
    }

    // Only when BOTH sides have signed. A one-sided PDF is not a contract, and
    // regenerating on every signature would overwrite the stored document.
    if (!row.guest_signature || !row.operator_signature_data) return null
    if (row.contract_url) return row.contract_url

    const localUri = await buildContractPDF(
      row,
      row.guest_signature ?? undefined,
      row.operator_signature_data ?? undefined,
    )
    const url = await uploadContractPDF(bookingId, localUri)

    const { data: saved, error: saveError } = await supabase
      .from('rentivo_bookings')
      .update({ contract_url: url, contract_signed_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select('id')

    // A zero-row update here means the document is in storage and the booking
    // does not know about it. That must be visible, not silent.
    if (saveError || !saved || saved.length === 0) {
      throw saveError ?? new Error('Contract URL update matched no booking row')
    }

    return url
  } catch (e) {
    captureException(e, { scope: 'finalizeContract', bookingId })
    return null
  }
}
