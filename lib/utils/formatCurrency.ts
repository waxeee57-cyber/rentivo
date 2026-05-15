const EUR_TO_HUF = 400

/**
 * Formats a price stored in whole euros (e.g. 150 → "€150").
 * Prices in the DB are DECIMAL(10,2) EUR — NOT cents. Do NOT divide by 100.
 */
export function formatEUR(euros: number): string {
  return `€${Math.round(euros).toLocaleString('en-US')}`
}

export function formatEURDecimal(euros: number): string {
  return `€${euros.toFixed(2)}`
}

export function formatPrice(euros: number, language: string): string {
  if (language === 'hu') {
    const huf = Math.round(euros * EUR_TO_HUF)
    return `${huf.toLocaleString('hu-HU')} Ft`
  }
  return `€${Math.round(euros).toLocaleString('en-US')}`
}

export function formatPricePerDay(euros: number, language: string): string {
  if (language === 'hu') {
    const huf = Math.round(euros * EUR_TO_HUF)
    return `${huf.toLocaleString('hu-HU')} Ft/nap`
  }
  return `€${Math.round(euros).toLocaleString('en-US')}/day`
}
