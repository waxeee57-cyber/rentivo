import { differenceInHours } from 'date-fns'
import type { CancellationPolicy, CancellationResult } from '@/types'

export function calculateCancellationRefund(
  policy: CancellationPolicy,
  startDate: string,
  totalAmount: number,
  now = new Date(),
): CancellationResult {
  const start = new Date(startDate)
  const hoursUntilStart = differenceInHours(start, now)

  switch (policy) {
    case 'flexible':
      if (hoursUntilStart >= 24) {
        return {
          refundAmount: totalAmount,
          refundPercent: 100,
          message: 'Full refund — cancelled more than 24 hours before pickup',
        }
      }
      return {
        refundAmount: 0,
        refundPercent: 0,
        message: 'No refund — cancelled less than 24 hours before pickup',
      }

    case 'moderate':
      if (hoursUntilStart >= 48) {
        return {
          refundAmount: totalAmount,
          refundPercent: 100,
          message: 'Full refund — cancelled more than 48 hours before pickup',
        }
      }
      if (hoursUntilStart >= 24) {
        const refund = Math.round(totalAmount * 0.5)
        return {
          refundAmount: refund,
          refundPercent: 50,
          message: '50% refund — cancelled 24–48 hours before pickup',
        }
      }
      return {
        refundAmount: 0,
        refundPercent: 0,
        message: 'No refund — cancelled less than 24 hours before pickup',
      }

    case 'strict':
      if (hoursUntilStart >= 72) {
        return {
          refundAmount: totalAmount,
          refundPercent: 100,
          message: 'Full refund — cancelled more than 72 hours before pickup',
        }
      }
      return {
        refundAmount: 0,
        refundPercent: 0,
        message: 'No refund — cancelled less than 72 hours before pickup',
      }
  }
}

export function getCancellationPolicyLabel(policy: CancellationPolicy): string {
  const labels: Record<CancellationPolicy, string> = {
    flexible: 'Flexible — Free cancellation up to 24h before',
    moderate: 'Moderate — 50% refund 24–48h before',
    strict: 'Strict — Full refund only 72h+ before',
  }
  return labels[policy]
}

export function getCancellationPolicyColor(policy: CancellationPolicy): string {
  return policy === 'flexible' ? '#2D9B6F' : policy === 'moderate' ? '#E8A44A' : '#E05252'
}

export function getCancellationPolicyEmoji(policy: CancellationPolicy): string {
  return policy === 'flexible' ? '🟢' : policy === 'moderate' ? '🟡' : '🔴'
}
