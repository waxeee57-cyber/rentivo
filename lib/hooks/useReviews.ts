import { useState, useEffect, useCallback } from 'react'
import { fetchListingReviews } from '@/lib/api/reviews'
import type { Review } from '@/types'

interface UseReviewsResult {
  reviews: Review[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useReviews(listingId: string): UseReviewsResult {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!listingId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await fetchListingReviews(listingId)
      setReviews(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [listingId])

  useEffect(() => {
    void load()
  }, [load])

  return { reviews, loading, error, refetch: load }
}
