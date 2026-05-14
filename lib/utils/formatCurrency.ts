export function formatEUR(cents: number): string {
  return `€${(cents / 100).toFixed(0)}`
}

export function formatEURDecimal(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}
