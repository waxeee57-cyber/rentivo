/**
 * CONSOLIDATED into `Button` (2026-08).
 *
 * This file used to be a near-duplicate of `Button` whose only real
 * difference was the Reanimated press spring + haptic. `Button` was imported
 * by 29 screens and `AnimatedButton` by exactly 1 — so the good behaviour was
 * moved INTO `Button` rather than asking 29 call sites to migrate.
 *
 * The file is kept (not deleted) purely so the remaining importer
 * — app/(consumer)/booking/[listingId].tsx — keeps resolving. Prefer
 * `Button` in new code; this alias should disappear once that import is
 * updated.
 *
 * Behaviour note: the legacy `haptic?: boolean` opt-out is gone. Nothing set
 * it to false, and haptics are now a platform-wide, uniform affordance.
 */
export { Button as AnimatedButton } from './Button'
