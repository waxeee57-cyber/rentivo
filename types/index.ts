export type UserRole = 'consumer' | 'operator' | 'host' | null

export type OwnerType = 'operator' | 'host'

export type CancellationPolicy = 'flexible' | 'moderate' | 'strict'

export interface CancellationResult {
  refundAmount: number
  refundPercent: number
  message: string
}

export type RentalCategory =
  | 'car' | 'motorcycle' | 'yacht' | 'villa'
  | 'bike' | 'scooter' | 'kayak' | 'surfboard'
  | 'equipment' | 'other'

export type BookingStatus =
  | 'pending' | 'confirmed' | 'active'
  | 'completed' | 'cancelled' | 'disputed'

export type PaymentStatus =
  | 'pending' | 'paid' | 'failed' | 'refunded'

export type FuelLevel =
  | 'empty' | 'quarter' | 'half' | 'three_quarters' | 'full'

export interface Host {
  id: string
  auth_id: string | null
  name: string
  bio: string | null
  avatar_url: string | null
  phone: string | null
  email: string | null
  city: string
  country: string
  rating: number
  review_count: number
  verified: boolean
  identity_verified: boolean
  stripe_account_id: string | null
  stripe_onboarded: boolean
  response_rate: number
  response_time: string
  member_since: string
  total_rentals: number
  active: boolean
  created_at: string
}

export interface Operator {
  id: string
  auth_id: string | null
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  cover_image_url: string | null
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  city: string
  country: string
  latitude: number
  longitude: number
  rating: number
  review_count: number
  verified: boolean
  active: boolean
  stripe_account_id: string | null
  stripe_onboarded: boolean
  tier?: 'new' | 'verified' | 'top' | 'elite'
  total_bookings?: number
  response_rate?: number
  avg_rating?: number
  created_at: string
  delivery_enabled?: boolean
  delivery_radius_km?: number
  delivery_fee_eur?: number
  delivery_zones?: string[]
  requires_identity_verification?: boolean
}

export interface Listing {
  id: string
  operator_id: string
  title: string
  description: string | null
  category: RentalCategory
  subcategory: string | null
  price_per_day: number
  price_per_week: number | null
  deposit_amount: number
  currency: string
  available: boolean
  min_rental_days: number
  max_rental_days: number | null
  capacity: number | null
  year: number | null
  make: string | null
  model: string | null
  color: string | null
  license_plate: string | null
  features: string[]
  rules: string | null
  images: string[]
  cover_image_url: string | null
  cancellation_policy?: CancellationPolicy
  pickup_address: string | null
  latitude: number | null
  longitude: number | null
  rating: number
  review_count: number
  booking_count: number
  created_at: string
  operator?: Operator
  owner_type?: OwnerType
  host_id?: string | null
  host?: Host
  instant_book?: boolean
  str_registration_number?: string | null
  hourly_rental_enabled?: boolean
  price_per_hour?: number | null
  min_rental_hours?: number | null
  pricing_rules?: {
    weekend_multiplier?: number
    peak_months?: number[]
    peak_multiplier?: number
    weekly_discount?: number
    monthly_discount?: number
  }
}

export interface RentivoUser {
  id: string
  auth_id: string
  name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  nationality: string | null
  driver_license_no: string | null
  driver_license_exp: string | null
  push_token: string | null
  preferred_currency: string
  preferred_language: string
  created_at: string
  identity_status?: 'unverified' | 'pending' | 'verified' | 'rejected'
  is_admin?: boolean
  is_banned?: boolean
}

export interface Booking {
  id: string
  listing_id: string
  operator_id: string
  user_id: string | null
  guest_name: string
  guest_email: string | null
  guest_phone: string | null
  guest_nationality: string | null
  driver_license_no: string | null
  start_date: string
  end_date: string
  total_days: number
  pickup_time: string | null
  return_time: string | null
  pickup_location: string | null
  price_per_day: number
  subtotal: number
  platform_fee: number
  total_amount: number
  deposit_amount: number
  currency: string
  status: BookingStatus
  payment_status: PaymentStatus
  payment_intent_id: string | null
  paid_at: string | null
  contract_signed_at: string | null
  contract_url: string | null
  consumer_signature: string | null
  operator_signature: string | null
  pickup_damage_done: boolean
  return_damage_done: boolean
  has_damage_claim: boolean
  notes: string | null
  created_at: string
  listing?: Listing
  operator?: Operator
  host_id?: string | null
  owner_type?: OwnerType
  host?: Host
  delivery_requested?: boolean
  delivery_address?: string | null
  delivery_fee?: number
  rental_type?: 'daily' | 'hourly'
  start_time?: string | null
  end_time?: string | null
  total_hours?: number | null
  // Digital contract + e-signature (eIDAS SES)
  contract_html?: string | null
  guest_signature?: string | null
  operator_signature_data?: string | null
  guest_signed_at?: string | null
  operator_signed_at?: string | null
  contract_status?: string | null
  // Flight tracking
  flight_number?: string | null
  flight_arrival_time?: string | null
  flight_status?: string | null
  // Promo code
  promo_code?: string | null
  promo_discount?: number
  // Identity verification
  requires_identity_verification?: boolean
  identity_verified?: boolean
}

