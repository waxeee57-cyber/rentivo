import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchListings, fetchHostListings, LISTINGS_PAGE_SIZE } from '@/lib/api/listings'
import { Config } from '@/constants/config'
import type { Listing, SearchFilters } from '@/types'

export function useListings(filters?: SearchFilters) {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const pageRef = useRef(0)

  // Call sites rebuild `filters` as a fresh object literal on every render, so its
  // identity is useless as a dependency — the effect keys off the scalar fields (as
  // before) and loadMore reads the current object through a ref.
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  useEffect(() => {
    let cancelled = false
    pageRef.current = 0
    setLoading(true)
    setError(null)
    fetchListings(filtersRef.current, { page: 0, pageSize: LISTINGS_PAGE_SIZE })
      .then(res => {
        if (cancelled) return
        setListings(res.data)
        setHasMore(res.hasMore)
      })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filters?.category, filters?.minPrice, filters?.maxPrice, filters?.sortBy, tick])

  // Was `() => {}` — a literal no-op, so the main marketplace list could never be
  // retried after a failed load. Bumping `tick` re-runs the effect, mirroring the
  // pattern already used in lib/hooks/useListing.ts.
  const refetch = useCallback(() => setTick(t => t + 1), [])

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return
    const nextPage = pageRef.current + 1
    setLoadingMore(true)
    fetchListings(filtersRef.current, { page: nextPage, pageSize: LISTINGS_PAGE_SIZE })
      .then(res => {
        pageRef.current = nextPage
        // De-dupe by id: a row inserted between two page requests shifts the window
        // and can repeat an entry, which would break FlatList's unique-key contract.
        setListings(prev => {
          const seen = new Set(prev.map(l => l.id))
          return [...prev, ...res.data.filter(l => !seen.has(l.id))]
        })
        setHasMore(res.hasMore)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoadingMore(false))
  }, [loading, loadingMore, hasMore])

  return { listings, loading, loadingMore, hasMore, error, refetch, loadMore }
}

/**
 * Listings owned by the signed-in HOST. Separate from useListings because host
 * listings are keyed by `host_id`, not by the marketplace's `available` filter.
 */
export function useHostListings(hostId: string | null | undefined) {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Live mode needs a real host id — `.eq('host_id','')` would be an invalid uuid
    // comparison. Mock mode passes through and falls back to the mock host listings.
    if (!hostId && !Config.useMock) {
      setListings([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetchHostListings(hostId ?? '')
      .then(data => { if (!cancelled) setListings(data) })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hostId, tick])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { listings, loading, error, refetch }
}
