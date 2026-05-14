import React from 'react'
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { StarRating } from '@/components/ui/StarRating'
import { formatEUR } from '@/lib/utils/formatCurrency'
import type { Listing } from '@/types'

interface FleetCardProps {
  listing: Listing
  onEdit: () => void
  onToggleAvailable: (available: boolean) => void
}

export function FleetCard({ listing, onEdit, onToggleAvailable }: FleetCardProps) {
  const handleToggle = (v: boolean) => {
    void Haptics.impactAsync(v ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    onToggleAvailable(v)
  }

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: listing.cover_image_url ?? undefined }}
        style={styles.image}
        contentFit="cover"
        placeholder="https://via.placeholder.com/120x80/F5F3EF"
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {[listing.make, listing.model, listing.year].filter(Boolean).join(' ')}
        </Text>
        <View style={styles.row}>
          <Text style={styles.price}>{formatEUR(listing.price_per_day)}/day</Text>
          <StarRating rating={listing.rating} reviewCount={listing.booking_count} size={13} showCount={false} />
        </View>
        <View style={styles.bottomRow}>
          <Switch
            value={listing.available}
            onValueChange={handleToggle}
            trackColor={{ true: Colors.success, false: Colors.border }}
            thumbColor={Colors.surface}
            accessibilityLabel={`Vehicle: ${listing.available ? 'available' : 'unavailable'}`}
            accessibilityRole="switch"
            accessibilityState={{ checked: listing.available }}
          />
          <Text style={[styles.availText, { color: listing.available ? Colors.success : Colors.textTertiary }]}>
            {listing.available ? 'Available' : 'Unavailable'}
          </Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={onEdit}
            accessibilityLabel={`Edit ${listing.title}`}
            accessibilityRole="button"
          >
            <Text style={styles.editText}>Edit →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  image: { width: 120, height: 100 },
  info: { flex: 1, padding: Spacing.md },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  price: { fontSize: 15, fontWeight: '700', color: Colors.text },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  availText: { fontSize: 14, marginLeft: Spacing.xs, flex: 1 },
  editBtn: {
    minWidth: 80, height: 44,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
  },
  editText: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
})
