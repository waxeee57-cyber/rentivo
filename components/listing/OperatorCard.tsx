import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Radius, Spacing, Fonts } from '@/constants/colors'
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
            {/* Renter-facing detail screen: show the proof behind the tier, not
                the supplier rank — "ELITE" here reads as a price bracket. */}
            <TierBadge tier={calculateTier(operator)} size="md" audience="renter" operator={operator} />
          </View>
          <Text style={styles.city}>{operator.city}, {operator.country}</Text>
          <StarRating rating={operator.rating} reviewCount={operator.review_count} size={12} />
          <View style={styles.responseTimeRow}>
            <Ionicons name="flash-outline" size={12} color={C.success} importantForAccessibility="no" />
            <Text style={styles.responseTime}>Usually responds within 1 hour</Text>
          </View>
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
  name: { fontSize: 16, fontFamily: Fonts.bold, color: C.text },
  verified: { color: C.success, fontFamily: Fonts.bold, fontSize: 16 },
  city: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, marginBottom: 4 },
  desc: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, lineHeight: 18, marginBottom: Spacing.sm },
  link: { alignSelf: 'flex-start' },
  linkText: { fontSize: 13, color: C.primary, fontFamily: Fonts.semibold },
  responseTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  responseTime: { fontFamily: Fonts.regular, fontSize: 12, color: C.success },
  })
}
