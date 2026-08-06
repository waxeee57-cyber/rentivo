import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { MOCK_LISTINGS, MOCK_OPERATOR } from '@/lib/mockData'
import type { Listing, SearchFilters } from '@/types'

/** Rows per page for the paginated marketplace list (explore / search). */
export const LISTINGS_PAGE_SIZE = 20

/**
 * Hard cap for callers that ask for no explicit page. Every select in this file used
 * to be unbounded, so one request pulled the whole `rentivo_listings` table together
 * with its nested operator join. A bounded default keeps legacy call sites working
 * while making the worst case a fixed cost instead of a table scan.
 */
export const LISTINGS_MAX_ROWS = 100

/** 0-based paging window. */
export interface PagingOptions {
  page?: number
  pageSize?: number
}

export interface PagedListings {
  data: Listing[]
  hasMore: boolean
}

/**
 * Overloaded on purpose: passing `paging` opts into the `{ data, hasMore }` shape the
 * infinite-scroll hook needs, while the historic single-argument form still returns a
 * plain array so existing callers (e.g. lib/api/unifiedSearch.ts) compile unchanged.
 */
export async function fetchListings(filters?: SearchFilters): Promise<Listing[]>
export async function fetchListings(
  filters: SearchFilters | undefined,
  paging: PagingOptions,
): Promise<PagedListings>
export async function fetchListings(
  filters?: SearchFilters,
  paging?: PagingOptions,
): Promise<Listing[] | PagedListings> {
  const page = Math.max(0, paging?.page ?? 0)
  const pageSize = paging?.pageSize ?? (paging ? LISTINGS_PAGE_SIZE : LISTINGS_MAX_ROWS)
  const from = page * pageSize

  if (Config.useMock) {
    let result = [...MOCK_LISTINGS]
    if (filters?.category) result = result.filter(l => l.category === filters.category)
    if (filters?.minPrice) result = result.filter(l => l.price_per_day >= (filters.minPrice ?? 0))
    if (filters?.maxPrice) result = result.filter(l => l.price_per_day <= (filters.maxPrice ?? Infinity))
    const slice = result.slice(from, from + pageSize)
    return paging ? { data: slice, hasMore: from + pageSize < result.length } : slice
  }

  let query = supabase
    .from('rentivo_listings')
    .select('*, operator:rentivo_operators(*)')
    .eq('available', true)

  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.minPrice) query = query.gte('price_per_day', filters.minPrice)
  if (filters?.maxPrice) query = query.lte('price_per_day', filters.maxPrice)
  if (filters?.sortBy === 'price_asc') query = query.order('price_per_day', { ascending: true })
  else if (filters?.sortBy === 'price_desc') query = query.order('price_per_day', { ascending: false })
  else if (filters?.sortBy === 'rating') query = query.order('rating', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  // Ask for one row beyond the page: if it comes back there is at least one more page.
  // Cheaper than a second `count` round-trip on every scroll.
  query = query.range(from, from + pageSize)

  const { data, error } = await query
  if (error) throw error
  const rows = (data as Listing[]) ?? []
  const hasMore = rows.length > pageSize
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows
  return paging ? { data: pageRows, hasMore } : pageRows
}

export async function fetchListing(id: string): Promise<Listing | null> {
  if (Config.useMock) {
    return MOCK_LISTINGS.find(l => l.id === id) ?? null
  }

  const { data, error } = await supabase
    .from('rentivo_listings')
    // The host has to come back too. The booking screen decides whether the
    // owner can be paid from `listing.operator`, and a host-owned listing has no
    // operator join — so that check was false for EVERY host listing however
    // well onboarded the host was, and the screen refused the booking with "the
    // operator has not finished setting up payments yet". No host listing was
    // bookable in the app at all.
    .select('*, operator:rentivo_operators(*), host:rentivo_hosts(*)')
    .eq('id', id)
    .single()

  // PGRST116 = "no rows returned", the only error that genuinely means "not found".
  // Anything else (RLS denial, network drop, malformed query) used to be swallowed
  // into `null`, which the detail screens render as an empty "not found" page.
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as Listing
}

export async function fetchOperatorListings(operatorId: string, paging?: PagingOptions): Promise<Listing[]> {
  if (Config.useMock) {
    return MOCK_LISTINGS.filter(l => l.operator_id === operatorId)
  }

  const page = Math.max(0, paging?.page ?? 0)
  const pageSize = paging?.pageSize ?? LISTINGS_MAX_ROWS
  const from = page * pageSize

  const { data, error } = await supabase
    .from('rentivo_listings')
    .select('*')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
    // Bounded: a large fleet must not be pulled down in a single response.
    .range(from, from + pageSize - 1)

  if (error) throw error
  return (data as Listing[]) ?? []
}

/**
 * Listings owned by a HOST (C2C). Hosts are stored on the same table as operator
 * listings but keyed by `host_id` — `operator_id` is empty for them (see
 * app/(host)/listings/new.tsx), so `fetchOperatorListings` can never find them.
 */
