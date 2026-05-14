import { useState, useEffect } from 'react'
import { fetchListings } from '@/lib/api/listings'
import type { Listing, SearchFilters } from '@/types'

export function useListings(filters?: SearchFilters) {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchListings(filters)
      .then(data => { if (!cancelled) setListings(data) })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filters?.category, filters?.minPrice, filters?.maxPrice, filters?.sortBy])

  return { listings, loading, error, refetch: () => {} }
}
