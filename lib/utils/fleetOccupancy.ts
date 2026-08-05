/**
 * Fleet occupancy maths for the operator analytics screen.
 *
 * Occupancy used to be `bookings.length / 30`, which is not an occupancy at all:
 * it ignored how many vehicles the operator has, ignored how long each booking
 * actually runs, and ignored the selected period (the 30 was a constant whether
 * you picked week, month, quarter or year). One 1-day booking and one 30-day
 * booking scored identically, and a 40-car fleet scored the same as a 1-car
 * fleet. Occupancy is a utilisation ratio, so it has to be booked vehicle-days
 * over available vehicle-days.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Only the fields occupancy needs, so callers can pass Booking rows straight in. */
export interface OccupancyBooking {
  start_date?: string | null
  end_date?: string | null
}

/** Fractional days between two instants. Never negative, never NaN. */
export function daysBetween(startMs: number, endMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0
  return Math.max(0, (endMs - startMs) / MS_PER_DAY)
}

/**
 * Days of one booking that fall inside [periodStartMs, periodEndMs].
 *
 * Bookings are clipped, not dropped: a rental that started before the window
 * contributes only the days inside it, and one that runs past the window end
 * contributes only up to the end. Without the clip a 90-day rental would report
 * 90 booked days against a 30-day period and push occupancy over 100%.
 */
export function bookedDaysInWindow(
  booking: OccupancyBooking,
  periodStartMs: number,
  periodEndMs: number,
): number {
  const startMs = Date.parse(booking.start_date ?? '')
  const endMs = Date.parse(booking.end_date ?? '')
  // A row with an unparseable or inverted range contributes nothing rather than
  // poisoning the whole sum with NaN.
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0
  return daysBetween(Math.max(startMs, periodStartMs), Math.min(endMs, periodEndMs))
}

/**
 * Occupancy as a whole percent, or null when there is no meaningful denominator.
 *
 * Returns null rather than 0 when the operator has no active listings or the
 * window has no length: 0% reads as "your fleet sat idle" when the truth is
 * "there is no fleet to measure", and dividing by a zero fleet produced NaN or
 * Infinity. The caller renders a dash for null.
 */
export function calculateOccupancyRate(
  bookings: readonly OccupancyBooking[],
  activeListingCount: number,
  periodStart: Date,
  periodEnd: Date,
): number | null {
  const periodStartMs = periodStart.getTime()
  const periodEndMs = periodEnd.getTime()
  const windowDays = daysBetween(periodStartMs, periodEndMs)
  if (!Number.isFinite(activeListingCount) || activeListingCount <= 0) return null
  if (windowDays <= 0) return null

  const bookedDays = bookings.reduce(
    (sum, b) => sum + bookedDaysInWindow(b, periodStartMs, periodEndMs),
    0,
  )
  const rate = (bookedDays / (activeListingCount * windowDays)) * 100
  // Two bookings overlapping on one vehicle (double-booked, or a same-day
  // turnaround counted on both rows) can push the raw ratio past 100.
  return Math.min(100, Math.max(0, Math.round(rate)))
}
