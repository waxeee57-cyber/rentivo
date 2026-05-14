import React, { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Colors, Radius, Spacing, Shadow, Typography } from '@/constants/colors'
import { StarRating } from '@/components/ui/StarRating'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { getCategoryEmoji, getCategoryLabel } from '@/constants/categories'
import { getCancellationPolicyEmoji, getCancellationPolicyLabel } from '@/lib/utils/cancellation'
import type { Listing } from '@/types'

const { width } = Dimensions.get('window')
const GRID_CARD_WIDTH = (width - Spacing.base * 3) / 2

interface ListingCardProps {
  listing: Listing
  variant?: 'full' | 'grid'
  showAvailableBadge?: boolean
}

export function ListingCard({ listing, variant = 'grid', showAvailableBadge }: ListingCardProps) {
  const [wishlisted, setWishlisted] = useState(false)
  const scale = useRef(new Animated.Value(1)).current

  const onPressIn = () => Animated.spring(scale, { toValue: 0.97, damping: 15, useNativeDriver: true }).start()
  const onPressOut = () => Animated.spring(scale, { toValue: 1, damping: 15, useNativeDriver: true }).start()

  const isFull = variant === 'full'

  return (
    <Animated.View style={[isFull ? styles.cardFull : styles.cardGrid, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={() => router.push(`/(consumer)/listing/${listing.id}`)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: listing.cover_image_url ?? undefined }}
            style={isFull ? styles.imageFull : styles.imageGrid}
            contentFit="cover"
            placeholder="https://via.placeholder.com/400x250/162038/4A5E78?text=Rentivo"
          />
          {/* Category badge — top left */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {getCategoryEmoji(listing.category)} {getCategoryLabel(listing.category)}
            </Text>
          </View>
          {/* Available / Instant badges */}
          {showAvailableBadge && listing.available && (
            <View style={styles.availableBadge}>
              <Text style={styles.availableBadgeText}>⚡ Available now</Text>
            </View>
          )}
          {!showAvailableBadge && listing.instant_book && (
            <View style={styles.availableBadge}>
              <Text style={styles.availableBadgeText}>⚡ Instant book</Text>
            </View>
          )}
          {/* Heart — top right */}
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              setWishlisted(w => !w)
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.heart}>{wishlisted ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>

        {/* Info section */}
        <View style={styles.info}>
          {/* Title */}
          <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>

          {/* Operator / Host */}
          <Text style={styles.operator} numberOfLines={1}>
            {listing.owner_type === 'host'
              ? `${listing.host?.name ?? 'Private host'} · ${listing.host?.city ?? ''}`
              : `${listing.operator?.name ?? ''} · ${listing.operator?.city ?? ''}`}
          </Text>

          {/* Rating + rental count */}
          <View style={styles.ratingRow}>
            <StarRating rating={listing.rating} reviewCount={listing.review_count} size={12} />
            {listing.booking_count != null && listing.booking_count > 0 && (
              <Text style={styles.rentalCount}> · {listing.booking_count} rentals</Text>
            )}
          </View>

          {/* Cancellation policy */}
          {listing.cancellation_policy != null && (
            <View style={styles.policyRow}>
              <View style={styles.policyDot} />
              <Text style={styles.policyText}>
                {getCancellationPolicyEmoji(listing.cancellation_policy)} {getCancellationPolicyLabel(listing.cancellation_policy)}
              </Text>
            </View>
          )}

          {/* Price row */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatEUR(listing.price_per_day)}</Text>
            <Text style={styles.priceUnit}>/day</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  cardFull: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
    marginBottom: Spacing.md,
  },
  cardGrid: {
    width: GRID_CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
    marginBottom: Spacing.base,
  },

  imageContainer: { position: 'relative' },
  imageFull:  { width: '100%', height: 180 },
  imageGrid:  { width: '100%', height: 180 },

  categoryBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(10,22,40,0.72)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 11, fontWeight: '700', color: Colors.white },

  availableBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: Colors.success,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  availableBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.white },

  heartBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Radius.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  heart: { fontSize: 16 },

  info: { padding: Spacing.base, paddingBottom: Spacing.base },

  title: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: 4,
  },

  operator: {
    ...Typography.bodyS,
    color: Colors.textSecondary,
    marginBottom: 6,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rentalCount: {
    fontSize: 12,
    color: Colors.textTertiary,
  },

  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  policyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  policyText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  price: {
    ...Typography.priceS,
    color: Colors.primary,
  },
  priceUnit: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
})
