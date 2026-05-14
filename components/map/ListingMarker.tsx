import React, { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Marker } from 'react-native-maps'
import { Colors } from '@/constants/colors'
import type { Listing } from '@/types'

interface ListingMarkerProps {
  listing: Listing
  selected?: boolean
  onPress: () => void
}

export function ListingMarker({ listing, selected, onPress }: ListingMarkerProps) {
  if (!listing.latitude || !listing.longitude) return null

  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.25, damping: 10, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1.1, damping: 12, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.spring(scale, { toValue: 1, damping: 12, useNativeDriver: true }).start()
    }
  }, [selected, scale])

  return (
    <Marker
      coordinate={{ latitude: listing.latitude, longitude: listing.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={[styles.marker, selected && styles.markerSelected]}>
          <Text style={[styles.markerText, selected && styles.markerTextSelected]}>
            €{Math.round(listing.price_per_day / 100)}
          </Text>
        </View>
      </Animated.View>
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
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
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
