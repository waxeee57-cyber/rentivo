import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Platform, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useListings } from '@/lib/hooks/useListings'
import { useLocation } from '@/lib/hooks/useLocation'
import { ListingCard } from '@/components/listing/ListingCard'
import { ListingPreviewSheet } from '@/components/map/ListingPreviewSheet'
import { CityPickerSheet, CITIES } from '@/components/map/CityPickerSheet'
import type { City } from '@/components/map/CityPickerSheet'
import { DatePickerSheet } from '@/components/booking/DatePickerSheet'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { CATEGORIES } from '@/constants/categories'
import type { Listing, RentalCategory, SearchFilters } from '@/types'
import { format } from 'date-fns'

const MapView = Platform.OS !== 'web'
  ? require('react-native-maps').default
  : null
const Marker = Platform.OS !== 'web'
  ? require('react-native-maps').Marker
  : null

import { ListingMarker } from '@/components/map/ListingMarker'

const { width, height: screenHeight } = Dimensions.get('window')

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d1f35' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A9BB5' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A1628' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A1628' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A2942' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0d1f35' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E8A44A' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#C4832A' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1A2942' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0d1f35' }] },
]

const INITIAL_REGION = {
  latitude: 36.5101,
  longitude: -4.8824,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets()
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [selectedCategory, setSelectedCategory] = useState<RentalCategory | null>(null)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [cityName, setCityName] = useState('Marbella')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'rating'>('default')
  const [minCapacity, setMinCapacity] = useState<number | null>(null)
  const mapRef = useRef<typeof MapView extends null ? never : InstanceType<NonNullable<typeof MapView>>>(null)

  const { latitude, longitude } = useLocation()
  const filters: SearchFilters = selectedCategory ? { category: selectedCategory } : {}
  const { listings: rawListings, loading, error } = useListings(filters)

  const listings = React.useMemo(() => {
    let arr = [...rawListings]
    if (minCapacity !== null) arr = arr.filter(l => (l.capacity ?? 0) >= minCapacity)
    if (sortBy === 'price_asc') arr.sort((a, b) => a.price_per_day - b.price_per_day)
    else if (sortBy === 'price_desc') arr.sort((a, b) => b.price_per_day - a.price_per_day)
    else if (sortBy === 'rating') arr.sort((a, b) => b.rating - a.rating)
    return arr
  }, [rawListings, sortBy, minCapacity])

  const listOverlayY = useRef(new Animated.Value(screenHeight)).current
  const mapOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (viewMode === 'list') {
      Animated.parallel([
        Animated.spring(listOverlayY, { toValue: 0, damping: 15, stiffness: 200, useNativeDriver: true }),
        Animated.spring(mapOpacity, { toValue: 0.3, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.spring(listOverlayY, { toValue: screenHeight, damping: 15, stiffness: 200, useNativeDriver: true }),
        Animated.spring(mapOpacity, { toValue: 1, useNativeDriver: true }),
      ]).start()
    }
  }, [viewMode])

  const handleCitySelect = (city: City) => {
    setCityName(city.name)
    if (city.lat && city.lng && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: city.lat,
        longitude: city.lng,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }, 1000)
    }
  }

  const dateLabel = startDate && endDate
    ? `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')}`
    : 'Dates'

  const searchBarTop = insets.top + 8

  return (
    <View style={styles.container}>
      {/* Map layer */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: mapOpacity }]}>
        {Platform.OS !== 'web' && MapView ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={INITIAL_REGION}
            customMapStyle={MAP_STYLE}
            userInterfaceStyle="dark"
            showsUserLocation
            showsCompass={false}
            showsMyLocationButton={false}
          >
            {listings.map(l => (
              <ListingMarker
                key={l.id}
                listing={l}
                selected={selectedListing?.id === l.id}
                onPress={() => {
                  setSelectedListing(l)
                  setViewMode('map')
                }}
              />
            ))}
          </MapView>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.webMapPlaceholder]}>
            <Text style={styles.webMapText}>🗺️</Text>
            <Text style={styles.webMapLabel}>Map view (native only)</Text>
          </View>
        )}
      </Animated.View>

      {/* Floating search bar */}
      <View style={[styles.searchBar, { top: searchBarTop }]}>
        <TouchableOpacity style={styles.searchSection} onPress={() => setShowCityPicker(true)}>
          <Ionicons name="location" size={16} color={Colors.primary} />
          <Text style={styles.searchCity}>{cityName}</Text>
        </TouchableOpacity>
        <View style={styles.searchDivider} />
        <TouchableOpacity style={styles.searchSection} onPress={() => setShowDatePicker(true)}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
          <Text style={[styles.searchDates, startDate && styles.searchDatesActive]}>{dateLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn}>
          <Ionicons name="options-outline" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Floating category filter */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContent}
        >
          <TouchableOpacity
            style={[styles.categoryPill, selectedCategory === null && styles.categoryPillActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryPillText, selectedCategory === null && styles.categoryPillTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.categoryPill, selectedCategory === c.key && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(prev => prev === c.key ? null : c.key)}
            >
              <Text style={[styles.categoryPillText, selectedCategory === c.key && styles.categoryPillTextActive]}>
                {c.emoji} {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map/List toggle */}
      <TouchableOpacity
        style={styles.toggleBtn}
        onPress={() => {
          setViewMode(v => v === 'map' ? 'list' : 'map')
          setSelectedListing(null)
        }}
      >
        <Text style={styles.toggleText}>
          {viewMode === 'map' ? '≡ List' : '⊕ Map'}
        </Text>
      </TouchableOpacity>

      {/* Listing preview (map mode) */}
      {viewMode === 'map' && selectedListing && (
        <ListingPreviewSheet
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
        />
      )}

      {/* List mode overlay */}
      <Animated.View style={[styles.listOverlay, { transform: [{ translateY: listOverlayY }] }]}>
        <View style={styles.listHandle} />

        {/* Sort bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortContent}
          style={styles.sortBar}
        >
          {([
            { key: 'default', label: 'Relevance' },
            { key: 'price_asc', label: '↑ Price' },
            { key: 'price_desc', label: '↓ Price' },
            { key: 'rating', label: '★ Rating' },
          ] as { key: typeof sortBy; label: string }[]).map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortPill, sortBy === opt.key && styles.sortPillActive]}
              onPress={() => setSortBy(opt.key)}
            >
              <Text style={[styles.sortPillText, sortBy === opt.key && styles.sortPillTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.sortDivider} />
          {([
            { cap: null, label: 'Any size' },
            { cap: 4, label: '4+ seats' },
            { cap: 8, label: '8+ seats' },
          ] as { cap: number | null; label: string }[]).map(opt => (
            <TouchableOpacity
              key={opt.label}
              style={[styles.sortPill, minCapacity === opt.cap && styles.sortPillActive]}
              onPress={() => setMinCapacity(opt.cap)}
            >
              <Text style={[styles.sortPillText, minCapacity === opt.cap && styles.sortPillTextActive]}>
                👥 {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {error && <ErrorState message={error} />}
        {loading ? (
          <View style={{ padding: Spacing.base }}>
            {Array(4).fill(null).map((_, i) => <SkeletonCard key={i} />)}
          </View>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews
            renderItem={({ item }) => (
              <ListingCard listing={item} variant="full" showAvailableBadge />
            )}
          />
        )}
      </Animated.View>

      {/* Sheets */}
      <CityPickerSheet
        visible={showCityPicker}
        selectedCity={cityName}
        onSelect={handleCitySelect}
        onClose={() => setShowCityPicker(false)}
      />
      <DatePickerSheet
        visible={showDatePicker}
        startDate={startDate}
        endDate={endDate}
        onApply={(s, e) => { setStartDate(s); setEndDate(e) }}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceWarm },

  webMapPlaceholder: {
    backgroundColor: Colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webMapText: { fontSize: 64, marginBottom: Spacing.base },
  webMapLabel: { fontSize: 16, color: Colors.textTertiary },

  searchBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 52,
    backgroundColor: Colors.surface,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 10,
  },
  searchSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  searchCity: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  searchDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  searchDates: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  searchDatesActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  filterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },

  categoryBar: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  categoryContent: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  categoryPill: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  categoryPillActive: {
    backgroundColor: Colors.primary,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryPillTextActive: {
    color: Colors.textInverse,
  },

  toggleBtn: {
    position: 'absolute',
    bottom: 170,
    right: 16,
    backgroundColor: Colors.dark,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 6,
  },
  toggleText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 14,
  },

  listOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    zIndex: 8,
  },
  listHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  listContent: {
    padding: Spacing.base,
    paddingTop: Spacing.sm,
  },
  sortBar: { flexGrow: 0 },
  sortContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  sortDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
    alignSelf: 'center',
  },
  sortPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceWarm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sortPillText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  sortPillTextActive: { color: Colors.textInverse },
})
