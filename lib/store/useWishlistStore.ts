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

export async function syncWishlistFromSupabase(userId: string) {
  const { data, error } = await supabase
    .from('rentivo_wishlist')
    .select('listing_id')
    .eq('user_id', userId)
    // Bounded window, not paging: a wishlist is one person's hand-curated list, so
    // 500 is far past any real one. It has to be a COMPLETE read though — the
    // response below PRUNES the local store, so a truncated page would delete saved
    // listings. Hence the ceiling plus the guard underneath.
    .limit(WISHLIST_MAX_ROWS)

  // An error (offline, RLS denial) is not "your wishlist is empty" — pruning against
  // a failed read would wipe every locally saved listing. Same for a response that
  // reached the ceiling: we cannot tell a complete list from a truncated one, so we
  // leave the local store alone rather than delete rows we simply did not fetch.
  if (error || !data) return
  if (data.length >= WISHLIST_MAX_ROWS) return

  useWishlistStore.setState(state => ({
    items: state.items.filter(item => data.some(d => d.listing_id === item.id)),
  }))
}
