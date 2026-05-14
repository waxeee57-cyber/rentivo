import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { StarRating } from '@/components/ui/StarRating'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { getCategoryLabel } from '@/constants/categories'
import type { Listing } from '@/types'

interface ListingPreviewSheetProps {
  listing: Listing | null
  onClose: () => void
}

export function ListingPreviewSheet({ listing, onClose }: ListingPreviewSheetProps) {
  if (!listing) return null

  return (
    <View style={styles.sheet}>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
      <View style={styles.row}>
        <Image
          source={{ uri: listing.cover_image_url ?? undefined }}
          style={styles.image}
          contentFit="cover"
          placeholder="https://via.placeholder.com/100x80/F5F3EF"
        />
        <View style={styles.info}>
          <View style={styles.catPill}>
            <Text style={styles.catText}>{getCategoryLabel(listing.category)}</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.operator} numberOfLines={1}>
            {listing.operator?.name} · {listing.operator?.city}
          </Text>
          <StarRating rating={listing.rating} reviewCount={listing.review_count} size={12} />
          <View style={styles.priceBookRow}>
            <Text style={styles.price}>{formatEUR(listing.price_per_day)}<Text style={styles.priceUnit}>/day</Text></Text>
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() => {
                onClose()
                router.push(`/(consumer)/listing/${listing.id}`)
              }}
            >
              <Text style={styles.bookBtnText}>Book now →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 16,
    left: Spacing.base,
    right: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 14,
    zIndex: 1,
  },
  closeText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  image: { width: 100, height: 120, borderRadius: 12 },
  info: { flex: 1, paddingTop: 2 },
  catPill: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  operator: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  priceBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  price: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  priceUnit: { fontSize: 13, fontWeight: '400', color: Colors.textSecondary },
  bookBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  bookBtnText: { color: Colors.textInverse, fontWeight: '700', fontSize: 13 },
})
