// ════════════════════════════════════════════════════════════════════════════
// Authoritative booking price derivation — PURE, dependency-free.
// ════════════════════════════════════════════════════════════════════════════
// Single source of truth for the rental price. Used by:
//   • the client booking screen (display only — never the persist source),
//   • the create-booking edge function (which MIRRORS this exact formula in Deno),
//   • scripts/test-booking-pricing.ts (regression tests).
// Keep INSURANCE_PRICES in sync with INSURANCE_PACKAGES in types/index.ts.
//
// Formula mirrors the legacy client calc (lib/utils/calculatePrice.ts + the booking
// screen) so the server value matches what the user saw, but is computed from the
// LISTING + booking parameters — never from a client-supplied amount.

export const INSURANCE_PRICES: Record<string, number> = {
  basic: 0,
  standard: 9.99,
  premium: 19.99,
}

export interface BookingPriceInput {
  pricePerDay: number
  pricePerWeek?: number | null
  pricePerHour?: number | null
  listingDeposit: number
  days: number
  rentalType: 'daily' | 'hourly'
  totalHours?: number | null
  insuranceId: string
  /** Already server-validated promo, or null if none/invalid. */
  promo?: { discount_type: 'percent' | 'fixed'; discount_value: number } | null
  platformCut: number
}

export interface BookingPriceResult {
  days: number
  perDay: number
  subtotal: number
  platformFee: number
  insurance: number
  promoDiscount: number
  totalAmount: number
  depositAmount: number
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number): number => Math.round(n * 100) / 100

export function deriveBookingPricing(input: BookingPriceInput): BookingPriceResult {
  const cut = num(input.platformCut)
  const days = Math.max(1, Math.floor(num(input.days)))
  const perDay = num(input.pricePerDay)
  const perWeek = input.pricePerWeek != null ? num(input.pricePerWeek) : null
  const perHour = input.pricePerHour != null ? num(input.pricePerHour) : null

  const insurancePrice = INSURANCE_PRICES[input.insuranceId] ?? 0
  const insurance = round2(insurancePrice * days)

  let subtotal: number
  let platformFee: number
  if (input.rentalType === 'hourly') {
    const hours = Math.max(1, Math.floor(num(input.totalHours)))
    subtotal = round2((perHour ?? 0) * hours)
    platformFee = 0 // hourly carries no platform fee (mirrors client baseTotal)
  } else if (perWeek && perWeek > 0 && days >= 7) {
    const weeks = Math.floor(days / 7)
    subtotal = round2(weeks * perWeek + (days % 7) * perDay)
    platformFee = Math.round(subtotal * cut)
  } else {
    subtotal = round2(days * perDay)
    platformFee = Math.round(subtotal * cut)
  }

  const baseTotal = round2(subtotal + platformFee + insurance)
  let promoDiscount = 0
  if (input.promo) {
    promoDiscount = input.promo.discount_type === 'percent'
      ? round2((baseTotal * num(input.promo.discount_value)) / 100)
      : Math.min(num(input.promo.discount_value), baseTotal)
  }

  const totalAmount = Math.max(0, round2(baseTotal - promoDiscount))
  // Deposit Model B: a paid insurance package waives the deposit; otherwise the
  // listing's deposit. Derived from the listing — never from the client.
  const depositAmount = insurancePrice > 0 ? 0 : num(input.listingDeposit)

  return { days, perDay, subtotal, platformFee, insurance, promoDiscount, totalAmount, depositAmount }
}
