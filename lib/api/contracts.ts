import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import type { Booking } from '@/types'

export async function saveContractSignature(
  bookingId: string,
  role: 'consumer' | 'operator',
  signature: string,
): Promise<void> {
  if (Config.useMock) return

  const field = role === 'consumer' ? 'consumer_signature' : 'operator_signature'
  const updates: Partial<Booking> & { updated_at: string } = {
    [field]: signature,
    updated_at: new Date().toISOString(),
  }

  if (role === 'consumer') {
    (updates as Record<string, unknown>).contract_signed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('rentivo_bookings')
    .update(updates)
    .eq('id', bookingId)
    .select('id')

  if (error) throw error
  // supabase-js reports no error for a zero-row UPDATE. This one writes a SIGNATURE
  // on the rental contract: reporting success for a write that never landed would
  // leave both parties believing a contract is signed when nothing was stored.
  if (!data || data.length === 0) {
    throw new Error('Booking not found, or you are not permitted to sign it')
  }
}
