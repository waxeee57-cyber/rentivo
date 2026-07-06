import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Modal } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  withRepeat, withSequence, withTiming, cancelAnimation,
} from 'react-native-reanimated'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { impactAsync, notificationAsync, ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics'
import { Radius, Spacing, Shadow, Typography } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { useThemeStore } from '@/lib/store/useThemeStore'
import { StarRating } from '@/components/ui/StarRating'
import { formatPricePerDay } from '@/lib/utils/formatCurrency'
import { getCategoryEmoji, getCategoryLabel, getCategoryIcon } from '@/constants/categories'
import { getCancellationPolicyEmoji, getCancellationPolicyLabel } from '@/lib/utils/cancellation'
import { useWishlistStore } from '@/lib/store/useWishlistStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { TierBadge } from '@/components/operator/TierBadge'
import { calculateTier } from '@/lib/operator-tier'
import type { Listing, RentalCategory } from '@/types'

const { width } = Dimensions.get('window')
const GRID_CARD_WIDTH = (width - Spacing.base * 3) / 2

interface ListingCardProps {
  listing: Listing
  variant?: 'full' | 'grid'
  showAvailableBadge?: boolean
}

// Gradient palettes per category — shown when no image is available
const CATEGORY_GRADIENTS: Record<RentalCategory | 'default', readonly [string, string]> = {
  car:        ['#1A2B45', '#0A1628'],
  motorcycle: ['#2B1A45', '#0A1628'],
  yacht:      ['#1A2B45', '#0A2845'],
  villa:      ['#1A3445', '#0A1628'],
  bike:       ['#1A3430', '#0A1628'],
  scooter:    ['#2B1A45', '#0A1628'],
  kayak:      ['#1A2B45', '#0A2845'],
  surfboard:  ['#1A3445', '#0A2840'],
  equipment:  ['#1A2B45', '#0A1628'],
  other:      ['#1A2B45', '#0A1628'],
  default:    ['#1A2B45', '#0A1628'],
}

const lightGradients: Record<RentalCategory | 'default', readonly [string, string]> = {
  car:        ['#E8E8E8', '#F5F5F5'],
  motorcycle: ['#EDE8F5', '#F5F0FF'],
  yacht:      ['#E8F0F5', '#EEF5FF'],
  villa:      ['#E8F5F0', '#F0FFF8'],
  bike:       ['#F0F5E8', '#F5FFEE'],
  scooter:    ['#EDE8F5', '#F5F0FF'],
  kayak:      ['#E8F0F5', '#EEF5FF'],
  surfboard:  ['#E8F5F0', '#EEF8FF'],
  equipment:  ['#E8E8E8', '#F5F5F5'],
  other:      ['#E8E8E8', '#F5F5F5'],
  default:    ['#E8E8E8', '#F5F5F5'],
}

function getGradient(category: string, isDark: boolean): [string, string] {
  const palette = isDark ? CATEGORY_GRADIENTS : lightGradients
  const g = palette[category as RentalCategory] ?? palette.default
  return [g[0], g[1]]
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
  const language = useAuthStore((s) => s.language)
  const isDark = useThemeStore(s => s.isDark)
  const C = useColors()
  const { styles, contextStyles } = useMemo(() => makeStyles(C), [C])
  const wishlisted = isWishlisted(listing.id)
  const scale = useSharedValue(1)
  const heartScale = useSharedValue(1)
  const [showContext, setShowContext] = useState(false)
  const [hidden, setHidden] = useState(false)

  const isFull = variant === 'full'
  // Image priority: images[0] → cover_image_url → null (gradient placeholder)
  const imageUri = listing.images?.[0] ?? listing.cover_image_url ?? null
  const gradient = getGradient(listing.category, isDark)
  const priceLabel = formatPricePerDay(listing.price_per_day, language)

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }))

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 })
  }, [scale])

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
  }, [scale])

  const handlePress = useCallback(() => {
    router.push(`/(consumer)/listing/${listing.id}`)
  }, [listing.id])

  const handleLongPress = useCallback(() => {
    void impactAsync(ImpactFeedbackStyle.Medium)
    setShowContext(true)
  }, [])

  const handleHeartPress = useCallback(() => {
    void impactAsync(ImpactFeedbackStyle.Medium)
    heartScale.value = withSpring(1.35, { damping: 8, stiffness: 300 })
    setTimeout(() => {
      heartScale.value = withSpring(1, { damping: 10, stiffness: 200 })
    }, 150)
    toggle(listing)
  }, [listing, toggle, heartScale])

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

  if (hidden) return null

  return (
    <>
      <Animated.View style={[
        isFull ? styles.cardFull : styles.cardGrid,
        { backgroundColor: C.surface, borderColor: C.border },
        animatedCardStyle,
      ]}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={handleLongPress}
          delayLongPress={400}
          activeOpacity={1}
          accessibilityLabel={`${listing.title}, ${priceLabel}, ${listing.pickup_address ?? listing.operator?.city ?? listing.host?.city ?? ''}`}
          accessibilityRole="button"
          accessibilityHint="Double tap to view details, long press for options"
        >
          {/* Image / Gradient placeholder */}
          <View style={styles.imageContainer}>
            {imageUri !== null ? (
              <Image
                source={{ uri: imageUri }}
                style={isFull ? styles.imageFull : styles.imageGrid}
                contentFit="cover"
                transition={300}
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              />
            ) : (
              <LinearGradient
                colors={gradient}
                style={[isFull ? styles.imageFull : styles.imageGrid, styles.imagePlaceholder]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.imagePlaceholderIcon}>{getCategoryEmoji(listing.category)}</Text>
                <Text style={styles.imagePlaceholderTitle} numberOfLines={2}>{listing.title}</Text>
              </LinearGradient>
            )}
            {/* Category badge */}
            <View style={[
              styles.categoryBadge,
              { backgroundColor: isDark ? 'rgba(10,22,40,0.80)' : 'rgba(0,0,0,0.55)', flexDirection: 'row', alignItems: 'center' },
            ]}>
              <Ionicons name={getCategoryIcon(listing.category)} size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.categoryText}>
                {getCategoryLabel(listing.category)}
              </Text>
            </View>
            {/* Available / Instant book badge */}
            {showAvailableBadge === true && listing.available && (
              <View style={styles.availableBadge}>
                <Text style={styles.availableBadgeText}>⚡ Available now</Text>
              </View>
            )}
            {showAvailableBadge !== true && listing.instant_book === true && (
              <View style={styles.availableBadge}>
                <Text style={styles.availableBadgeText}>⚡ Instant book</Text>
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
              <Animated.View style={heartAnimStyle}>
                <Text style={styles.heart}>{wishlisted ? '❤️' : '🤍'}</Text>
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.info}>
            {/* Title: max 2 lines with ellipsis */}
            <Text style={[styles.title, { color: C.text }]} numberOfLines={2} ellipsizeMode="tail">{listing.title}</Text>
            {/* Operator tier badge */}
            {listing.operator != null && (
              <View style={styles.tierRow}>
                <TierBadge tier={calculateTier(listing.operator)} size="sm" />
              </View>
            )}
            {/* Location: pickup_address preferred, city as fallback */}
            {(listing.pickup_address ?? listing.operator?.city ?? listing.host?.city) != null && (
              <Text style={[styles.location, { color: C.textTertiary }]} numberOfLines={1}>
                📍 {listing.pickup_address ?? listing.operator?.city ?? listing.host?.city}
              </Text>
            )}
            <View style={styles.ratingRow}>
              <StarRating rating={listing.rating} reviewCount={listing.review_count} size={12} />
              {listing.booking_count != null && listing.booking_count > 0 && (
                <Text style={[styles.rentalCount, { color: C.textTertiary }]}> · {listing.booking_count} rentals</Text>
              )}
            </View>
            {listing.cancellation_policy != null && (
              <View style={styles.policyRow}>
                <View style={styles.policyDot} />
                <Text style={[styles.policyText, { color: C.textTertiary }]}>
                  {getCancellationPolicyEmoji(listing.cancellation_policy)} {getCancellationPolicyLabel(listing.cancellation_policy, language)}
                </Text>
              </View>
            )}
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: C.primary }]}>{priceLabel}</Text>
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
          style={[contextStyles.backdrop, { backgroundColor: C.overlay }]}
          activeOpacity={1}
          onPress={handleContextClose}
        />
        <View style={[contextStyles.menu, { backgroundColor: C.surface }]}>
          <View style={[contextStyles.handle, { backgroundColor: C.border }]} />
          <Text style={[contextStyles.menuTitle, { color: C.textTertiary }]} numberOfLines={1}>{listing.title}</Text>
          {CONTEXT_ACTIONS.map((action, idx) => {
            const isWishlistAction = action.key === 'wishlist'
            const label = isWishlistAction
              ? (wishlisted ? '💔 Remove from wishlist' : '❤️ Add to wishlist')
              : action.label
            return (
              <TouchableOpacity
                key={action.key}
                style={[contextStyles.menuItem, { borderBottomColor: C.border }, idx === CONTEXT_ACTIONS.length - 1 && contextStyles.menuItemLast]}
                onPress={() => handleContextAction(action.key)}
              >
                <Text style={[
                  contextStyles.menuItemText,
                  { color: C.text },
                  action.key === 'hide' && contextStyles.menuItemTextDanger,
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            )
          })}
          <TouchableOpacity
            style={[contextStyles.cancelBtn, { backgroundColor: C.surfaceWarm }]}
            onPress={handleContextClose}
          >
            <Text style={[contextStyles.cancelText, { color: C.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  )
}

export const ListingCard = React.memo(ListingCardComponent)
export default ListingCard

function makeStyles(C: ReturnType<typeof useColors>) {
const styles = StyleSheet.create({
  cardFull: {
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    ...Shadow.sm,
    marginBottom: Spacing.md,
  },
  cardGrid: {
    width: GRID_CARD_WIDTH,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    ...Shadow.sm,
    marginBottom: Spacing.base,
  },
  imageContainer: { position: 'relative' },
  imageFull: { width: '100%', height: 200 },
  imageGrid: { width: '100%', height: 150 },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePlaceholderIcon: { fontSize: 36 },
  imagePlaceholderTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  categoryBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 11, fontWeight: '700', color: C.white },
  availableBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: C.success,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  availableBadgeText: { fontSize: 11, fontWeight: '700', color: C.white },
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
  info: { padding: Spacing.base, paddingBottom: Spacing.md },
  title: { ...Typography.h4, marginBottom: 4, lineHeight: 20 },
  tierRow: { marginBottom: 4 },
  location: { fontSize: 12, marginBottom: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  rentalCount: { fontSize: 12 },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  policyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  policyText: { fontSize: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  price: { ...Typography.priceS },
})

const contextStyles = StyleSheet.create({
  backdrop: { flex: 1 },
  menu: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 34,
    paddingTop: Spacing.md,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: Radius.pill, alignSelf: 'center', marginBottom: Spacing.base,
  },
  menuTitle: {
    fontSize: 14, fontWeight: '700',
    textAlign: 'center', marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  menuItem: {
    paddingHorizontal: Spacing.xl, paddingVertical: 15,
    borderBottomWidth: 1,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemText: { fontSize: 16, fontWeight: '500' },
  menuItemTextDanger: { color: C.error },
  cancelBtn: {
    marginHorizontal: Spacing.xl, marginTop: Spacing.md,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '700' },
})
return { styles, contextStyles }
}

// ---------------------------------------------------------------------------
// ListingCardSkeleton — animated placeholder while listings are loading
// ---------------------------------------------------------------------------

export function ListingCardSkeleton({ variant = 'grid' }: { variant?: 'full' | 'grid' }) {
  const C = useColors()
  const { styles } = useMemo(() => makeStyles(C), [C])
  const opacity = useSharedValue(0.3)
  const isFull = variant === 'full'

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 }),
      ),
      -1,
      false,
    )
    return () => {
      cancelAnimation(opacity)
    }
  }, [opacity])

  const skeletonAnimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View style={[
      isFull ? styles.cardFull : styles.cardGrid,
      { backgroundColor: C.surface, borderColor: C.border },
      skeletonAnimStyle,
    ]}>
      <View style={[isFull ? styles.imageFull : styles.imageGrid, { backgroundColor: C.border }]} />
      <View style={skeletonStyles.info}>
        <View style={[skeletonStyles.line, { width: '70%', backgroundColor: C.border }]} />
        <View style={[skeletonStyles.line, { width: '45%', marginTop: 8, backgroundColor: C.border }]} />
        <View style={[skeletonStyles.line, { width: '30%', marginTop: 8, backgroundColor: C.border }]} />
      </View>
    </Animated.View>
  )
}

const skeletonStyles = StyleSheet.create({
  info: { padding: 12, paddingBottom: 16 },
  line: { height: 12, borderRadius: 6 },
})
