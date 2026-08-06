import { differenceInHours } from 'date-fns'
import type { CancellationPolicy, CancellationResult } from '@/types'
import { t } from '@/constants/i18n'

type Lang = 'en' | 'es' | 'hu'

/** Who pressed cancel. An owner-initiated cancellation always refunds in full. */
export type CancelledBy = 'traveler' | 'owner'

/**
 * The refund in euros, rounded to the CENT.
 *
 * This has to be the same arithmetic cancel-booking does — it computes
 * `Math.round(refundBase * percent) / 100`. The old expression here was
 * `Math.round(totalAmount * 0.5)`, which rounds to whole EUROS: on a EUR 441
 * booking the screen promised "50% refund (EUR 441.00 -> EUR 221.00)" and Stripe
 * returned EUR 220.50. Proven against real test-mode money by
 * scripts/e2e/cancellation-matrix.mjs (cell MOD-odd/24-48h/traveler).
 */
const refundFor = (totalAmount: number, percent: number) =>
  Math.round(totalAmount * percent) / 100

/**
 * Whether a refund figure may be put in front of the renter at all.
 *
 * A booking that was never paid gets nothing back — cancel-booking refunds 0 and
 * never calls Stripe. Rendering "If you cancel now: 100% refund (EUR 440.00)"
 * over money that was never taken is the same class of lie as under-refunding a
 * paid one, and `status === 'pending'` alone does not tell you which it is.
 */
export function shouldShowRefundEstimate(
  status: string,
  paymentStatus: string | null | undefined,
): boolean {
  if (!['confirmed', 'pending'].includes(status)) return false
  return paymentStatus === 'paid' || paymentStatus === 'captured'
}

export function calculateCancellationRefund(
  policy: CancellationPolicy,
  startDate: string,
  totalAmount: number,
  language: Lang = 'en',
  now = new Date(),
  cancelledBy: CancelledBy = 'traveler',
): CancellationResult {
  // An owner-initiated cancellation always refunds 100%: the renter did nothing
  // wrong, and neither the policy nor the clock enters into it. cancel-booking
  // applies exactly this override BEFORE consulting the policy. Without the same
  // branch here every owner-side cell disagreed with the server — a strict
  // listing cancelled by its owner 70h out quoted 0% against a real 100% refund.
  if (cancelledBy === 'owner') {
    return {
      refundAmount: refundFor(totalAmount, 100),
      refundPercent: 100,
      // TODO: swap for the dedicated `rcFullOwner` string once it lands in
      // constants/i18n.ts — see docs/i18n-pending-cancelflow.json.
      message: t('hostBGuestRefunded', language),
    }
  }

  const start = new Date(startDate)
  const hoursUntilStart = differenceInHours(start, now)

  switch (policy) {
    case 'flexible':
      if (hoursUntilStart >= 24) {
        return { refundAmount: refundFor(totalAmount, 100), refundPercent: 100, message: t('rcFull24', language) }
      }
      return { refundAmount: 0, refundPercent: 0, message: t('rcNone24', language) }

    case 'moderate':
      if (hoursUntilStart >= 48) {
        return { refundAmount: refundFor(totalAmount, 100), refundPercent: 100, message: t('rcFull48', language) }
      }
      if (hoursUntilStart >= 24) {
        return { refundAmount: refundFor(totalAmount, 50), refundPercent: 50, message: t('rcHalf2448', language) }
      }
      return { refundAmount: 0, refundPercent: 0, message: t('rcNone24', language) }

    case 'strict':
      if (hoursUntilStart >= 72) {
        return { refundAmount: refundFor(totalAmount, 100), refundPercent: 100, message: t('rcFull72', language) }
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

