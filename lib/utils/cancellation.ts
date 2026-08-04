import { differenceInHours } from 'date-fns'
import type { CancellationPolicy, CancellationResult } from '@/types'
import { t } from '@/constants/i18n'

type Lang = 'en' | 'es' | 'hu'

export function calculateCancellationRefund(
  policy: CancellationPolicy,
  startDate: string,
  totalAmount: number,
  language: Lang = 'en',
  now = new Date(),
): CancellationResult {
  const start = new Date(startDate)
  const hoursUntilStart = differenceInHours(start, now)

  switch (policy) {
    case 'flexible':
      if (hoursUntilStart >= 24) {
        return { refundAmount: totalAmount, refundPercent: 100, message: t('rcFull24', language) }
      }
      return { refundAmount: 0, refundPercent: 0, message: t('rcNone24', language) }

    case 'moderate':
      if (hoursUntilStart >= 48) {
        return { refundAmount: totalAmount, refundPercent: 100, message: t('rcFull48', language) }
      }
      if (hoursUntilStart >= 24) {
        const refund = Math.round(totalAmount * 0.5)
        return { refundAmount: refund, refundPercent: 50, message: t('rcHalf2448', language) }
      }
      return { refundAmount: 0, refundPercent: 0, message: t('rcNone24', language) }

    case 'strict':
      if (hoursUntilStart >= 72) {
        return { refundAmount: totalAmount, refundPercent: 100, message: t('rcFull72', language) }
      }
      return { refundAmount: 0, refundPercent: 0, message: t('rcNone72', language) }
  }
}

export function getCancellationPolicyLabel(
  policy: CancellationPolicy,
  language: Lang = 'en',
): string {
  const keys: Record<CancellationPolicy, 'clFlexible' | 'clModerate' | 'clStrict'> = {
    flexible: 'clFlexible',
    moderate: 'clModerate',
    strict: 'clStrict',
  }
  return t(keys[policy], language)
}

export function getCancellationPolicyColor(policy: CancellationPolicy): string {
  return policy === 'flexible' ? '#2D9B6F' : policy === 'moderate' ? '#E8A44A' : '#E05252'
}

