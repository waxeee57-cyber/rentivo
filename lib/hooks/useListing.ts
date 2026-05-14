import { useState, useEffect } from 'react'
import { fetchListing } from '@/lib/api/listings'
import type { Listing } from '@/types'

export function useListing(id: string) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchListing(id)
      .then(data => { if (!cancelled) setListing(data) })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  return { listing, loading, error }
}
