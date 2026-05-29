import type { PriceCalculation } from '@/types'

const PLATFORM_CUT = parseFloat(process.env.EXPO_PUBLIC_PLATFORM_CUT ?? '0.10')

/**
 * Calculates price breakdown. All prices are in whole euros (not cents).
 */
export function calculatePrice(
  pricePerDay: number,
  totalDays: number,
  depositAmount: number,
  pricePerWeek?: number | null,
): PriceCalculation {
  let subtotal = 0
  let breakdown = ''

  const weeks = Math.floor(totalDays / 7)
  const remainingDays = totalDays % 7

  if (pricePerWeek && weeks > 0) {
    const weeklyTotal = weeks * pricePerWeek
    const dailyRemainder = remainingDays * pricePerDay
    subtotal = weeklyTotal + dailyRemainder
    breakdown = weeks > 0 && remainingDays > 0
      ? `${weeks}w × €${Math.round(pricePerWeek)} + ${remainingDays}d × €${Math.round(pricePerDay)}`
      : `${weeks}w × €${Math.round(pricePerWeek)}`
  } else {
    subtotal = totalDays * pricePerDay
    breakdown = `${totalDays} days × €${Math.round(pricePerDay)}`
  }

  const platformFee = Math.round(subtotal * PLATFORM_CUT)
  const total = subtotal + platformFee

  return { subtotal, platformFee, total, perDay: pricePerDay, deposit: depositAmount, breakdown }
}
