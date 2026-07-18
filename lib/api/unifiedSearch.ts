import { fetchListings } from './listings'
import { searchBookingAccommodations, searchBookingCarRentals } from './booking-affiliate'
import { captureException } from '@/lib/sentry'
import type { Listing, ExternalListing, SearchFilters, AnyListing } from '@/types'

interface UnifiedSearchParams extends SearchFilters {
  checkIn?: string
  checkOut?: string
  includeExternal?: boolean
}

export async function searchAllSources(
  filters: UnifiedSearchParams,
): Promise<AnyListing[]> {
  const nativePromise: Promise<AnyListing[]> = fetchListings(filters).then(listings =>
    listings.map((l: Listing) => ({ ...l, sourceType: 'native' as const })),
  )

  let externalPromise: Promise<AnyListing[]> = Promise.resolve([])

  const affiliateId = process.env.EXPO_PUBLIC_BOOKING_AFFILIATE_ID
  const isMock = process.env.EXPO_PUBLIC_USE_MOCK === 'true'

  // Booking.com Demand API needs a SECRET bearer token. It must never be shipped
  // in the client bundle — with no EXPO_PUBLIC_ prefix `process.env.BOOKING_API_TOKEN`
  // is ALWAYS undefined at runtime here, so any live authenticated request would 401.
  // Live external search therefore requires a server-side proxy (Supabase Edge
  // Function) — tracked in CLAUDE.md "JÖVŐBENI KAPUK: Booking.com Affiliate API".
  // Until that proxy exists we only serve external results in mock mode. In a real
  // build we cleanly skip the doomed request instead of firing it and swallowing
  // the 401 silently.
  const externalEnabled =
    filters.includeExternal !== false &&
    Boolean(filters.checkIn && filters.checkOut) &&
    isMock

  if (externalEnabled) {
    const city = filters.city ?? 'Marbella'
    const checkIn = filters.checkIn as string
    const checkOut = filters.checkOut as string

    externalPromise = Promise.all([
      searchBookingAccommodations({ city, checkIn, checkOut }, affiliateId ?? '', ''),
      searchBookingCarRentals(
        { pickupLocation: city, pickupDate: checkIn, returnDate: checkOut },
        affiliateId ?? '',
        '',
      ),
    ]).then(([accom, cars]): AnyListing[] =>
      [...accom, ...cars].map((l: ExternalListing) => ({ ...l, sourceType: 'external' as const })),
    ).catch((err): AnyListing[] => {
      // Never fail the whole search because an external source broke — but do NOT
      // swallow it silently: surface to telemetry so the failure is observable.
      captureException(err, { scope: 'unifiedSearch.external' })
      return []
    })
  }

  const [native, external] = await Promise.all([nativePromise, externalPromise])
  return [...native, ...external]
}
