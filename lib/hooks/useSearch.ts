import type { Listing, RentalCategory } from '@/types'

export interface SearchState {
  query: string
  category: RentalCategory | null
  minPrice: number | null
  maxPrice: number | null
  sort: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest'
  instantBook: boolean
  capacity: number | null
  country: string | null
  city: string | null
}

export const DEFAULT_SEARCH_STATE: SearchState = {
  query: '',
  category: null,
  minPrice: null,
  maxPrice: null,
  sort: 'relevance',
  instantBook: false,
  capacity: null,
  country: null,
  city: null,
}

export function filterListings(listings: Listing[], state: SearchState): Listing[] {
  return listings
    .filter(l => {
      if (state.query) {
        const q = state.query.toLowerCase()
        const match =
          l.title.toLowerCase().includes(q) ||
          (l.description?.toLowerCase().includes(q) ?? false) ||
          (l.operator?.name?.toLowerCase().includes(q) ?? false) ||
          (l.operator?.city?.toLowerCase().includes(q) ?? false) ||
          (l.make?.toLowerCase().includes(q) ?? false) ||
          (l.model?.toLowerCase().includes(q) ?? false)
        if (!match) return false
      }
      if (state.category && l.category !== state.category) return false
      if (state.minPrice != null && l.price_per_day < state.minPrice * 100) return false
      if (state.maxPrice != null && l.price_per_day > state.maxPrice * 100) return false
      if (state.instantBook && !l.instant_book) return false
      if (state.capacity != null && (l.capacity ?? 1) < state.capacity) return false
      if (state.city) {
        const cityMatch =
          l.operator?.city?.toLowerCase() === state.city.toLowerCase()
        if (!cityMatch) return false
      }
      return true
    })
    .sort((a, b) => {
      switch (state.sort) {
        case 'price_asc':  return a.price_per_day - b.price_per_day
        case 'price_desc': return b.price_per_day - a.price_per_day
        case 'rating':     return (b.rating ?? 0) - (a.rating ?? 0)
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        default:           return 0
      }
    })
}
