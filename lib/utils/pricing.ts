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
