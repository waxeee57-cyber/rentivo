import { format, differenceInDays, isToday, isTomorrow } from 'date-fns'
import { enUS, es, hu } from 'date-fns/locale'
import type { Locale } from 'date-fns'

export type AppLanguage = 'en' | 'es' | 'hu'

// date-fns `format()` silently defaults to en-US when no `locale` is passed, so
// a Hungarian user was shown "August 2026" / "Mon, Aug 10". Every formatter here
// now takes the active app language. The parameter is OPTIONAL (default 'en') so
// the ~25 pre-existing call sites keep compiling and can be migrated one by one.
const LOCALES: Record<AppLanguage, Locale> = { en: enUS, es, hu }

/**
 * Locale object for one-off `format()` calls in other files:
 *   format(d, 'EEE', { locale: dateLocale(language) })
 */
export function dateLocale(language: string = 'en'): Locale {
  return LOCALES[language as AppLanguage] ?? enUS
}

// Day/month ordering differs per language, so a single hardcoded pattern cannot
// serve all three: Spanish puts the day first ("4 ago"), Hungarian puts the
// month first and marks the day with a period ("aug. 4.").
const SHORT_PATTERNS: Record<AppLanguage, string> = {
  en: 'MMM d',
  es: 'd MMM',
  hu: 'MMM d.',
}

// Hungarian writes the year first ("2026. augusztus"); EN/ES write it last.
const MONTH_YEAR_PATTERNS: Record<AppLanguage, string> = {
  en: 'MMMM yyyy',
  es: 'MMMM yyyy',
  hu: 'yyyy. MMMM',
}

function lang(language: string): AppLanguage {
  return language === 'es' || language === 'hu' ? language : 'en'
}

export function formatDate(date: string | Date, language: string = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  // 'PP' is date-fns' locale-aware long-date token — it resolves to
  // "Aug 4, 2026" / "4 ago 2026" / "2026. aug. 4." rather than forcing
  // English word order onto every locale.
  return format(d, 'PP', { locale: dateLocale(language) })
}

export function formatDateShort(date: string | Date, language: string = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, SHORT_PATTERNS[lang(language)], { locale: dateLocale(language) })
}

export function formatDateRange(
  start: string | Date,
  end: string | Date,
  language: string = 'en',
): string {
  return `${formatDateShort(start, language)} – ${formatDateShort(end, language)}`
}

/** Calendar month header, e.g. "August 2026" / "agosto 2026" / "2026. augusztus". */
export function formatMonthYear(date: Date, language: string = 'en'): string {
  return format(date, MONTH_YEAR_PATTERNS[lang(language)], { locale: dateLocale(language) })
}

/** Weekday + short date, e.g. "Mon, Aug 10" / "lun, 10 ago" / "hétfő, aug. 10." */
export function formatWeekdayShort(date: string | Date, language: string = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, `EEE, ${SHORT_PATTERNS[lang(language)]}`, { locale: dateLocale(language) })
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
