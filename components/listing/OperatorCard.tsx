import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Radius, Spacing } from '@/constants/colors'
import { Avatar } from '@/components/ui/Avatar'
import { StarRating } from '@/components/ui/StarRating'
import { TierBadge } from '@/components/operator/TierBadge'
import { calculateTier } from '@/lib/operator-tier'
import type { Operator } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

interface OperatorCardProps {
  operator: Operator
  onViewListings?: () => void
}

export function OperatorCard({ operator, onViewListings }: OperatorCardProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Avatar imageUrl={operator.logo_url} name={operator.name} size={48} />
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{operator.name}</Text>
            {operator.verified && <Text style={styles.verified}> ✓</Text>}
            <TierBadge tier={calculateTier(operator)} size="md" />
          </View>
          <Text style={styles.city}>{operator.city}, {operator.country}</Text>
          <StarRating rating={operator.rating} reviewCount={operator.review_count} size={12} />
          <Text style={styles.responseTime}>⚡ Usually responds within 1 hour</Text>
        </View>
      </View>
      {operator.description && (
        <Text style={styles.desc} numberOfLines={3}>{operator.description}</Text>
      )}
      {onViewListings && (
        <TouchableOpacity onPress={onViewListings} style={styles.link}>
          <Text style={styles.linkText}>View all listings →</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  card: {
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: C.text },
  verified: { color: C.success, fontWeight: '700', fontSize: 16 },
  city: { fontSize: 13, color: C.textSecondary, marginBottom: 4 },
  desc: { fontSize: 13, color: C.textSecondary, lineHeight: 18, marginBottom: Spacing.sm },
  link: { alignSelf: 'flex-start' },
  linkText: { fontSize: 13, color: C.primary, fontWeight: '600' },
  responseTime: { fontSize: 12, color: C.success, marginTop: 2 },
  })
}
