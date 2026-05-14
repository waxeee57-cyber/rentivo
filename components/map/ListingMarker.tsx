import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Marker } from 'react-native-maps'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { formatEUR } from '@/lib/utils/formatCurrency'
import type { Listing } from '@/types'

interface ListingMarkerProps {
  listing: Listing
  selected?: boolean
  onPress: () => void
}

export function ListingMarker({ listing, selected, onPress }: ListingMarkerProps) {
  if (!listing.latitude || !listing.longitude) return null

  return (
    <Marker
      coordinate={{ latitude: listing.latitude, longitude: listing.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <TouchableOpacity
        style={[styles.bubble, selected && styles.bubbleSelected]}
        activeOpacity={0.9}
      >
        <Text style={[styles.price, selected && styles.priceSelected]}>
          {formatEUR(listing.price_per_day)}
        </Text>
      </TouchableOpacity>
    </Marker>
  )
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  bubbleSelected: { backgroundColor: Colors.primary },
  price: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  priceSelected: { color: Colors.textInverse },
})
