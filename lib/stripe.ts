export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''

// Dev-only sanity check — a missing or malformed publishable key makes every
// confirmPayment() call fail silently. Warn loudly in dev; never crash production.
if (__DEV__ && !STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) {
  console.warn(
    '[Stripe] Invalid or missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY — payments will fail. ' +
    'Expected a key starting with "pk_test_" or "pk_live_".'
  )
}
