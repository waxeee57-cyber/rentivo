import React from 'react'
import { Fonts } from '@/constants/colors'
import { View, Text, StyleSheet } from 'react-native'
import { getTierBadge } from '@/lib/operator-tier'
import type { OperatorTier } from '@/lib/operator-tier'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { Operator } from '@/types'

interface TierBadgeProps {
  tier: OperatorTier
  size?: 'sm' | 'md'
  // Who is reading this badge. The supplier ladder (new→verified→top→elite) is
  // motivating for the supplier who is climbing it, but a renter reads "ELITE"
  // as a PRICE tier rather than a reliability signal — so renters get the proof
  // behind the rank instead of the rank itself. Default stays 'supplier' so the
  // operator dashboard is unchanged.
  audience?: 'supplier' | 'renter'
  // Source of that proof (rentals, rating, verified flag). Only read when
  // audience is 'renter'; the supplier badge needs nothing but the tier.
  operator?: Partial<Operator>
}

export function TierBadge({ tier, size = 'sm', audience = 'supplier', operator }: TierBadgeProps) {
  const C = useColors()
  const language = useAuthStore(s => s.language)
  // Pass the live palette so the 'top' tier gold resolves per theme — this label
  // renders on every listing card, and the dark gold is 2.13:1 on a white card.
  const def = getTierBadge(tier, C)
  const isSmall = size === 'sm'

  if (audience === 'renter') {
    // Below 'verified' we render NOTHING rather than a weak badge: a "NEW" label
    // on a browse card is a negative signal that suppresses conversion for
    // legitimate new suppliers, and an absent badge is the honest alternative.
    if (tier === 'new') return null
    const rentals = operator?.total_bookings ?? 0
    const rating = operator?.avg_rating ?? operator?.rating ?? 0
    // Prefer concrete, checkable evidence; fall back to the verified marker only
    // when the counts are missing from the record.
    const proof = rentals > 0 && rating > 0
      ? t('operatorProofRentalsRating', language, { count: rentals, rating: rating.toFixed(1) })
      : rentals > 0
        ? t('operatorProofRentals', language, { count: rentals })
        : t('operatorProofVerified', language)
    return (
      <View style={[styles.badge, isSmall ? styles.sm : styles.md]}>
        {/* Neutral ink, no tier colour and no caps: this is information the
            renter can verify, not decoration that ranks the supplier. */}
        <Text style={[styles.proof, { color: C.textSecondary }, isSmall ? styles.proofSm : styles.proofMd]}>
          {proof}
        </Text>
      </View>
    )
  }
  // Ink-first: no box, no emoji — a small colored caps label carries the tier
  return (
    <View style={[styles.badge, isSmall ? styles.sm : styles.md]}>
      <Text style={[styles.label, { color: def.color }, isSmall ? styles.labelSm : styles.labelMd]}>
        {def.label.toUpperCase()}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sm: {},
  md: {},
  label: { fontFamily: Fonts.bold, letterSpacing: 0.6 },
  labelSm: { fontFamily: Fonts.regular, fontSize: 9 },
  labelMd: { fontFamily: Fonts.regular, fontSize: 11 },
  // Renter proof reads as body copy, not as a rank: default tracking, no caps.
  proof: { fontFamily: Fonts.regular },
  proofSm: { fontFamily: Fonts.regular, fontSize: 11, lineHeight: 15 },
  proofMd: { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 16 },
})
