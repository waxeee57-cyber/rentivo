import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { MOCK_REVIEWS } from '@/lib/mockData'
import type { PagingOptions } from '@/lib/api/listings'
import type { Review } from '@/types'

/** Rows per page once a caller opts into paging. */
export const REVIEWS_PAGE_SIZE = 20

/**
 * Hard cap for the historic single-argument call. A listing's review count only ever
 * grows, so the unbounded select got slower for exactly the listings that succeed —
 * and the detail sheet never renders more than a screenful before the user scrolls.
 */
export const REVIEWS_MAX_ROWS = 100

export interface PagedReviews {
  data: Review[]
  hasMore: boolean
}

/**
 * Overloaded like `fetchListings`: passing `paging` yields `{ data, hasMore }` for an
 * incremental list, while the one-argument form still returns a plain array so
 * lib/hooks/useReviews.ts compiles unchanged.
 */
export async function fetchListingReviews(listingId: string): Promise<Review[]>
export async function fetchListingReviews(
  listingId: string,
  paging: PagingOptions,
): Promise<PagedReviews>
export async function fetchListingReviews(
  listingId: string,
  paging?: PagingOptions,
): Promise<Review[] | PagedReviews> {
  const page = Math.max(0, paging?.page ?? 0)
  const pageSize = paging?.pageSize ?? (paging ? REVIEWS_PAGE_SIZE : REVIEWS_MAX_ROWS)
  const from = page * pageSize

  if (Config.useMock) {
    const all = MOCK_REVIEWS.filter(r => r.listing_id === listingId)
    const slice = all.slice(from, from + pageSize)
    return paging ? { data: slice, hasMore: from + pageSize < all.length } : slice
  }

  const { data, error } = await supabase
    .from('rentivo_reviews')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    // Ask for one row past the page: if it arrives there is another page. Cheaper
    // than a second `count` round-trip, and the same trick `fetchListings` uses.
    .range(from, from + pageSize)

  if (error) throw error
  const rows = (data as Review[]) ?? []
  const hasMore = rows.length > pageSize
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows
  return paging ? { data: pageRows, hasMore } : pageRows
}
