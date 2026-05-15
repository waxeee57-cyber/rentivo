export interface PriceCalc {
  checkIn: string
  checkOut: string
  pricePerDay: number
  deposit: number
  platformCut: number
}

export interface PriceBreakdown {
  nights: number
  subtotal: number
  serviceFee: number
  total: number
  deposit: number
  operatorReceives: number
}

export function calculatePriceByDates(calc: PriceCalc): PriceBreakdown {
  const checkIn = new Date(calc.checkIn)
  const checkOut = new Date(calc.checkOut)
  const nights = Math.max(
    1,
    Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
  )

  const subtotal = calc.pricePerDay * nights
  const serviceFee = Math.round(subtotal * calc.platformCut)
  const total = subtotal + serviceFee
  const operatorReceives = subtotal - Math.round(subtotal * 0.08)

  return { nights, subtotal, serviceFee, total, deposit: calc.deposit, operatorReceives }
}

export function getWeeklyDiscount(nights: number, pricePerDay: number): {
  hasDiscount: boolean
  discountPercent: number
  weeklyPrice: number
} {
  if (nights < 7) return { hasDiscount: false, discountPercent: 0, weeklyPrice: 0 }
  const discountPercent = nights >= 28 ? 25 : nights >= 14 ? 20 : 15
  const weeklyPrice = Math.round(pricePerDay * 7 * (1 - discountPercent / 100))
  return { hasDiscount: true, discountPercent, weeklyPrice }
}

export interface DynamicPricingRules {
  weekend_multiplier?: number
  peak_months?: number[]
  peak_multiplier?: number
  weekly_discount?: number
  monthly_discount?: number
}

export interface DayPrice {
  date: string
  basePrice: number
  multiplier: number
  finalPrice: number
  reason: string
}

export interface DynamicPriceResult {
  total: number
  breakdown: DayPrice[]
  avgPerDay: number
  hasDiscount: boolean
  discountAmount: number
}

export function calculateDynamicPrice(
  basePrice: number,
  startDate: Date,
  endDate: Date,
  rules: DynamicPricingRules
): DynamicPriceResult {
  const breakdown: DayPrice[] = []
  const current = new Date(startDate)

  while (current < endDate) {
    const dayOfWeek = current.getDay()
    const month = current.getMonth() + 1
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isPeak = rules.peak_months?.includes(month) ?? false

    let multiplier = 1
    let reason = 'standard'

    if (isPeak && isWeekend) {
      multiplier = (rules.peak_multiplier ?? 1.5) * (rules.weekend_multiplier ?? 1.3)
      reason = 'peak + weekend'
    } else if (isPeak) {
      multiplier = rules.peak_multiplier ?? 1.5
      reason = 'peak season'
    } else if (isWeekend) {
      multiplier = rules.weekend_multiplier ?? 1.3
      reason = 'weekend'
    }

    const finalPrice = Math.round(basePrice * multiplier * 100) / 100

    breakdown.push({
      date: current.toISOString().split('T')[0],
      basePrice,
      multiplier,
      finalPrice,
      reason,
    })

    current.setDate(current.getDate() + 1)
  }

  const subtotal = breakdown.reduce((sum, d) => sum + d.finalPrice, 0)
  const totalDays = breakdown.length
  let discountAmount = 0

  if (totalDays >= 30 && rules.monthly_discount) {
    discountAmount = subtotal * rules.monthly_discount
  } else if (totalDays >= 7 && rules.weekly_discount) {
    discountAmount = subtotal * rules.weekly_discount
  }

  const total = Math.round((subtotal - discountAmount) * 100) / 100

  return {
    total,
    breakdown,
    avgPerDay: Math.round((total / totalDays) * 100) / 100,
    hasDiscount: discountAmount > 0,
    discountAmount: Math.round(discountAmount * 100) / 100,
  }
}
