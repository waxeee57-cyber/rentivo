import { Config } from '@/constants/config'

/**
 * What the owner (operator or host) ACTUALLY receives for a booking.
 *
 * Derived from `supabase/functions/create-payment-intent`, which sets
 *   transfer_data.destination  = the owner's Connect account
 *   application_fee_amount     = amountCents − subtotalCents
 * so Stripe transfers exactly the RENTAL SUBTOTAL to the owner. The platform
 * keeps the service fee and the damage-waiver revenue, and absorbs any
 * platform-funded promo discount.
 *
 * The important consequence, which the UI used to get backwards: the service
 * fee is charged to the RENTER ON TOP of the listed price. The owner is not
 * discounted — they receive 100% of what they listed.
 *
 * THE BUG THIS REPLACES: three screens computed `total_amount * 0.975`,
 * including the new-listing wizard that a prospective host decides to join on.
 * That was wrong twice over — 2.5% has never been the configured rate
 * (`Config.platformCut` is 10%), and the fee comes off the gross, not the
 * subtotal. The net effect was an earnings figure inflated by ~7%.
 */
export function ownerPayout(booking: { subtotal?: number | null; total_amount: number }): number {
  // `subtotal` is server-written by create-booking and healed at payment time,
  // so it is authoritative whenever present. Older rows may predate it.
  if (booking.subtotal != null && Number.isFinite(booking.subtotal) && booking.subtotal > 0) {
    return Math.round(booking.subtotal * 100) / 100
  }
  // Fallback for legacy rows: invert the fee off the gross. Cannot account for
  // waiver revenue, so it is an upper bound — never show it as exact.
  return Math.round((booking.total_amount / (1 + Config.platformCut)) * 100) / 100
}

/**
 * What a prospective owner earns per day from a listed price — i.e. the price
 * itself. Used by the listing wizard, where no booking exists yet.
 */
export function estimatedDailyPayout(pricePerDay: number): number {
  return Math.round(pricePerDay * 100) / 100
}

/** What the renter is charged per day for a listed price, fee included. */
export function renterPaysPerDay(pricePerDay: number): number {
  return Math.round(pricePerDay * (1 + Config.platformCut) * 100) / 100
}

/** The configured service fee as a display string, e.g. "10%" or "7.5%". */
export function serviceFeeLabel(): string {
  const pct = Config.platformCut * 100
  return `${pct.toFixed(Number.isInteger(pct) ? 0 : 1)}%`
}
