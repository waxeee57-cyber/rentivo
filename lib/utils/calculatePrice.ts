import type { PriceCalculation } from '@/types'

const PLATFORM_CUT = parseFloat(process.env.EXPO_PUBLIC_PLATFORM_CUT ?? '0.025')

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
      ? `${weeks}w × €${(pricePerWeek / 100).toFixed(0)} + ${remainingDays}d × €${(pricePerDay / 100).toFixed(0)}`
      : `${weeks}w × €${(pricePerWeek / 100).toFixed(0)}`
  } else {
    subtotal = totalDays * pricePerDay
    breakdown = `${totalDays} days × €${(pricePerDay / 100).toFixed(0)}`
  }

  const platformFee = Math.round(subtotal * PLATFORM_CUT)
  const total = subtotal + platformFee

  return { subtotal, platformFee, total, perDay: pricePerDay, deposit: depositAmount, breakdown }
}
