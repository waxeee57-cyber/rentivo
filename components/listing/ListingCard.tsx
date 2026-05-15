import React, { useState, useRef, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Modal } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { impactAsync, notificationAsync, ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics'
import { Colors, Radius, Spacing, Shadow, Typography } from '@/constants/colors'
import { StarRating } from '@/components/ui/StarRating'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { getCategoryEmoji, getCategoryLabel } from '@/constants/categories'
import { getCancellationPolicyEmoji, getCancellationPolicyLabel } from '@/lib/utils/cancellation'
import { useWishlistStore } from '@/lib/store/useWishlistStore'
import type { Listing } from '@/types'

const { width } = Dimensions.get('window')
const GRID_CARD_WIDTH = (width - Spacing.base * 3) / 2

interface ListingCardProps {
  listing: Listing
  variant?: 'full' | 'grid'
  showAvailableBadge?: boolean
}

const CONTEXT_ACTIONS = [
  { key: 'wishlist', label: '❤️ Add to wishlist' },
  { key: 'share', label: '↗ Share' },
  { key: 'notify', label: '🔔 Notify on price drop' },
  { key: 'compare', label: '🏷️ Compare prices' },
  { key: 'hide', label: '✕ Hide this listing' },
]

function ListingCardComponent({ listing, variant = 'grid', showAvailableBadge }: ListingCardProps) {
  const { isWishlisted, toggle } = useWishlistStore()
  const wishlisted = isWishlisted(listing.id)
  const scale = useRef(new Animated.Value(1)).current
  const [showContext, setShowContext] = useState(false)
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  const onPressIn = useCallback(() => Animated.spring(scale, { toValue: 0.97, damping: 15, useNativeDriver: true }).start(), [scale])
  const onPressOut = useCallback(() => Animated.spring(scale, { toValue: 1, damping: 15, useNativeDriver: true }).start(), [scale])

  const handlePress = useCallback(() => {
    router.push(`/(consumer)/listing/${listing.id}`)
  }, [listing.id])

  const handleLongPress = useCallback(() => {
    void impactAsync(ImpactFeedbackStyle.Medium)
    setShowContext(true)
  }, [])

  const handleHeartPress = useCallback(() => {
    void impactAsync(ImpactFeedbackStyle.Medium)
    toggle(listing)
  }, [listing, toggle])

  const handleContextClose = useCallback(() => setShowContext(false), [])

  const handleContextAction = useCallback((key: string) => {
    setShowContext(false)
    switch (key) {
      case 'wishlist':
        toggle(listing)
        void impactAsync(ImpactFeedbackStyle.Medium)
        break
      case 'share':
        // Share would use expo-sharing
        break
      case 'notify':
        void notificationAsync(NotificationFeedbackType.Success)
        break
      case 'hide':
        setHidden(true)
        break
      default:
        break
    }
  }, [listing, toggle])

  const isFull = variant === 'full'

  // Urgency signals shown on detail page only

  return (
    <>
      <Animated.View style={[isFull ? styles.cardFull : styles.cardGrid, { transform: [{ scale }] }]}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={handleLongPress}
          delayLongPress={400}
          activeOpacity={1}
          accessibilityLabel={`${listing.title}, ${formatEUR(listing.price_per_day)} per day, ${listing.operator?.city ?? listing.host?.city ?? ''}`}
          accessibilityRole="button"
          accessibilityHint="Double tap to view details, long press for options"
        >
          {/* Image */}
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: listing.cover_image_url ?? undefined }}
              style={isFull ? styles.imageFull : styles.imageGrid}
              contentFit="cover"
              placeholder="https://via.placeholder.com/400x250/162038/4A5E78?text=Rentivo"
            />
            {/* Category badge */}
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
                {getCategoryEmoji(listing.category)} {getCategoryLabel(listing.category)}
              </Text>
            </View>
            {/* Available badge */}
            {showAvailableBadge && listing.available && (
              <View style={styles.availableBadge}>
                <Text style={styles.availableBadgeText}>⚡ Available now</Text>
              </View>
            )}
            {!showAvailableBadge && listing.instant_book && (
              <View style={styles.availableBadge}>
                <Text style={styles.availableBadgeText}>⚡ Available now</Text>
              </View>
            )}
            {/* Heart button — connected to wishlist store */}
            <TouchableOpacity
              style={styles.heartBtn}
              onPress={handleHeartPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              accessibilityRole="button"
            >
              <Text style={styles.heart}>{wishlisted ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
            <Text style={styles.operator} numberOfLines={1}>
              {listing.owner_type === 'host'
                ? `${listing.host?.name ?? 'Private host'} · ${listing.host?.city ?? ''}`
                : `${listing.operator?.name ?? ''} · ${listing.operator?.city ?? ''}`}
            </Text>
            <View style={styles.ratingRow}>
              <StarRating rating={listing.rating} reviewCount={listing.review_count} size={12} />
              {listing.booking_count != null && listing.booking_count > 0 && (
                <Text style={styles.rentalCount}> · {listing.booking_count} rentals</Text>
              )}
            </View>
            {listing.cancellation_policy != null && (
              <View style={styles.policyRow}>
                <View style={styles.policyDot} />
                <Text style={styles.policyText}>
                  {getCancellationPolicyEmoji(listing.cancellation_policy)} {getCancellationPolicyLabel(listing.cancellation_policy)}
                </Text>
              </View>
            )}
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatEUR(listing.price_per_day)}</Text>
              <Text style={styles.priceUnit}>/day</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Long press context menu */}
      <Modal
        visible={showContext}
        transparent
        animationType="fade"
        onRequestClose={handleContextClose}
      >
        <TouchableOpacity
          style={contextStyles.backdrop}
          activeOpacity={1}
          onPress={handleContextClose}
        />
        <View style={contextStyles.menu}>
          <View style={contextStyles.handle} />
          <Text style={contextStyles.menuTitle} numberOfLines={1}>{listing.title}</Text>
          {CONTEXT_ACTIONS.map((action, idx) => {
            const isWishlistAction = action.key === 'wishlist'
            const label = isWishlistAction
              ? (wishlisted ? '💔 Remove from wishlist' : '❤️ Add to wishlist')
              : action.label
            return (
              <TouchableOpacity
                key={action.key}
                style={[contextStyles.menuItem, idx === CONTEXT_ACTIONS.length - 1 && contextStyles.menuItemLast]}
                onPress={() => handleContextAction(action.key)}
              >
                <Text style={[
                  contextStyles.menuItemText,
                  action.key === 'hide' && contextStyles.menuItemTextDanger,
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            )
          })}
          <TouchableOpacity style={contextStyles.cancelBtn} onPress={handleContextClose}>
            <Text style={contextStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  )
}

export const ListingCard = React.memo(ListingCardComponent)
export default ListingCard

const styles = StyleSheet.create({
  cardFull: {
    width: '100%',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
    ...Shadow.sm, marginBottom: Spacing.md,
  },
  cardGrid: {
    width: GRID_CARD_WIDTH,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
    ...Shadow.sm, marginBottom: Spacing.base,
  },
  imageContainer: { position: 'relative' },
  imageFull: { width: '100%', height: 180 },
  imageGrid: { width: '100%', height: 180 },
  categoryBadge: {
    position: 'absolute', top: Spacing.sm, left: Spacing.sm,
    backgroundColor: 'rgba(10,22,40,0.72)',
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  categoryText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  availableBadge: {
    position: 'absolute', bottom: Spacing.sm, left: Spacing.sm,
    backgroundColor: Colors.success, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  availableBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  heartBtn: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.full,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  heart: { fontSize: 16 },
  info: { padding: Spacing.base, paddingBottom: Spacing.base },
  title: { ...Typography.h4, color: Colors.text, marginBottom: 4 },
  operator: { fontSize: 14, color: Colors.text, marginBottom: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  rentalCount: { fontSize: 14, color: Colors.textSecondary },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  policyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  policyText: { fontSize: 13, color: Colors.textSecondary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  price: { ...Typography.priceS, color: Colors.primary },
  priceUnit: { fontSize: 15, color: Colors.textSecondary },
})

const contextStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  menu: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 34,
    paddingTop: Spacing.md,
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: Radius.pill, alignSelf: 'center', marginBottom: Spacing.base,
  },
  menuTitle: {
    fontSize: 14, fontWeight: '700', color: Colors.textTertiary,
    textAlign: 'center', marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  menuItem: {
    paddingHorizontal: Spacing.xl, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemText: { fontSize: 16, color: Colors.text, fontWeight: '500' },
  menuItemTextDanger: { color: Colors.error },
  cancelBtn: {
    marginHorizontal: Spacing.xl, marginTop: Spacing.md,
    backgroundColor: Colors.surfaceWarm, borderRadius: Radius.pill,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '700', color: Colors.text },
})
