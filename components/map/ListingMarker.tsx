import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Marker } from 'react-native-maps'
import { Colors, Radius } from '@/constants/colors'
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
      <View style={[styles.marker, selected && styles.markerSelected]}>
        <Text style={[styles.markerText, selected && styles.markerTextSelected]}>
          €{Math.round(listing.price_per_day / 100)}
        </Text>
      </View>
    </Marker>
  )
}

const styles = StyleSheet.create({
  marker: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  markerSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  markerText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  markerTextSelected: {
    color: '#FFFFFF',
  },
})