export async function fetchHostListings(hostId: string, paging?: PagingOptions): Promise<Listing[]> {
  if (Config.useMock) {
    // The mock auth store does not always carry a host record, so an empty id falls
    // back to every host-owned mock listing rather than rendering an empty screen.
    return MOCK_LISTINGS.filter(l => l.owner_type === 'host' && (!hostId || l.host_id === hostId))
  }

  const page = Math.max(0, paging?.page ?? 0)
  const pageSize = paging?.pageSize ?? LISTINGS_MAX_ROWS
  const from = page * pageSize

  const { data, error } = await supabase
    .from('rentivo_listings')
    .select('*')
    .eq('host_id', hostId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) throw error
  return (data as Listing[]) ?? []
}

export async function createListing(listing: Omit<Listing, 'id' | 'created_at' | 'rating' | 'review_count' | 'booking_count'>): Promise<Listing> {
  // Mock mode must never touch production data — the read siblings above already
  // short-circuit here, this write did not and hit Supabase for real.
  if (Config.useMock) {
    return {
      ...listing,
      id: `mock-${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
      rating: 0,
      review_count: 0,
      booking_count: 0,
    } as Listing
  }

  // `operator_id: ''` — app/(host)/listings/new.tsx and add-external.tsx both
  // pass an empty string because a host has no operator. operator_id is a uuid
  // column, so Postgres rejected the insert outright with "invalid input syntax
  // for type uuid" and the screen showed its generic error toast. No host has
  // ever been able to publish a listing; the host half of the marketplace did
  // not work at all. Normalising here means no screen can reintroduce it.
  const UUID_COLUMNS = ['operator_id', 'host_id', 'owner_user_id'] as const
  const row: Record<string, unknown> = { ...listing }
  for (const column of UUID_COLUMNS) {
    if (row[column] === '') row[column] = null
  }

  const { data, error } = await supabase
    .from('rentivo_listings')
    .insert(row)
    .select()
    .single()

  if (error) throw error
  return data as Listing
}

/**
 * `operatorId` is REQUIRED: it was optional and every caller that omitted it produced
 * an UPDATE with no ownership predicate, leaving defence entirely to RLS. Passing it
 * keeps the owner check in the statement itself (defence in depth).
 */
export async function updateListing(id: string, updates: Partial<Listing>, operatorId: string): Promise<void> {
  if (Config.useMock) return

  const { data, error } = await supabase
    .from('rentivo_listings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('operator_id', operatorId)
    .select('id')

  if (error) throw error
  // The ownership predicate above is only defence in depth if a MISS is noticed:
  // supabase-js reports no error for a zero-row UPDATE, so passing someone else's
  // listing id (or a stale one) saved nothing and the editor still said "Updated".
  if (!data || data.length === 0) {
    throw new Error('Listing not found, or not owned by this operator')
  }
}

export async function deleteListing(id: string, operatorId: string): Promise<void> {
  if (Config.useMock) return

  const { data, error } = await supabase
    .from('rentivo_listings')
    .delete()
    .eq('id', id)
    .eq('operator_id', operatorId)
    .select('id')

  if (error) throw error
  // Same silent-miss as updateListing: a DELETE that matched nothing is not an error,
  // so the fleet screen used to navigate away announcing a vehicle it never removed.
  if (!data || data.length === 0) {
    throw new Error('Listing not found, or not owned by this operator')
  }
}

/**
 * Resolve the signed-in user's OWN operator id. Only used as a fallback below: it can
 * never name anyone else's operator record, so it is safe as an ownership predicate.
 */
async function getSessionOperatorId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const { data } = await supabase
    .from('rentivo_operators')
    .select('id')
    .eq('auth_id', session.user.id)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

export async function toggleListingAvailability(
  id: string,
  available: boolean,
  operatorId?: string,
): Promise<void> {
  if (Config.useMock) return
  // `updateListing` now REQUIRES an owner predicate, and this used to omit it entirely.
  // Callers should pass their operator id (saves a round-trip); when they can't — e.g.
  // lib/hooks/useFleet.ts — it is derived from the session rather than skipped.
  const ownerId = operatorId ?? await getSessionOperatorId()
  if (!ownerId) throw new Error('No operator account for the signed-in user')
  await updateListing(id, { available }, ownerId)
}

export async function getAvailableTodayListings(): Promise<Listing[]> {
  if (Config.useMock) {
    return MOCK_LISTINGS.filter(l => l.available && l.instant_book).slice(0, 6)
  }
  const { data, error } = await supabase
    .from('rentivo_listings')
    .select('*, operator:rentivo_operators(*)')
    .eq('available', true)
    .eq('instant_book', true)
    .limit(6)
  if (error) throw error
  return (data as Listing[]) ?? []
}

export async function getLastMinuteListings(): Promise<Listing[]> {
  if (Config.useMock) {
    return [...MOCK_LISTINGS].sort(() => -1).slice(0, 6)
  }
  const { data, error } = await supabase
    .from('rentivo_listings')
    .select('*, operator:rentivo_operators(*)')
    .eq('available', true)
    .order('created_at', { ascending: false })
    .limit(6)
  if (error) throw error
  return (data as Listing[]) ?? []
}
