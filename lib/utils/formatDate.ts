import { format, differenceInDays, isToday, isTomorrow } from 'date-fns'

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMM d, yyyy')
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMM d')
}

export function formatDateRange(start: string | Date, end: string | Date): string {
  return `${formatDateShort(start)} – ${formatDateShort(end)}`
}

export function getDayCount(start: Date, end: Date): number {
  return Math.max(1, differenceInDays(end, start))
}

export function isDateToday(date: string | Date): boolean {
  return isToday(typeof date === 'string' ? new Date(date) : date)
}

export function isDateTomorrow(date: string | Date): boolean {
  return isTomorrow(typeof date === 'string' ? new Date(date) : date)
}
