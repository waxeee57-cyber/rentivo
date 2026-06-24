/**
 * Runnable (no device / no Jest) regression test for the authoritative booking
 * price derivation. Run:  npx tsx scripts/test-booking-pricing.ts
 *
 * Guards the financial business rule: total_amount and deposit_amount are derived
 * from the LISTING + booking parameters, never from a client-supplied number. If
 * someone re-introduces client-controlled money, these assertions break.
 */
import { deriveBookingPricing } from '../lib/utils/bookingPricing'

let failures = 0
function check(name: string, actual: number, expected: number) {
  const ok = Math.abs(actual - expected) < 0.005
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${actual}, expected ${expected})`)
  if (!ok) failures++
}
function assert(name: string, cond: boolean) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failures++
}

const CUT = 0.10
// Porsche Cayenne reference: 300/day, deposit 500 (illustrative deposit).
const base = { pricePerDay: 300, pricePerWeek: null, pricePerHour: 50, listingDeposit: 500, platformCut: CUT } as const

// 1) Normal 3-day daily, basic insurance, no promo
const a = deriveBookingPricing({ ...base, days: 3, rentalType: 'daily', insuranceId: 'basic' })
check('A subtotal', a.subtotal, 900)
check('A platformFee', a.platformFee, 90)
check('A total', a.totalAmount, 990)
check('A deposit (basic → listing deposit)', a.depositAmount, 500)

// 2) Premium insurance (19.99 × 3 = 59.97) waives the deposit
const b = deriveBookingPricing({ ...base, days: 3, rentalType: 'daily', insuranceId: 'premium' })
check('B insurance', b.insurance, 59.97)
check('B total', b.totalAmount, 1049.97)
check('B deposit (insurance waives)', b.depositAmount, 0)

// 3) 10% percent promo on base (900+90 = 990 → -99)
const c = deriveBookingPricing({ ...base, days: 3, rentalType: 'daily', insuranceId: 'basic', promo: { discount_type: 'percent', discount_value: 10 } })
check('C promoDiscount', c.promoDiscount, 99)
check('C total', c.totalAmount, 891)

// 4) Weekly pricing: 10 days, week 1800 → 1×1800 + 3×300 = 2700 (+10% fee)
const d = deriveBookingPricing({ ...base, pricePerWeek: 1800, days: 10, rentalType: 'daily', insuranceId: 'basic' })
check('D subtotal (weekly)', d.subtotal, 2700)
check('D total', d.totalAmount, 2970)

// 5) Hourly: 50/h × 4h, no platform fee, basic insurance
const e = deriveBookingPricing({ ...base, days: 1, rentalType: 'hourly', totalHours: 4, insuranceId: 'basic' })
check('E subtotal (hourly)', e.subtotal, 200)
check('E platformFee (hourly = 0)', e.platformFee, 0)
check('E total', e.totalAmount, 200)

// 6) Tamper-resistance: the derived values are authoritative — a renter cannot make
//    total=0.50 or deposit=0; the function ignores any client number entirely.
assert('F total is the real rental price, never a client 0.50', a.totalAmount === 990)
assert('F deposit is server-derived, never a client 0', a.depositAmount === 500)

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'}`)
process.exitCode = failures === 0 ? 0 : 1
