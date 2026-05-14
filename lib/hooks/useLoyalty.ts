import { useMemo } from 'react'

export type LoyaltyTier = 'bronze' | 'silver' | 'gold'

interface LoyaltyState {
  points: number
  tier: LoyaltyTier
  creditEUR: number
  nextTier: LoyaltyTier | null
  pointsToNextTier: number
  discountPercent: number
}

const TIER_THRESHOLDS = { bronze: 0, silver: 1000, gold: 5000 }
const TIER_DISCOUNTS = { bronze: 0, silver: 5, gold: 10 }

export function useLoyalty(totalSpentCents: number): LoyaltyState {
  return useMemo(() => {
    // 1 point per €1 spent
    const points = Math.floor(totalSpentCents / 100)
    const creditEUR = Math.floor(points / 500) * 10
    const tier: LoyaltyTier =
      points >= TIER_THRESHOLDS.gold ? 'gold' :
      points >= TIER_THRESHOLDS.silver ? 'silver' : 'bronze'

    const nextTier: LoyaltyTier | null =
      tier === 'bronze' ? 'silver' : tier === 'silver' ? 'gold' : null

    const pointsToNextTier = nextTier
      ? TIER_THRESHOLDS[nextTier] - points
      : 0

    return {
      points,
      tier,
      creditEUR,
      nextTier,
      pointsToNextTier,
      discountPercent: TIER_DISCOUNTS[tier],
    }
  }, [totalSpentCents])
}
