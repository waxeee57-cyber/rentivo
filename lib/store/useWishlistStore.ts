import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Listing } from '@/types'

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
