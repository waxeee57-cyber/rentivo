import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { Avatar } from '@/components/ui/Avatar'
import { StarRating } from '@/components/ui/StarRating'
import { TierBadge } from '@/components/operator/TierBadge'
import { calculateTier } from '@/lib/operator-tier'
import type { Operator } from '@/types'

interface OperatorCardProps {
  operator: Operator
  onViewListings?: () => void
}

export function OperatorCard({ operator, onViewListings }: OperatorCardProps) {
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text },
  verified: { color: Colors.success, fontWeight: '700', fontSize: 16 },
  city: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  desc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: Spacing.sm },
  link: { alignSelf: 'flex-start' },
  linkText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  responseTime: { fontSize: 12, color: Colors.success, marginTop: 2 },
})
