import { DarkColors } from '@/constants/colors'

// The Gold accent comes from the palette rather than a loose hex, so the brand
// gold has exactly one definition (it used to be a fourth brand orange living
// outside both palettes). Screens rendering this on a light surface should use
// getColors(isDark).gold — the dark value is only 2.13:1 on white.
export const LOYALTY_TIERS = {
  bronze:   { min: 0,    max: 499,      label: 'Bronze',   color: '#CD7F32', perks: ['2.5% fee discount'] },
  silver:   { min: 500,  max: 1499,     label: 'Silver',   color: '#C0C0C0', perks: ['5% fee discount', 'Priority support'] },
  gold:     { min: 1500, max: 4999,     label: 'Gold',     color: DarkColors.gold, perks: ['7.5% fee discount', 'Free cancellation'] },
  platinum: { min: 5000, max: Infinity, label: 'Platinum', color: '#E5E4E2', perks: ['10% discount', 'No deposit', 'Dedicated support'] },
} as const

export type TierKey = keyof typeof LOYALTY_TIERS
export type Tier = (typeof LOYALTY_TIERS)[TierKey]

export function getTier(points: number): Tier {
  if (points >= 5000) return LOYALTY_TIERS.platinum
  if (points >= 1500) return LOYALTY_TIERS.gold
  if (points >= 500)  return LOYALTY_TIERS.silver
  return LOYALTY_TIERS.bronze
}

// Theme-aware accessor for a tier's accent. The `gold` tier stores the DARK
// palette value, so a render site reading `tier.color` directly is washed-out
// amber in light mode. Callers that can see the theme pass their palette in;
// the param is optional so non-React callers keep the dark-palette default.
export function getTierColor(tier: Tier, C?: { gold: string }): string {
  return C && tier.label === 'Gold' ? C.gold : tier.color
}

export function getNextTier(points: number): Tier | null {
  if (points >= 5000) return null
  if (points >= 1500) return LOYALTY_TIERS.platinum
  if (points >= 500)  return LOYALTY_TIERS.gold
  return LOYALTY_TIERS.silver
}
