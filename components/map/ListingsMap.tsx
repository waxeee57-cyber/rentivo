import React, { useState, useCallback, useMemo } from 'react'
import { Fonts } from '@/constants/colors'
import { StyleSheet, View } from 'react-native'
import MapView, { Region } from 'react-native-maps'
import { ListingMarker } from '@/components/map/ListingMarker'
import { ListingPreviewSheet } from '@/components/map/ListingPreviewSheet'
import { LeafletMap } from '@/components/map/LeafletMap'
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

  // Maps gate: without a native Google Maps key <MapView> would hard-crash,
  // so that path stays gated — but instead of a dead placeholder we serve a
  // fully working Leaflet + OSM/CARTO map (zero API keys, zero cost) with
  // Airbnb-style price-pill markers.
  if (!Config.mapsEnabled) {
    return (
      <View style={styles.container}>
        <LeafletMap
          pins={mappableListing.map(l => ({
            id: l.id,
            lat: l.latitude as number,
            lng: l.longitude as number,
            label: `€${Math.round(l.price_per_day)}`,
            selected: l.id === selectedId,
          }))}
          onPinPress={handleMarkerPress}
        />
        <ListingPreviewSheet listing={selectedListing} onClose={handleClose} />
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
    fontFamily: Fonts.regular, fontSize: 40,
  },
  fallbackText: {
    color: C.textSecondary,
    fontFamily: Fonts.regular, fontSize: 14,
  },
  })
}
