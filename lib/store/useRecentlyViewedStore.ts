import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Listing } from '@/types'

const MAX_ITEMS = 10

interface RecentlyViewedState {
  items: Listing[]
  track: (listing: Listing) => void
  clear: () => void
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],
      track: (listing) =>
        set((state) => {
          const filtered = state.items.filter((i) => i.id !== listing.id)
          return { items: [listing, ...filtered].slice(0, MAX_ITEMS) }
        }),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'rentivo-recently-viewed',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
