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

  const { error } = await supabase
    .from('rentivo_bookings')
    .update(updates)
    .eq('id', bookingId)

  if (error) throw error
}
