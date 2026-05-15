import React, { useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { StarRating } from '@/components/ui/StarRating'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { openAffiliateLink } from '@/lib/utils/affiliateLinks'
import { AffiliateDisclosure } from './AffiliateDisclosure'
import type { ExternalListing } from '@/types'

const PLATFORM_INFO: Record<string, { label: string; color: string }> = {
  airbnb: { label: 'Airbnb', color: Colors.airbnb },
  booking: { label: 'Booking.com', color: Colors.info },
  vrbo: { label: 'VRBO', color: Colors.vrbo },
  turo: { label: 'Turo', color: Colors.turo },
  holidu: { label: 'Holidu', color: Colors.primary },
  other: { label: 'External', color: Colors.textSecondary },
}

interface ExternalListingCardProps {
  listing: ExternalListing
}

export function ExternalListingCard({ listing }: ExternalListingCardProps) {
  const scale = useRef(new Animated.Value(1)).current
  const platform = PLATFORM_INFO[listing.platform] ?? PLATFORM_INFO.other
  const imageUri = listing.images?.[0] ?? listing.cover_image_url ?? null

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, damping: 15, useNativeDriver: true }).start()
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, damping: 15, useNativeDriver: true }).start()

  const handleBook = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    void openAffiliateLink(listing.affiliate_url, listing.platform, listing.id)
  }

  return (
    <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={handleBook}
        activeOpacity={1}
      >
        <View style={styles.imageContainer}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderText}>🏠</Text>
            </View>
          )}
          <View style={[styles.platformBadge, { backgroundColor: platform.color }]}>
            <Text
              style={styles.platformBadgeText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              via {platform.label}
            </Text>
          </View>
          <View style={styles.externalBadge}>
            <Text style={styles.externalBadgeText}>↗ External</Text>
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
            {listing.rating !== null && (
              <StarRating rating={listing.rating} reviewCount={listing.review_count} size={12} />
            )}
          </View>

          {listing.city && (
            <Text style={styles.location}>{listing.city}{listing.country ? `, ${listing.country}` : ''}</Text>
          )}

          {listing.description && (
            <Text style={styles.description} numberOfLines={2}>{listing.description}</Text>
          )}

          <View style={styles.priceRow}>
            {listing.price_per_day !== null ? (
              <>
                <Text style={styles.price}>{formatEUR(listing.price_per_day)}</Text>
                <Text style={styles.priceUnit}>/day</Text>
              </>
            ) : (
              <Text style={styles.priceUnknown}>Price on {platform.label}</Text>
            )}
            <TouchableOpacity
              style={[styles.bookBtn, { backgroundColor: platform.color }]}
              onPress={handleBook}
            >
              <Text style={styles.bookBtnText}>Book on {platform.label} →</Text>
            </TouchableOpacity>
          </View>

          <AffiliateDisclosure platform={listing.platform} compact />
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageContainer: { position: 'relative' },
  image: { width: '100%', height: 180 },
  imagePlaceholder: {
    backgroundColor: Colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 48 },
  platformBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  platformBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  externalBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  externalBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.white },
  info: { padding: Spacing.base },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1, marginRight: Spacing.sm },
  location: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  description: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, marginBottom: Spacing.sm },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  price: { fontSize: 18, fontWeight: '700', color: Colors.text },
  priceUnit: { fontSize: 12, color: Colors.textSecondary },
  priceUnknown: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  bookBtn: {
    marginLeft: 'auto',
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bookBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
})
