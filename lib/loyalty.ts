export const LOYALTY_TIERS = {
  bronze:   { min: 0,    max: 499,      label: 'Bronze',   color: '#CD7F32', perks: ['2.5% fee discount'] },
  silver:   { min: 500,  max: 1499,     label: 'Silver',   color: '#C0C0C0', perks: ['5% fee discount', 'Priority support'] },
  gold:     { min: 1500, max: 4999,     label: 'Gold',     color: '#E8A44A', perks: ['7.5% fee discount', 'Free cancellation'] },
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

export function getNextTier(points: number): Tier | null {
  if (points >= 5000) return null
  if (points >= 1500) return LOYALTY_TIERS.platinum
  if (points >= 500)  return LOYALTY_TIERS.gold
  return LOYALTY_TIERS.silver
}
