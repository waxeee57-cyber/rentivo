/*
 * BOOKING.COM AFFILIATE SETUP:
 * 1. Regisztrálj: https://partners.booking.com
 * 2. Válaszd: "Affiliate Partner"
 * 3. Töltsd ki a cég adatokat (KFT kell!)
 * 4. Várj 2-3 munkanapot az elfogadásra
 * 5. Partner Centre-ben: Settings › API Access
 * 6. Másold ki az Affiliate ID-t és API token-t
 * 7. Add hozzá a .env fájlhoz
 * 8. Változtasd EXPO_PUBLIC_USE_MOCK=false-ra
 *
 * RENTALCARS AFFILIATE SETUP:
 * 1. Regisztrálj: https://www.rentalcars.com/affiliates
 * 2. Hasonló folyamat mint Booking.com
 *
 * EXPEDIA (VRBO) RAPID API:
 * 1. Regisztrálj: https://developers.expediagroup.com/docs/rapid
 * 2. Sandbox azonnal elérhető
 * 3. Production: ~100 foglalás/hó kell
 */

import type { ExternalListing, PlatformType } from '@/types'

const BOOKING_BASE_URL = 'https://demandapi.booking.com/3.1'

interface BookingSearchParams {
  city: string
  checkIn: string
  checkOut: string
  adults?: number
}

interface BookingCarSearchParams {
  pickupLocation: string
  pickupDate: string
  returnDate: string
  driverAge?: number
}

interface BookingAPIItem {
  id: number
  name: string
  description?: string
  photos?: BookingPhoto[]
  city?: string
  country?: string
  lat?: number
  lng?: number
  min_price?: number
  url: string
  deep_link_url?: string
  review_score?: number
  review_count?: number
}

interface BookingPhoto {
  url: string
}

interface BookingCarItem {
  id: string
  category: string
  supplier: string
  features?: string[]
  image?: string
  price_per_day?: number
  url: string
  affiliate_url?: string
}

function mapBookingItem(item: BookingAPIItem): ExternalListing {
  return {
    id: `booking-${item.id}`,
    connection_id: 'booking-affiliate',
    owner_id: 'booking',
    owner_type: 'operator',
    platform: 'booking' as PlatformType,
    external_id: String(item.id),
    title: item.name,
    description: item.description ?? null,
    category: 'villa',
    price_per_day: item.min_price ? Math.round(item.min_price * 100) : null,
    currency: 'EUR',
    images: item.photos?.map((p: BookingPhoto) => p.url) ?? [],
    cover_image_url: item.photos?.[0]?.url ?? null,
    city: item.city ?? null,
    country: item.country ?? null,
    latitude: item.lat ?? null,
    longitude: item.lng ?? null,
    external_url: item.url,
    affiliate_url: item.deep_link_url ?? item.url,
    available: true,
    rating: item.review_score ? item.review_score / 2 : null,
    review_count: item.review_count ?? 0,
    ical_url: null,
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
}

function mapBookingCarItem(item: BookingCarItem, city: string): ExternalListing {
  return {
    id: `booking-car-${item.id}`,
    connection_id: 'booking-cars-affiliate',
    owner_id: 'booking',
    owner_type: 'operator',
    platform: 'booking' as PlatformType,
    external_id: String(item.id),
    title: `${item.category} — ${item.supplier}`,
    description: item.features?.join(', ') ?? null,
    category: 'car',
    price_per_day: item.price_per_day ? Math.round(item.price_per_day * 100) : null,
    currency: 'EUR',
    images: item.image ? [item.image] : [],
    cover_image_url: item.image ?? null,
    city,
    country: null,
    latitude: null,
    longitude: null,
    external_url: item.url,
    affiliate_url: item.affiliate_url ?? item.url,
    available: true,
    rating: null,
    review_count: 0,
    ical_url: null,
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
}

export async function searchBookingAccommodations(
  params: BookingSearchParams,
  affiliateId: string,
  apiToken: string,
): Promise<ExternalListing[]> {
  if (process.env.EXPO_PUBLIC_USE_MOCK === 'true') {
    return MOCK_BOOKING_RESULTS
  }

  try {
    const response = await fetch(`${BOOKING_BASE_URL}/accommodations/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'X-Affiliate-Id': affiliateId,
      },
      body: JSON.stringify({
        booker: { country: 'hu', platform: 'mobile' },
        checkin: params.checkIn,
        checkout: params.checkOut,
        city: params.city,
        guests: {
          number_of_rooms: 1,
          number_of_adults: params.adults ?? 2,
        },
      }),
    })

    if (!response.ok) throw new Error(`Booking API error: ${response.status}`)
    const data = await response.json() as { data?: BookingAPIItem[] }
    return (data.data ?? []).map(mapBookingItem)
  } catch (err) {
    console.error('Booking.com API error:', err)
    return []
  }
}

export async function searchBookingCarRentals(
  params: BookingCarSearchParams,
  affiliateId: string,
  apiToken: string,
): Promise<ExternalListing[]> {
  if (process.env.EXPO_PUBLIC_USE_MOCK === 'true') {
    return MOCK_BOOKING_CAR_RESULTS
  }

  try {
    const response = await fetch(`${BOOKING_BASE_URL}/car-rentals/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'X-Affiliate-Id': affiliateId,
      },
      body: JSON.stringify({
        booker: { country: 'hu' },
        currency: 'EUR',
        driver: { age: params.driverAge ?? 30 },
        route: {
          pickup: {
            datetime: `${params.pickupDate}T10:00:00`,
            location: { city: params.pickupLocation },
          },
          dropoff: {
            datetime: `${params.returnDate}T10:00:00`,
            location: { city: params.pickupLocation },
          },
        },
      }),
    })

    if (!response.ok) throw new Error(`Booking Cars API error: ${response.status}`)
    const data = await response.json() as { data?: BookingCarItem[] }
    return (data.data ?? []).map(item => mapBookingCarItem(item, params.pickupLocation))
  } catch (err) {
    console.error('Booking.com Cars API error:', err)
    return []
  }
}