export interface DamageReport {
  id: string
  booking_id: string
  listing_id: string
  operator_id: string
  type: 'pickup' | 'return'
  photo_front: string | null
  photo_back: string | null
  photo_left: string | null
  photo_right: string | null
  photo_interior: string | null
  photo_extra: string | null
  mileage: number | null
  fuel_level: FuelLevel | null
  notes: string | null
  damage_found: boolean
  damage_notes: string | null
  operator_signed: boolean
  consumer_signed: boolean
  operator_signature: string | null
  consumer_signature: string | null
  signed_at: string | null
  created_at: string
}

export interface Review {
  id: string
  booking_id: string
  listing_id: string
  operator_id: string
  user_id: string | null
  rating: number
  comment: string | null
  reply: string | null
  reply_at: string | null
  created_at: string
}

export interface Conversation {
  id: string
  booking_id: string
  listing_id: string
  operator_id: string
  user_id: string | null
  guest_name: string | null
  last_message: string | null
  last_message_at: string | null
  unread_consumer: number
  unread_operator: number
  created_at: string
  listing?: Listing
  operator?: Operator
}

export interface Message {
  id: string
  conversation_id: string
  sender_role: 'consumer' | 'operator' | 'system'
  sender_id: string | null
  content: string
  read: boolean
  created_at: string
}

export interface PriceCalculation {
  subtotal: number
  platformFee: number
  total: number
  perDay: number
  deposit: number
  breakdown: string
}

export interface SearchFilters {
  category?: RentalCategory | null
  city?: string | null
  startDate?: Date | null
  endDate?: Date | null
  minPrice?: number | null
  maxPrice?: number | null
  minCapacity?: number | null
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'newest'
}

export type PlatformType = 'airbnb' | 'booking' | 'vrbo' | 'turo' | 'holidu' | 'other'

export interface PlatformConnection {
  id: string
  owner_id: string
  platform: PlatformType
  ical_url: string | null
  external_url: string | null
  active: boolean
  created_at: string
}

export interface ExternalListing {
  id: string
  connection_id: string
  owner_id: string
  owner_type: OwnerType
  platform: PlatformType
  external_id: string
  title: string
  description: string | null
  category: string
  price_per_day: number | null
  currency: string
  images: string[]
  cover_image_url: string | null
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  external_url: string
  affiliate_url: string
  available: boolean
  rating: number | null
  review_count: number
  ical_url: string | null
  last_synced_at: string
  created_at: string
}

export type AnyListing =
  | (Listing & { sourceType: 'native' })
  | (ExternalListing & { sourceType: 'external' })

// ── Damage waiver (tier ids persisted as `insurance_id`) ─────────────────────
// User-visible copy calls this a DAMAGE WAIVER, never insurance: there is no
// underwriter and Rentivo is not a registered insurance intermediary (IDD
// 2016/97). The identifiers below stay `INSURANCE_*` / `InsuranceId` on purpose —
// they map 1:1 to the `insurance_id` DB column, the create-booking request field
// and INSURANCE_PRICES in the edge functions, so renaming them would require a
// data migration. Only the i18n VALUES behind nameKey/descKey changed.
export const INSURANCE_PACKAGES = [
  {
    id: 'basic' as const,
    nameKey: 'insuranceBasic' as const,
    descKey: 'insuranceBasicDesc' as const,
    price: 0,
    icon: '🛡️',
  },
  {
    id: 'standard' as const,
    nameKey: 'insuranceStandard' as const,
    descKey: 'insuranceStandardDesc' as const,
    price: 9.99,
    icon: '🛡️🛡️',
  },
  {
    id: 'premium' as const,
    nameKey: 'insurancePremium' as const,
    descKey: 'insurancePremiumDesc' as const,
    price: 19.99,
    icon: '🛡️🛡️🛡️',
    recommended: true,
  },
] as const

export type InsuranceId = typeof INSURANCE_PACKAGES[number]['id']

export interface PromoCode {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  max_uses: number
  current_uses: number
  valid_from: string
  valid_until: string | null
  min_booking_value: number
  created_at: string
}

export interface Referral {
  id: string
  referrer_user_id: string
  referred_user_id: string | null
  referral_code: string
  status: string
  reward_points: number
  created_at: string
}

export interface OperatorStaffMember {
  id: string
  operator_id: string
  user_id: string | null
  email: string
  role: 'admin' | 'staff' | 'viewer'
  status: 'invited' | 'active' | 'suspended'
  invited_at: string
  joined_at: string | null
}

export interface IdentityVerification {
  id: string
  user_id: string
  didit_session_id: string | null
  status: 'pending' | 'in_progress' | 'approved' | 'declined' | 'expired'
  document_type: string | null
  document_country: string | null
  document_number: string | null
  full_name: string | null
  date_of_birth: string | null
  document_expires_at: string | null
  face_match_score: number | null
  liveness_passed: boolean | null
  verified_at: string | null
  created_at: string
  updated_at: string
}
