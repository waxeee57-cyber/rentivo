import { Config } from '@/constants/config'

export const PLATFORM_FEE_RATE = 0.025 // 2.5%

/**
 * Returns the platform fee portion of a given amount.
 * Current rate: 2.5% (Config.platformCut = 0.025)
 * TODO: Stripe production — pass fee via application_fee_amount on PaymentIntent
 */
export function calculatePlatformFee(amountEur: number): number {
  return Math.round(amountEur * Config.platformCut * 100) / 100
}

/**
 * Converts a EUR decimal amount to Stripe's integer cent representation.
 * TODO: Stripe production — use this in every PaymentIntent amount field
 */
export function toStripeAmount(amountEur: number): number {
  return Math.round(amountEur * 100) // EUR cents
}

/**
 * Converts Stripe's integer cent representation back to EUR decimal.
 */
export function fromStripeAmount(amountCents: number): number {
  return amountCents / 100
}

export async function createPaymentIntent(params: {
  bookingId: string
  amountEur: number
  listingTitle: string
  operatorStripeAccountId?: string | null
  accessToken: string
}): Promise<{ clientSecret: string; payment_intent_id: string }> {
  if (Config.useMock) {
    return {
      clientSecret: 'pi_mock_secret_' + Date.now(),
      payment_intent_id: 'pi_mock_' + Date.now(),
    }
  }

  const res = await fetch(
    `${Config.supabaseUrl}/functions/v1/create-payment-intent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.accessToken}`,
        apikey: Config.supabaseAnonKey,
      },
      body: JSON.stringify({
        booking_id: params.bookingId,
        amount_eur: params.amountEur,
        listing_title: params.listingTitle,
        operator_stripe_account_id: params.operatorStripeAccountId ?? null,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error((err as { error?: string }).error ?? 'Failed to create payment intent')
  }

  // Edge Function returns snake_case: { client_secret, payment_intent_id }
  const raw = await res.json() as { client_secret: string; payment_intent_id: string }
  return { clientSecret: raw.client_secret, payment_intent_id: raw.payment_intent_id }
}

export async function createDepositHold(
  bookingId: string,
  amount: number,
  currency = 'EUR',
): Promise<{ holdId: string }> {
  if (Config.useMock) {
    return { holdId: 'hold_mock_' + Date.now() }
  }
  // TODO: Stripe PaymentIntent with capture_method: 'manual'
  // Creates an authorization hold, captured on damage or released after return
  void bookingId; void amount; void currency
  return { holdId: 'hold_placeholder' }
}

export async function releaseDepositHold(holdId: string): Promise<void> {
  if (Config.useMock) return
  // TODO: Stripe PaymentIntent cancel (releases hold)
  void holdId
}

export async function captureDepositHold(
  holdId: string,
  amount: number,
): Promise<void> {
  if (Config.useMock) return
  // TODO: Stripe PaymentIntent capture with amount
  void holdId; void amount
}
