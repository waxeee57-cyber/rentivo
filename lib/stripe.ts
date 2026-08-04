import { captureException } from '@/lib/sentry'

export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''

// Sanity check — a missing or malformed publishable key makes every confirmPayment()
// call fail silently. Reported rather than console.warn'd: this module is on the
// payment path, and anything it prints lands in the release build's device log.
// The key itself is never included — only the fact that it failed the shape test.
// (At module-load time Sentry may not be initialised yet; captureException then
// degrades to its own __DEV__ warn, which preserves the old dev-time behaviour
// exactly. Never crash production over it.)
if (!STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) {
  captureException(
    new Error('Invalid or missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY — payments will fail'),
    { scope: 'stripe.config', expected: 'pk_test_* or pk_live_*', present: STRIPE_PUBLISHABLE_KEY.length > 0 },
  )
}
