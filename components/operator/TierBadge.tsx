import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { getTierBadge } from '@/lib/operator-tier'
import type { OperatorTier } from '@/lib/operator-tier'

interface TierBadgeProps {
  tier: OperatorTier
  size?: 'sm' | 'md'
}

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const def = getTierBadge(tier)
  const isSmall = size === 'sm'
  return (
    <View style={[styles.badge, { borderColor: def.color }, isSmall ? styles.sm : styles.md]}>
      <Text style={isSmall ? styles.iconSm : styles.iconMd}>{def.icon}</Text>
      <Text style={[styles.label, { color: def.color }, isSmall ? styles.labelSm : styles.labelMd]}>
        {def.label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    gap: 3,
  },
  sm: { paddingHorizontal: 6, paddingVertical: 2 },
  md: { paddingHorizontal: 10, paddingVertical: 5 },
  iconSm: { fontSize: 10 },
  iconMd: { fontSize: 14 },
  label: { fontWeight: '700' },
  labelSm: { fontSize: 10 },
  labelMd: { fontSize: 13 },
})