export const MOCK_BOOKING_RESULTS: ExternalListing[] = [
  {
    id: 'booking-mock-001',
    connection_id: 'booking-affiliate',
    owner_id: 'booking',
    owner_type: 'operator',
    platform: 'booking',
    external_id: 'booking-123',
    title: 'Hotel Marbella Club',
    description: 'Luxury beachfront hotel in Marbella.',
    category: 'villa',
    price_per_day: 28000,
    currency: 'EUR',
    images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'],
    cover_image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    city: 'Marbella',
    country: 'ES',
    latitude: 36.5101,
    longitude: -4.8824,
    external_url: 'https://www.booking.com',
    affiliate_url: 'https://www.booking.com',
    available: true,
    rating: 4.8,
    review_count: 234,
    ical_url: null,
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'booking-mock-002',
    connection_id: 'booking-affiliate',
    owner_id: 'booking',
    owner_type: 'operator',
    platform: 'booking',
    external_id: 'booking-124',
    title: 'Puente Romano Beach Resort',
    description: 'Five-star resort with private beach access.',
    category: 'villa',
    price_per_day: 45000,
    currency: 'EUR',
    images: ['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800'],
    cover_image_url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
    city: 'Marbella',
    country: 'ES',
    latitude: 36.5051,
    longitude: -4.8900,
    external_url: 'https://www.booking.com',
    affiliate_url: 'https://www.booking.com',
    available: true,
    rating: 4.9,
    review_count: 412,
    ical_url: null,
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
]

export const MOCK_BOOKING_CAR_RESULTS: ExternalListing[] = [
  {
    id: 'booking-car-mock-001',
    connection_id: 'booking-cars-affiliate',
    owner_id: 'booking',
    owner_type: 'operator',
    platform: 'booking',
    external_id: 'car-456',
    title: 'Economy Car — Sixt Marbella',
    description: 'VW Golf or similar. AC, GPS included.',
    category: 'car',
    price_per_day: 4500,
    currency: 'EUR',
    images: ['https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=800'],
    cover_image_url: 'https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=800',
    city: 'Marbella',
    country: 'ES',
    latitude: 36.5101,
    longitude: -4.8824,
    external_url: 'https://www.booking.com/cars',
    affiliate_url: 'https://www.booking.com/cars',
    available: true,
    rating: 4.2,
    review_count: 89,
    ical_url: null,
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'booking-car-mock-002',
    connection_id: 'booking-cars-affiliate',
    owner_id: 'booking',
    owner_type: 'operator',
    platform: 'booking',
    external_id: 'car-457',
    title: 'SUV — Europcar Marbella',
    description: 'Toyota RAV4 or similar. 5 seats, 4WD.',
    category: 'car',
    price_per_day: 7200,
    currency: 'EUR',
    images: ['https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800'],
    cover_image_url: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800',
    city: 'Marbella',
    country: 'ES',
    latitude: 36.5101,
    longitude: -4.8824,
    external_url: 'https://www.booking.com/cars',
    affiliate_url: 'https://www.booking.com/cars',
    available: true,
    rating: 4.5,
    review_count: 156,
    ical_url: null,
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
]
