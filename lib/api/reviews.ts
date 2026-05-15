import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { MOCK_REVIEWS } from '@/lib/mockData'
import type { Review } from '@/types'

export async function fetchListingReviews(listingId: string): Promise<Review[]> {
  if (Config.useMock) {
    return MOCK_REVIEWS.filter(r => r.listing_id === listingId)
  }

  const { data, error } = await supabase
    .from('rentivo_reviews')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as Review[]) ?? []
}
