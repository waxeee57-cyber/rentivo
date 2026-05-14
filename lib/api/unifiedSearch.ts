import { fetchListings } from './listings'
import { searchBookingAccommodations, searchBookingCarRentals } from './booking-affiliate'
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
  const apiToken = process.env.BOOKING_API_TOKEN ?? ''
  const hasCredentials = Boolean(affiliateId) || process.env.EXPO_PUBLIC_USE_MOCK === 'true'

  if (
    filters.includeExternal !== false &&
    filters.checkIn &&
    filters.checkOut &&
    hasCredentials
  ) {
    const city = filters.city ?? 'Marbella'

    externalPromise = Promise.all([
      searchBookingAccommodations(
        { city, checkIn: filters.checkIn, checkOut: filters.checkOut },
        affiliateId ?? '',
        apiToken,
      ),
      searchBookingCarRentals(
        { pickupLocation: city, pickupDate: filters.checkIn, returnDate: filters.checkOut },
        affiliateId ?? '',
        apiToken,
      ),
    ]).then(([accom, cars]): AnyListing[] =>
      [...accom, ...cars].map((l: ExternalListing) => ({ ...l, sourceType: 'external' as const })),
    ).catch((): AnyListing[] => [])
  }

  const [native, external] = await Promise.all([nativePromise, externalPromise])
  return [...native, ...external]
}
