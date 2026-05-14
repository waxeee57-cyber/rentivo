import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { StarRating } from '@/components/ui/StarRating'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { getCategoryEmoji } from '@/constants/categories'
import type { Listing } from '@/types'

const { width } = Dimensions.get('window')
const CARD_WIDTH = (width - Spacing.base * 3) / 2

interface ListingCardProps {
  listing: Listing
}

export function ListingCard({ listing }: ListingCardProps) {
  const [wishlisted, setWishlisted] = useState(false)

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(consumer)/listing/${listing.id}`)}
      activeOpacity={0.95}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: listing.cover_image_url ?? undefined }}
          style={styles.image}
          contentFit="cover"
          placeholder="https://via.placeholder.com/400x250/F5F3EF/A0A0A0?text=Vehicle"
        />
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryEmoji}>{getCategoryEmoji(listing.category)}</Text>
        </View>
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => setWishlisted(w => !w)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.heart, wishlisted && styles.heartActive]}>
            {wishlisted ? '❤️' : '🤍'}
          </Text>
        </TouchableOpacity>
        {listing.operator?.verified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>✓</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
        <Text style={styles.operator} numberOfLines={1}>
          {listing.operator?.name} · {listing.operator?.city}
        </Text>
        <View style={styles.row}>
          <StarRating rating={listing.rating} reviewCount={listing.review_count} size={12} />
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatEUR(listing.price_per_day)}</Text>
          <Text style={styles.priceUnit}>/day</Text>
        </View>
        {(listing.make || listing.model) && (
          <Text style={styles.makeModel} numberOfLines={1}>
            {[listing.make, listing.model, listing.year].filter(Boolean).join(' ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: Spacing.base,
  },
  imageContainer: { position: 'relative' },
  image: { width: '100%', aspectRatio: 16 / 10 },
  categoryBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: Colors.overlay,
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryEmoji: { fontSize: 12 },
  heartBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  heart: { fontSize: 18 },
  heartActive: {},
  verifiedBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: Colors.success,
    borderRadius: Radius.pill,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedText: { fontSize: 11, color: Colors.textInverse, fontWeight: '700' },
  info: { padding: Spacing.md },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  operator: { fontSize: 11, color: Colors.textTertiary, marginBottom: 4 },
  row: { marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 2 },
  price: { fontSize: 15, fontWeight: '700', color: Colors.text },
  priceUnit: { fontSize: 11, color: Colors.textSecondary, marginLeft: 2 },
  makeModel: { fontSize: 11, color: Colors.textTertiary },
})
