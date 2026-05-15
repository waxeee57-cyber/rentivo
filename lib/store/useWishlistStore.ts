import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Listing } from '@/types'
import { supabase } from '@/lib/supabase'

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

  if (isWishlisted) {
    store.remove(listing.id)
    await supabase
      .from('rentivo_wishlist')
      .delete()
      .eq('user_id', userId)
      .eq('listing_id', listing.id)
  } else {
    store.toggle(listing)
    await supabase
      .from('rentivo_wishlist')
      .upsert({ user_id: userId, listing_id: listing.id })
  }
}

export async function syncWishlistFromSupabase(userId: string) {
  const { data } = await supabase
    .from('rentivo_wishlist')
    .select('listing_id')
    .eq('user_id', userId)

  if (data) {
    useWishlistStore.setState(state => ({
      items: state.items.filter(item => data.some(d => d.listing_id === item.id)),
    }))
  }
}
