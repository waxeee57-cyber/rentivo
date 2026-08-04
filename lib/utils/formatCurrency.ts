import { t } from '@/constants/i18n'

// NO client-side FX conversion. Prices are stored AND charged in EUR (Stripe
// charges euros), so the old `EUR_TO_HUF = 400` constant showed Hungarian users
// a HUF number that drifted from the amount actually taken off their card.
// We keep the euro VALUE and only localise grouping/symbol placement:
//   en → €1,500   es → 1.500 €   hu → 1 500 €
const LOCALE_TAGS: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  hu: 'hu-HU',
}

function localeTag(language: string): string {
  return LOCALE_TAGS[language] ?? LOCALE_TAGS.en
}

function eur(euros: number, language: string, fractionDigits: number): string {
  return new Intl.NumberFormat(localeTag(language), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(euros)
}

/**
 * Formats a price stored in whole euros (e.g. 150 → "€150").
 * Prices in the DB are DECIMAL(10,2) EUR — NOT cents. Do NOT divide by 100.
 * `language` is optional so existing call sites keep compiling.
 */
export function formatEUR(euros: number, language: string = 'en'): string {
  return eur(Math.round(euros), language, 0)
}

export function formatEURDecimal(euros: number, language: string = 'en'): string {
  return eur(euros, language, 2)
}

export function formatPrice(euros: number, language: string = 'en'): string {
  return eur(Math.round(euros), language, 0)
}

export function formatPricePerDay(euros: number, language: string = 'en'): string {
  // The "/day" suffix used to be concatenated as an English (or "Ft/nap")
  // literal; it now comes from the translation table like every other string.
  return `${eur(Math.round(euros), language, 0)}${t('priceSuffixPerDay', asLang(language))}`
}

function asLang(language: string): 'en' | 'es' | 'hu' {
  return language === 'es' || language === 'hu' ? language : 'en'
}
