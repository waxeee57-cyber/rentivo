import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { StarRating } from '@/components/ui/StarRating'
import { formatEUR } from '@/lib/utils/formatCurrency'
import type { Listing } from '@/types'

interface ListingPreviewSheetProps {
  listing: Listing | null
  onClose: () => void
}

export function ListingPreviewSheet({ listing, onClose }: ListingPreviewSheetProps) {
  if (!listing) return null

  return (
    <View style={styles.sheet}>
      <View style={styles.row}>
        <Image
          source={{ uri: listing.cover_image_url ?? undefined }}
          style={styles.image}
          contentFit="cover"
          placeholder="https://via.placeholder.com/100x80/F5F3EF"
        />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.operator} numberOfLines={1}>{listing.operator?.name}</Text>
          <StarRating rating={listing.rating} reviewCount={listing.review_count} size={12} />
          <Text style={styles.price}>{formatEUR(listing.price_per_day)} / day</Text>
        </View>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => {
            onClose()
            router.push(`/(consumer)/listing/${listing.id}`)
          }}
        >
          <Text style={styles.viewText}>View →</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 80,
    left: Spacing.base,
    right: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  image: { width: 90, height: 70, borderRadius: Radius.lg, marginRight: Spacing.md },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  operator: { fontSize: 12, color: Colors.textTertiary, marginBottom: 4 },
  price: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: 4 },
  viewBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  viewText: { color: Colors.textInverse, fontWeight: '700', fontSize: 13 },
  closeBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: Colors.textTertiary, fontSize: 14, fontWeight: '700' },
})
