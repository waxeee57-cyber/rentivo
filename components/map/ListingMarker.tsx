import React, { useRef, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Marker } from 'react-native-maps'
import { Colors, Radius, Shadow } from '@/constants/colors'
import type { Listing } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

interface ListingMarkerProps {
  listing: Listing
  selected?: boolean
  onPress: () => void
}

export function ListingMarker({ listing, selected, onPress }: ListingMarkerProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
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

  if (listing.latitude == null || listing.longitude == null) return null

  const price = `€${Math.round(listing.price_per_day)}`

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

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  bubble: {
    backgroundColor: C.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: C.border,
    ...Shadow.sm,
  },
  bubbleSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
    ...Shadow.gold,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
  },
  labelSelected: {
    color: C.textInverse,
  },
  })
}
