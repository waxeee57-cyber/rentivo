import { differenceInDays, isBefore, startOfDay } from 'date-fns'

export function validateDateRange(
  start: Date,
  end: Date,
  minDays = 1,
  maxDays?: number | null,
): string | null {
  const today = startOfDay(new Date())
  if (isBefore(start, today)) return 'Start date cannot be in the past'
  if (!isBefore(start, end)) return 'End date must be after start date'
  const days = differenceInDays(end, start)
  if (days < minDays) return `Minimum rental is ${minDays} day(s)`
  if (maxDays && days > maxDays) return `Maximum rental is ${maxDays} day(s)`
  return null
}
