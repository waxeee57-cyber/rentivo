import { useMemo } from 'react'
import { LOYALTY_TIERS, type TierKey, type Tier } from '@/lib/loyalty'

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'

interface LoyaltyState {
  points: number
  tier: LoyaltyTier
  tierInfo: Tier
  nextTier: LoyaltyTier | null
  nextTierInfo: Tier | null
  creditEUR: number
  pointsToNextTier: number
  progressPercent: number
  discountPercent: number
}

function getTierKey(points: number): TierKey {
  if (points >= 5000) return 'platinum'
  if (points >= 1500) return 'gold'
  if (points >= 500)  return 'silver'
  return 'bronze'
}

function getNextTierKey(points: number): TierKey | null {
  if (points >= 5000) return null
  if (points >= 1500) return 'platinum'
  if (points >= 500)  return 'gold'
  return 'silver'
}

export function useLoyalty(totalSpentCents: number): LoyaltyState {
  return useMemo(() => {
    // 1 point per €1 spent (totalSpentCents is in euro-cents)
    const points = Math.floor(totalSpentCents / 100)
    const creditEUR = Math.floor(points / 500) * 10

    const tierKey = getTierKey(points)
    const tierInfo: Tier = LOYALTY_TIERS[tierKey]

    const nextKey = getNextTierKey(points)
    const nextTierInfo: Tier | null = nextKey ? LOYALTY_TIERS[nextKey] : null

    const pointsToNextTier = nextTierInfo ? nextTierInfo.min - points : 0

    const progressPercent = nextTierInfo
      ? Math.min(
          100,
          Math.round(
            ((points - tierInfo.min) / (nextTierInfo.min - tierInfo.min)) * 100,
          ),
        )
      : 100

    const discountMap: Record<LoyaltyTier, number> = {
      bronze:   2.5,
      silver:   5,
      gold:     7.5,
      platinum: 10,
    }

    return {
      points,
      tier: tierKey,
      tierInfo,
      nextTier: nextKey,
      nextTierInfo,
      creditEUR,
      pointsToNextTier,
      progressPercent,
      discountPercent: discountMap[tierKey],
    }
  }, [totalSpentCents])
}
