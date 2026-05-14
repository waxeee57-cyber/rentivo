import { Config } from '@/constants/config'

export async function createPaymentIntent(
  listingId: string,
  amount: number,
  currency = 'EUR',
): Promise<{ clientSecret: string }> {
  if (Config.useMock) {
    return { clientSecret: 'pi_mock_secret_' + Date.now() }
  }

  const res = await fetch(`${Config.apiUrl}/payments/intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId, amount, currency }),
  })

  if (!res.ok) throw new Error('Failed to create payment intent')
  return res.json() as Promise<{ clientSecret: string }>
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
