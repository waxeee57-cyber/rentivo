import React, { useState, useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import MapView, { Region } from 'react-native-maps'
import { Colors } from '@/constants/colors'
import { ListingMarker } from '@/components/map/ListingMarker'
import { ListingPreviewSheet } from '@/components/map/ListingPreviewSheet'
import type { Listing } from '@/types'

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    flex: 1,
  },
})
