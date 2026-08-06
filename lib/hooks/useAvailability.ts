import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'

const addDayISO = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

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
      // A booking (and each iCal sync) writes ONE RANGED row: blocked_date = start,
      // end_date = checkout. Manual single-day blocks leave end_date NULL. The old
      // code selected only blocked_date and mapped 1 row -> 1 day, so a 5-night
      // booking greyed out only its FIRST night and the other four looked free.
      .select('blocked_date, end_date')
      .eq('listing_id', listingId)
      // Keep any range still live in the window: end_date >= today catches ranges
      // that STARTED before today but have not ended (the old .gte('blocked_date')
      // dropped those entirely — a car rented through next week showed as free).
      // NULL-end single-day rows are filtered to [today, max] below.
      .or(`end_date.gte.${today},end_date.is.null`)
      .lte('blocked_date', max)
      .limit(400)
      .then(({ data }) => {
        const days = new Set<string>()
        for (const row of data ?? []) {
          const start = row.blocked_date as string
          const end = (row.end_date as string | null) ?? null
          if (!end || end <= start) {
            // Single-day block: block exactly blocked_date, if it's in the window.
            if (start >= today && start <= max) days.add(start)
            continue
          }
          // Ranged block is half-open [start, end): the checkout day (end) stays
          // free, matching create-booking's day-count and availability math. ISO
          // date strings compare lexicographically = chronologically.
          let cur = start < today ? today : start
          let guard = 0
          while (cur < end && cur <= max && guard++ < 400) {
            days.add(cur)
            cur = addDayISO(cur, 1)
          }
        }
        setBlockedDates([...days])
        setLoading(false)
      })
  }, [listingId])

  return { blockedDates, loading }
}
