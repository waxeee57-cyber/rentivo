import React, { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Colors, Radius, Spacing } from '@/constants/colors'
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
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: listing.cover_image_url ?? undefined }}
            style={isFull ? styles.imageFull : styles.imageGrid}
            contentFit="cover"
            placeholder="https://via.placeholder.com/400x250/F5F3EF/A0A0A0?text=Vehicle"
          />
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {getCategoryEmoji(listing.category)} {getCategoryLabel(listing.category)}
            </Text>
          </View>
          {showAvailableBadge && listing.available && (
            <View style={styles.availableBadge}>
              <Text style={styles.availableBadgeText}>Available now</Text>
            </View>
          )}
          {listing.instant_book && (
            <View style={styles.instantBadge}>
              <Text style={styles.instantBadgeText}>⚡ Instant</Text>
            </View>
          )}
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

        <View style={styles.info}>
          {isFull ? (
            <View style={styles.fullRow}>
              <Text style={styles.titleFull} numberOfLines={1}>{listing.title}</Text>
              <StarRating rating={listing.rating} reviewCount={listing.review_count} size={12} />
            </View>
          ) : (
            <Text style={styles.titleGrid} numberOfLines={1}>{listing.title}</Text>
          )}

          <View style={styles.operatorRow}>
            <Text style={styles.operator} numberOfLines={1}>
              {listing.owner_type === 'host'
                ? `${listing.host?.name ?? 'Private host'} · ${listing.host?.city ?? ''}`
                : `${listing.operator?.name ?? ''} · ${listing.operator?.city ?? ''}`}
            </Text>
            {listing.owner_type === 'host' && (
              <View style={styles.hostBadge}>
                <Text style={styles.hostBadgeText}>👤</Text>
              </View>
            )}
          </View>

          {listing.booking_count != null && listing.booking_count > 0 && (
            <Text style={styles.bookingCount}>{listing.booking_count} rentals</Text>
          )}
          {listing.cancellation_policy != null && (
            <View style={styles.cancelBadge}>
              <Text style={styles.cancelBadgeText}>
                {getCancellationPolicyEmoji(listing.cancellation_policy)} {getCancellationPolicyLabel(listing.cancellation_policy)}
              </Text>
            </View>
          )}

          {isFull && (listing.make || listing.model) && (
            <View style={styles.detailChips}>
              {listing.year ? <View style={styles.chip}><Text style={styles.chipText}>{listing.year}</Text></View> : null}
              {listing.color ? <View style={styles.chip}><Text style={styles.chipText}>{listing.color}</Text></View> : null}
              {listing.capacity ? <View style={styles.chip}><Text style={styles.chipText}>{listing.capacity} seats</Text></View> : null}
            </View>
          )}

          <View style={styles.priceRow}>
            {!isFull && <StarRating rating={listing.rating} reviewCount={listing.review_count} size={11} />}
            <Text style={isFull ? styles.priceFull : styles.priceGrid}>{formatEUR(listing.price_per_day)}</Text>
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: Spacing.md,
  },
  cardGrid: {
    width: GRID_CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: Spacing.base,
  },
  imageContainer: { position: 'relative' },
  imageFull: { width: '100%', height: 200 },
  imageGrid: { width: '100%', height: 160 },
  categoryBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  heartBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  heart: { fontSize: 16 },
  info: { padding: 14 },
  fullRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  titleFull: { fontSize: 16, fontWeight: '700', color: Colors.text, flex: 1, marginRight: Spacing.sm },
  titleGrid: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  operatorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  operator: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  hostBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  hostBadgeText: { fontSize: 10 },
  detailChips: { flexDirection: 'row', gap: Spacing.xs, marginBottom: 8, flexWrap: 'wrap' },
  chip: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { fontSize: 11, color: Colors.textSecondary },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  priceFull: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  priceGrid: { fontSize: 15, fontWeight: '700', color: Colors.text },
  priceUnit: { fontSize: 12, color: Colors.textSecondary, marginLeft: 2 },
  bookingCount: { fontSize: 11, color: Colors.textTertiary, marginBottom: 4 },
  cancelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  cancelBadgeText: { fontSize: 10, color: Colors.textSecondary },
  availableBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: Colors.success,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  availableBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  instantBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  instantBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
})
