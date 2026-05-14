import React, { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  ScrollView, StyleSheet, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView from 'react-native-maps'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useListings } from '@/lib/hooks/useListings'
import { useLocation } from '@/lib/hooks/useLocation'
import { ListingCard } from '@/components/listing/ListingCard'
import { ListingMarker } from '@/components/map/ListingMarker'
import { ListingPreviewSheet } from '@/components/map/ListingPreviewSheet'
import { CategoryPill } from '@/components/ui/CategoryPill'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { CATEGORIES } from '@/constants/categories'
import { useNotificationStore } from '@/lib/store/useNotificationStore'
import type { Listing, RentalCategory, SearchFilters } from '@/types'

const { width } = Dimensions.get('window')

export default function ExploreScreen() {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list')
  const [selectedCategory, setSelectedCategory] = useState<RentalCategory | null>(null)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const { latitude, longitude } = useLocation()
  const { unreadCount } = useNotificationStore()

  const filters: SearchFilters = selectedCategory ? { category: selectedCategory } : {}
  const { listings, loading, error } = useListings(filters)

  const handleCategoryPress = (cat: RentalCategory | null) => {
    setSelectedCategory(prev => prev === cat ? null : cat)
  }

  const mapRegion = {
    latitude: latitude ?? 36.5101,
    longitude: longitude ?? -4.8824,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logo}>Rentivo</Text>
        <View style={styles.locationPill}>
          <Text style={styles.locationText}>📍 Marbella</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Text style={styles.notifIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          <CategoryPill
            label="All"
            active={selectedCategory === null}
            onPress={() => handleCategoryPress(null)}
          />
          {CATEGORIES.map(c => (
            <CategoryPill
              key={c.key}
              label={c.label}
              emoji={c.emoji}
              active={selectedCategory === c.key}
              onPress={() => handleCategoryPress(c.key)}
            />
          ))}
        </ScrollView>

        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
            onPress={() => setViewMode('map')}
          >
            <Text style={styles.toggleIcon}>🗺️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Text style={styles.toggleIcon}>≡</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && <ErrorState message={error} />}

      {viewMode === 'map' ? (
        <View style={{ flex: 1 }}>
          <MapView style={{ flex: 1 }} region={mapRegion} showsUserLocation>
            {listings.map(l => (
              <ListingMarker
                key={l.id}
                listing={l}
                selected={selectedListing?.id === l.id}
                onPress={() => setSelectedListing(l)}
              />
            ))}
          </MapView>
          {selectedListing && (
            <ListingPreviewSheet
              listing={selectedListing}
              onClose={() => setSelectedListing(null)}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={loading ? Array(4).fill(null) : listings}
          keyExtractor={(item, i) => item?.id ?? String(i)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item }) =>
            loading ? <SkeletonCard /> : <ListingCard listing={item} />
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  logo: { fontSize: 22, fontWeight: '800', color: Colors.primary, flex: 1 },
  locationPill: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  notifBtn: { marginLeft: Spacing.md, position: 'relative' },
  notifIcon: { fontSize: 22 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: Radius.pill,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: Colors.textInverse, fontSize: 9, fontWeight: '700' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.base,
  },
  categories: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  viewToggle: { flexDirection: 'row', gap: 4 },
  toggleBtn: {
    width: 36, height: 36, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtnActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  toggleIcon: { fontSize: 16 },
  grid: { padding: Spacing.base },
  columnWrapper: { justifyContent: 'space-between' },
})
