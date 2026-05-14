import React, { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Marker } from 'react-native-maps'
import { Colors, Radius, Shadow } from '@/constants/colors'
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
        Animated.spring(scale, { toValue: 1.15, damping: 14, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.spring(scale, { toValue: 1, damping: 14, useNativeDriver: true }).start()
    }
  }, [selected, scale])

  const price = `€${Math.round(listing.price_per_day / 100)}`

  return (
    <Marker
      coordinate={{ latitude: listing.latitude, longitude: listing.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={[styles.bubble, selected && styles.bubbleSelected]}>
          <Text style={[styles.label, selected && styles.labelSelected]}>{price}</Text>
        </View>
      </Animated.View>
    </Marker>
  )
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  bubbleSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadow.gold,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  labelSelected: {
    color: Colors.textInverse,
  },
})
