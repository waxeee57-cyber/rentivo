import type { Operator } from '@/types'

export type OperatorTier = 'new' | 'verified' | 'top' | 'elite'

export interface TierDefinition {
  tier: OperatorTier
  label: string
  icon: string
  color: string
  minBookings: number
  minRating: number
  minResponseRate: number
}

export const OPERATOR_TIERS: TierDefinition[] = [
  {
    tier: 'elite',
    label: 'Elite',
    icon: '💎',
    color: '#4A9EE8',
    minBookings: 100,
    minRating: 4.8,
    minResponseRate: 95,
  },
  {
    tier: 'top',
    label: 'Top',
    icon: '⭐',
    color: '#E8A44A',
    minBookings: 25,
    minRating: 4.5,
    minResponseRate: 90,
  },
  {
    tier: 'verified',
    label: 'Verified',
    icon: '✅',
    color: '#2D9B6F',
    minBookings: 5,
    minRating: 4.0,
    minResponseRate: 80,
  },
  {
    tier: 'new',
    label: 'New',
    icon: '🆕',
    color: '#9DAFC5',
    minBookings: 0,
    minRating: 0,
    minResponseRate: 0,
  },
]

export function calculateTier(operator: Partial<Operator>): OperatorTier {
  const bookings = operator.total_bookings ?? 0
  const rating = operator.avg_rating ?? operator.rating ?? 0
  const responseRate = operator.response_rate ?? 100

  for (const tierDef of OPERATOR_TIERS) {
    if (
      bookings >= tierDef.minBookings &&
      rating >= tierDef.minRating &&
      responseRate >= tierDef.minResponseRate
    ) {
      return tierDef.tier
    }
  }
  return 'new'
}

export function getTierBadge(tier: OperatorTier): TierDefinition {
  return OPERATOR_TIERS.find(t => t.tier === tier) ?? OPERATOR_TIERS[OPERATOR_TIERS.length - 1]
}

export function getTierProgress(operator: Partial<Operator>): {
  current: TierDefinition
  next: TierDefinition | null
  bookingsProgress: number
  ratingProgress: number
} {
  const currentTier = calculateTier(operator)
  const currentDef = getTierBadge(currentTier)
  const currentIndex = OPERATOR_TIERS.findIndex(t => t.tier === currentTier)
  const nextDef = currentIndex > 0 ? OPERATOR_TIERS[currentIndex - 1] : null

  const bookingsProgress = nextDef
    ? Math.min(1, (operator.total_bookings ?? 0) / nextDef.minBookings)
    : 1
  const ratingProgress = nextDef
    ? Math.min(1, ((operator.avg_rating ?? operator.rating ?? 0) - currentDef.minRating) / Math.max(0.1, nextDef.minRating - currentDef.minRating))
    : 1

  return { current: currentDef, next: nextDef, bookingsProgress, ratingProgress }
}
