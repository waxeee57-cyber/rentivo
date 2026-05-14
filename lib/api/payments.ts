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
