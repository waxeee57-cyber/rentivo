import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'

/**
 * Flip `available` on a listing owned by a HOST.
 *
 * lib/api/listings.ts already exports toggleListingAvailability, but it is
 * operator-only twice over: it resolves an operator id from rentivo_operators,
 * and the UPDATE it delegates to carries `.eq('operator_id', operatorId)`.
 * Host-owned rows have operator_id NULL, so that predicate matches zero rows
 * for every host no matter what is passed. Hence a host-keyed write.
 *
 * `available` is the real column; rentivo_listings has no `is_active`.
 */
export async function setHostListingAvailability(
  listingId: string,
  hostId: string,
  available: boolean,
): Promise<void> {
  if (Config.useMock) return

  const { data, error } = await supabase
    .from('rentivo_listings')
    .update({ available, updated_at: new Date().toISOString() })
    .eq('id', listingId)
    .eq('host_id', hostId)
    .select('id')

  if (error) throw error
  // supabase-js does NOT report an error for a zero-row UPDATE, so an RLS denial
  // or a stale listing id is indistinguishable from success unless the affected
  // rows are read back. Without this the pause toggle would go on reporting that
  // it saved something when it saved nothing.
  if (!data || data.length === 0) {
    throw new Error('Listing not found, or not owned by this host')
  }
}
