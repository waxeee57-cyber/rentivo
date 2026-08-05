import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Listing } from '@/types'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { captureException } from '@/lib/sentry'

interface WishlistState {
  items: Listing[]
  isWishlisted: (id: string) => boolean
  toggle: (listing: Listing) => void
  remove: (id: string) => void
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isWishlisted: (id) => get().items.some(i => i.id === id),
      toggle: (listing) => {
        const exists = get().isWishlisted(listing.id)
        set(state => ({
          items: exists
            ? state.items.filter(i => i.id !== listing.id)
            : [listing, ...state.items],
        }))
      },
      remove: (id) => set(state => ({ items: state.items.filter(i => i.id !== id) })),
    }),
    {
      name: 'rentivo-wishlist',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)

export async function toggleWishlistItem(listing: Listing, userId: string) {
  const store = useWishlistStore.getState()
  const isWishlisted = store.isWishlisted(listing.id)

  // The local (persisted) toggle is the source of truth for the UI; only the
  // remote mirror is gated. In mock builds we still flip local state — the heart
  // must respond — but never write to the real wishlist table.
  if (Config.useMock) {
    if (isWishlisted) store.remove(listing.id)
    else store.toggle(listing)
    return
  }

  // The local flip is optimistic. Neither branch below used to inspect `error`, so a
  // rejected write left the heart showing a state the server never agreed with — and
  // the next `syncWishlistFromSupabase` silently undid it, which reads to the user as
  // the app losing their saved listings. Reverting keeps what they see equal to what
  // was stored. Called as `void toggleWishlistItem(...)` from the listing screen, so
  // it must REPORT rather than throw.
  //
  // Row counts are deliberately NOT checked here: a delete matching zero rows is the
  // normal outcome when the item was only ever saved locally (added offline), and an
  // upsert is idempotent by definition. Only a real error means the write failed.
  if (isWishlisted) {
    store.remove(listing.id)
    const { error } = await supabase
      .from('rentivo_wishlist')
      .delete()
      .eq('user_id', userId)
      .eq('listing_id', listing.id)
    if (error) {
      store.toggle(listing)
      captureException(error, { scope: 'toggleWishlistItem.remove', listingId: listing.id })
    }
  } else {
    store.toggle(listing)
    const { error } = await supabase
      .from('rentivo_wishlist')
      .upsert({ user_id: userId, listing_id: listing.id })
    if (error) {
      store.remove(listing.id)
      captureException(error, { scope: 'toggleWishlistItem.add', listingId: listing.id })
    }
  }
}

/** See the comment on the select in `syncWishlistFromSupabase`. */
const WISHLIST_MAX_ROWS = 500

/**
 * Pulls the server's saved listings into the local store. This is a MERGE, in one
 * direction only: rows the server knows about are added, and nothing local is ever
 * removed.
 *
 * It used to do the opposite — filter local state down to whatever the select
 * returned — which is wrong in both directions this function is called in. Signing
 * in on a fresh device has an empty server-side result for a device that has been
 * collecting saves locally, so the whole wishlist was deleted; and because the
 * pruning happened instead of a fetch, a listing saved on one device never appeared
 * on a second one, since its id was returned but its Listing was never loaded.
 *
 * Removal stays where the user actually performs it — `toggleWishlistItem` deletes
 * from both sides at once — so a sync has no business inferring deletions.
 */
export async function syncWishlistFromSupabase(userId: string) {
  const { data, error } = await supabase
    .from('rentivo_wishlist')
    .select('listing_id')
    .eq('user_id', userId)
    // Bounded window, not paging: a wishlist is one person's hand-picked list, so
    // 500 is far past any real one. A truncated page is now harmless — merging
    // fewer rows loses nothing, whereas the old pruning read would have deleted
    // every save it simply had not fetched.
    .limit(WISHLIST_MAX_ROWS)

  if (error || !data) {
    if (error) captureException(error, { scope: 'syncWishlistFromSupabase.read' })
    return
  }

  // Only fetch the listings we do not already hold. An empty result here is the
  // ordinary case for a user whose devices are already in step, and it must stay a
  // no-op rather than an instruction to clear anything.
  const localIds = new Set(useWishlistStore.getState().items.map(i => i.id))
  const missingIds = data
    .map(row => (row as { listing_id: string }).listing_id)
    .filter(listingId => !localIds.has(listingId))
  if (missingIds.length === 0) return

  // The wishlist table only stores ids; the store holds whole Listings because the
  // Wishlist tab renders cards. Same select shape as lib/api/listings.ts so the
  // merged rows carry their operator and render identically to fetched ones.
  const { data: listings, error: listingsError } = await supabase
    .from('rentivo_listings')
    .select('*, operator:rentivo_operators(*)')
    .in('id', missingIds)
    // Bounded by the same cap the wishlist query above uses, so a corrupted or
    // oversized remote list cannot pull the listings table down a phone
    // connection.
    .limit(WISHLIST_MAX_ROWS)

  if (listingsError || !listings) {
    if (listingsError) captureException(listingsError, { scope: 'syncWishlistFromSupabase.listings' })
    return
  }

  useWishlistStore.setState(state => {
    const known = new Set(state.items.map(i => i.id))
    const additions = (listings as Listing[]).filter(l => !known.has(l.id))
    return additions.length > 0 ? { items: [...state.items, ...additions] } : state
  })
}
