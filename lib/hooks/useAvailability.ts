import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'

export function useAvailability(listingId: string) {
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!listingId || Config.useMock) return

    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const sixMonths = new Date()
    sixMonths.setMonth(sixMonths.getMonth() + 6)
    const max = sixMonths.toISOString().split('T')[0]

    void supabase
      .from('rentivo_availability')
      .select('blocked_date')
      .eq('listing_id', listingId)
      .gte('blocked_date', today)
      .lte('blocked_date', max)
      .then(({ data }) => {
        setBlockedDates((data ?? []).map(r => r.blocked_date as string))
        setLoading(false)
      })
  }, [listingId])

  return { blockedDates, loading }
}
