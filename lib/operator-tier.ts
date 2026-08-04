import type { Operator } from '@/types'
import { DarkColors } from '@/constants/colors'

export type OperatorTier = 'new' | 'verified' | 'top' | 'elite'

export interface TierDefinition {
  tier: OperatorTier
  label: string
  color: string
  minBookings: number
  minRating: number
  minResponseRate: number
}

export const OPERATOR_TIERS: TierDefinition[] = [
  {
    tier: 'elite',
    label: 'Elite',
    color: '#4A9EE8',
    minBookings: 100,
    minRating: 4.8,
    minResponseRate: 95,
  },
  {
    tier: 'top',
    label: 'Top',
    // Palette token, not a loose hex — this used to be a fourth brand orange
    // defined outside both palettes. Dark value by default; getTierBadge()
    // swaps in the light-mode gold when a caller passes its palette.
    color: DarkColors.gold,
    minBookings: 25,
    minRating: 4.5,
    minResponseRate: 90,
  },
  {
    tier: 'verified',
    label: 'Verified',
    color: '#2D9B6F',
    minBookings: 5,
    minRating: 4.0,
    minResponseRate: 80,
  },
  {
    tier: 'new',
    label: 'New',
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

export function getTierBadge(tier: OperatorTier, C?: { gold: string }): TierDefinition {
  const def = OPERATOR_TIERS.find(t => t.tier === tier) ?? OPERATOR_TIERS[OPERATOR_TIERS.length - 1]
  // The 'top' accent is the shared tier gold, which has to darken in light mode
  // to stay legible (the dark value is only 2.13:1 on white). Callers that can
  // see the theme pass their palette in; the param is optional so existing
  // callers — and non-React code — keep the dark-palette default.
  return C && def.tier === 'top' ? { ...def, color: C.gold } : def
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
