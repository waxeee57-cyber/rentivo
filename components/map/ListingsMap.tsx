import React, { useState, useCallback, useMemo } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import MapView, { Region } from 'react-native-maps'
import { ListingMarker } from '@/components/map/ListingMarker'
import { ListingPreviewSheet } from '@/components/map/ListingPreviewSheet'
import type { Listing } from '@/types'
import { useColors } from '@/lib/hooks/useColors'
import { Config } from '@/constants/config'

interface Props {
  listings: Listing[]
  initialRegion?: Region
}

const DEFAULT_REGION: Region = {
  latitude: 36.51,
  longitude: -4.88,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
}

export default function ListingsMap({ listings, initialRegion }: Props) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedListing = useMemo(
    () => listings.find(l => l.id === selectedId) ?? null,
    [listings, selectedId],
  )

  const handleMarkerPress = useCallback((id: string) => {
    setSelectedId(prev => (prev === id ? null : id))
  }, [])

  const handleClose = useCallback(() => {
    setSelectedId(null)
  }, [])

  const mappableListing = useMemo(
    () => listings.filter(l => l.latitude != null && l.longitude != null),
    [listings],
  )

  // Maps gate: never mount <MapView> without a native Google Maps key — it would
  // hard-crash the app. Render a safe placeholder instead (maps are not required
  // for the booking/payment flow). See Config.mapsEnabled.
  if (!Config.mapsEnabled) {
    return (
      <View style={[styles.container, styles.fallback]}>
        <Text style={styles.fallbackEmoji}>🗺️</Text>
        <Text style={styles.fallbackText}>Map view unavailable</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion ?? DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {mappableListing.map(listing => (
          <ListingMarker
            key={listing.id}
            listing={listing}
            selected={listing.id === selectedId}
            onPress={() => handleMarkerPress(listing.id)}
          />
        ))}
      </MapView>

      <ListingPreviewSheet listing={selectedListing} onClose={handleClose} />
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  map: {
    flex: 1,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackEmoji: {
    fontSize: 40,
  },
  fallbackText: {
    color: C.textSecondary,
    fontSize: 14,
  },
  })
}
