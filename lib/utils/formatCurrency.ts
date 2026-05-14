const EUR_TO_HUF = 400

export function formatEUR(cents: number): string {
  return `€${(cents / 100).toFixed(0)}`
}

export function formatEURDecimal(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

export function formatPrice(cents: number, language: string): string {
  const euros = cents / 100
  if (language === 'hu') {
    const huf = Math.round(euros * EUR_TO_HUF)
    return `${huf.toLocaleString('hu-HU')} Ft`
  }
  return `€${euros.toFixed(0)}`
}

export function formatPricePerDay(cents: number, language: string): string {
  const euros = cents / 100
  if (language === 'hu') {
    const huf = Math.round(euros * EUR_TO_HUF)
    return `${huf.toLocaleString('hu-HU')} Ft/nap`
  }
  return `€${euros.toFixed(0)}/day`
}
