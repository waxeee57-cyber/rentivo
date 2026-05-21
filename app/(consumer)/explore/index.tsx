import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Platform, Animated, Modal, RefreshControl,
  ListRenderItem,
} from 'react-native'
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Shadow } from '@/constants/colors'
import { useListings } from '@/lib/hooks/useListings'
import { useLocation } from '@/lib/hooks/useLocation'
import { ListingCard, ListingCardSkeleton } from '@/components/listing/ListingCard'
import { ExternalListingCard } from '@/components/integrations/ExternalListingCard'
import { AffiliateSearchDisclosure } from '@/components/integrations/AffiliateDisclosure'
import { ListingPreviewSheet } from '@/components/map/ListingPreviewSheet'
import { CityPickerSheet } from '@/components/map/CityPickerSheet'
import type { City } from '@/components/map/CityPickerSheet'
import { DatePickerSheet } from '@/components/booking/DatePickerSheet'
import { ErrorState } from '@/components/ui/ErrorState'
import { CATEGORIES } from '@/constants/categories'
import { searchAllSources } from '@/lib/api/unifiedSearch'
import { getAvailableTodayListings, getLastMinuteListings } from '@/lib/api/listings'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useRecentlyViewedStore } from '@/lib/store/useRecentlyViewedStore'
import { t, type TranslationKey } from '@/constants/i18n'
import { openAffiliateLink } from '@/lib/utils/affiliateLinks'
import { formatPricePerDay } from '@/lib/utils/formatCurrency'
import { Image } from 'expo-image'
import type { Listing, RentalCategory, SearchFilters, AnyListing, ExternalListing } from '@/types'
import { format } from 'date-fns'
import { router } from 'expo-router'
import { RotatingText } from '@/components/ui/RotatingText'
import { useThemeStore } from '@/lib/store/useThemeStore'
import { useColors } from '@/lib/hooks/useColors'
import { Config } from '@/constants/config'

const CAT_I18N_KEYS: Record<RentalCategory, TranslationKey> = {
  car: 'catCars', motorcycle: 'catMotorcycles', yacht: 'catYachts',
  villa: 'catVillas', bike: 'catBikes', scooter: 'catScooters',
  kayak: 'catKayaks', surfboard: 'catSurfboards', equipment: 'catEquipment',
  other: 'catOther',
}

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

const INSPIRE_THEMES = [
  { emoji: '🏖️', title: 'Weekend in Marbella', subtitle: 'Cars & villas from €35/day', category: 'car' as RentalCategory, city: 'Marbella' },
  { emoji: '🌅', title: 'Mediterranean road trip', subtitle: 'Convertibles in Nice, Barcelona', category: 'car' as RentalCategory, city: null },
  { emoji: '⛵', title: 'Yacht week in the islands', subtitle: '8+ person boats from €200/day', category: 'yacht' as RentalCategory, city: null },
  { emoji: '🛵', title: 'Vespa adventures', subtitle: 'Scooters in Dubrovnik · Lisbon', category: 'scooter' as RentalCategory, city: null },
]

const MOODS = [
  { emoji: '🌴', label: 'Beach & sun', category: 'yacht' as RentalCategory },
  { emoji: '🏔️', label: 'Mountain escape', category: 'bike' as RentalCategory },
  { emoji: '🍷', label: 'City & culture', category: 'car' as RentalCategory },
  { emoji: '⚓', label: 'Sea adventure', category: 'kayak' as RentalCategory },
]

export default function ExploreScreen() {
  const insets = useSafeAreaInsets()
  const { language } = useAuthStore()
  const isDark = useThemeStore(s => s.isDark)
  const C = useColors()
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
  const [source, setSource] = useState<'rentivo' | 'all'>('rentivo')
  const [allSourceListings, setAllSourceListings] = useState<AnyListing[]>([])
  const [allSourceLoading, setAllSourceLoading] = useState(false)
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [availableTodayListings, setAvailableTodayListings] = useState<Listing[]>([])
  const [lastMinuteListings, setLastMinuteListings] = useState<Listing[]>([])
  const recentlyViewed = useRecentlyViewedStore(s => s.items)
  const mapRef = useRef<typeof MapView extends null ? never : InstanceType<NonNullable<typeof MapView>>>(null)

  const { styles, filterStyles, heroStyles, hStyles } = useMemo(() => makeStyles(C), [C])

  useLocation()
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

  useEffect(() => {
    if (listings.length > 0 && mapRef.current && viewMode === 'map') {
      const coords = listings
        .filter(l => l.latitude != null && l.longitude != null)
        .map(l => ({ latitude: l.latitude!, longitude: l.longitude! }))
      if (coords.length > 0) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 50, bottom: 220, left: 50 },
          animated: true,
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings.length, viewMode])

  useEffect(() => {
    if (source !== 'all') {
      setAllSourceListings([])
      return
    }
    setAllSourceLoading(true)
    searchAllSources({
      category: selectedCategory ?? undefined,
      city: cityName,
      checkIn: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
      checkOut: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
    }).then(results => {
      setAllSourceListings(results)
      setAllSourceLoading(false)
    }).catch(() => setAllSourceLoading(false))
  }, [source, selectedCategory, cityName, startDate, endDate])

  useEffect(() => {
    getAvailableTodayListings()
      .then(setAvailableTodayListings)
      .catch(() => setAvailableTodayListings([]))
    getLastMinuteListings()
      .then(setLastMinuteListings)
      .catch(() => setLastMinuteListings([]))
  }, [])

  const displayListings: AnyListing[] = source === 'all'
    ? allSourceListings
    : listings.map(l => ({ ...l, sourceType: 'native' as const }))

  const hasExternalResults = source === 'all' &&
    allSourceListings.some(l => l.sourceType === 'external')

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    if (Config.useMock) await new Promise<void>(r => setTimeout(r, 700))
    setRefreshing(false)
  }, [])

  const renderListItem = useCallback<ListRenderItem<AnyListing>>(({ item }) => {
    if (item.sourceType === 'native') {
      return <ListingCard listing={item as Listing} variant={source === 'rentivo' ? 'grid' : 'full'} showAvailableBadge />
    }
    return <ExternalListingCard listing={item as ExternalListing} />
  }, [source])

  const renderAvailableTodayItem = useCallback<ListRenderItem<Listing>>(({ item }) => (
    <TouchableOpacity
      style={hStyles.hCard}
      onPress={() => router.push(`/(consumer)/listing/${item.id}`)}
      accessibilityLabel={`${item.title}, ${formatPricePerDay(item.price_per_day, language)}`}
      accessibilityRole="button"
    >
      {item.cover_image_url != null ? (
        <Image source={{ uri: item.cover_image_url }} style={hStyles.hCardImage} contentFit="cover" />
      ) : (
        <View style={[hStyles.hCardImage, hStyles.hCardImagePlaceholder]}>
          <Text style={hStyles.hCardPlaceholderText}>{item.title.charAt(0)}</Text>
        </View>
      )}
      <View style={hStyles.hCardInfo}>
        <Text style={hStyles.hCardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={hStyles.hCardPrice}>{formatPricePerDay(item.price_per_day, language)}</Text>
        {item.instant_book === true && (
          <View style={hStyles.instantBadge}>
            <Text style={hStyles.instantBadgeText}>⚡ Instant</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  ), [language, hStyles])

  const renderLastMinuteItem = useCallback<ListRenderItem<Listing>>(({ item }) => (
    <TouchableOpacity
      style={hStyles.hCard}
      onPress={() => router.push(`/(consumer)/listing/${item.id}`)}
      accessibilityLabel={`${item.title}, ${formatPricePerDay(item.price_per_day, language)}`}
      accessibilityRole="button"
    >
      {item.cover_image_url != null ? (
        <Image source={{ uri: item.cover_image_url }} style={hStyles.hCardImage} contentFit="cover" />
      ) : (
        <View style={[hStyles.hCardImage, hStyles.hCardImagePlaceholder]}>
          <Text style={hStyles.hCardPlaceholderText}>{item.title.charAt(0)}</Text>
        </View>
      )}
      <View style={hStyles.hCardInfo}>
        <Text style={hStyles.hCardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={hStyles.hCardPrice}>{formatPricePerDay(item.price_per_day, language)}</Text>
        <View style={hStyles.dealBadge}>
          <Text style={hStyles.dealBadgeText}>🔥 Last minute</Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [language, hStyles])

  const handleViewListing = useCallback((listing: AnyListing) => {
    if (listing.sourceType === 'external') {
      openAffiliateLink(
        (listing as ExternalListing).external_url,
        (listing as ExternalListing).platform,
        listing.id,
      )
    } else {
      router.push(`/(consumer)/listing/${listing.id}`)
    }
  }, [])

  const dateLabel = startDate && endDate
    ? `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')}`
    : 'Dates'

  const searchBarTop = insets.top + 8
  const isLoading = source === 'all' ? allSourceLoading : loading
  const showDiscovery = displayListings.length === 0 && !isLoading && !error

  return (
    <View style={styles.container}>
      {/* Map layer */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: mapOpacity }]}>
        {Platform.OS !== 'web' && MapView ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={INITIAL_REGION}
            customMapStyle={isDark ? MAP_STYLE : undefined}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
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
        <TouchableOpacity style={styles.searchSection} onPress={() => setShowCityPicker(true)} accessibilityLabel={`Location: ${cityName}`} accessibilityRole="button">
          <Ionicons name="location" size={16} color={C.primary} />
          <Text style={styles.searchCity}>{cityName}</Text>
        </TouchableOpacity>
        <View style={styles.searchDivider} />
        <TouchableOpacity style={styles.searchSection} onPress={() => setShowDatePicker(true)} accessibilityLabel={`Dates: ${dateLabel}`} accessibilityRole="button">
          <Ionicons name="calendar-outline" size={16} color={C.textSecondary} />
          <Text style={[styles.searchDates, startDate != null && styles.searchDatesActive]}>{dateLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilterSheet(true)} accessibilityLabel="Sort and filter" accessibilityRole="button">
          <Ionicons name="options-outline" size={16} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* Floating category filter */}
      <View style={[styles.categoryBar, { bottom: insets.bottom + 90 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContent}
        >
          <TouchableOpacity
            style={[styles.categoryPill, selectedCategory === null && styles.categoryPillActive]}
            onPress={() => {
              void impactAsync(ImpactFeedbackStyle.Light)
              setSelectedCategory(null)
            }}
            accessibilityLabel={t('catAll', language)}
            accessibilityRole="button"
          >
            <Text style={[styles.categoryPillText, selectedCategory === null && styles.categoryPillTextActive]}>
              {t('catAll', language)}
            </Text>
          </TouchableOpacity>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.categoryPill, selectedCategory === c.key && styles.categoryPillActive]}
              onPress={() => {
                void impactAsync(ImpactFeedbackStyle.Light)
                setSelectedCategory(prev => prev === c.key ? null : c.key)
              }}
              accessibilityLabel={t(CAT_I18N_KEYS[c.key], language)}
              accessibilityRole="button"
            >
              <Ionicons
                name={c.icon}
                size={14}
                color={selectedCategory === c.key ? C.textInverse : C.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.categoryPillText, selectedCategory === c.key && styles.categoryPillTextActive]}>
                {t(CAT_I18N_KEYS[c.key], language)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map/List toggle */}
      <TouchableOpacity
        style={[styles.toggleBtn, { bottom: insets.bottom + 142 }]}
        onPress={() => {
          void impactAsync(ImpactFeedbackStyle.Light)
          setViewMode(v => v === 'map' ? 'list' : 'map')
          setSelectedListing(null)
        }}
        accessibilityLabel={viewMode === 'map' ? 'Switch to list view' : 'Switch to map view'}
        accessibilityRole="button"
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
      <Animated.View style={[styles.listOverlay, { transform: [{ translateY: listOverlayY }], paddingTop: insets.top + 80 }]}>
        <View style={styles.listHandle} />

        <View style={heroStyles.row}>
          <Text style={heroStyles.prefix}>Rent a </Text>
          <RotatingText
            words={['car', 'boat', 'villa', 'scooter', 'drone']}
            style={heroStyles.rotating}
            interval={2400}
          />
        </View>

        {/* Source toggle */}
        <View style={styles.sourceToggleRow}>
          <TouchableOpacity
            style={[styles.sourceBtn, source === 'rentivo' && styles.sourceBtnActive]}
            onPress={() => {
              void impactAsync(ImpactFeedbackStyle.Light)
              setSource('rentivo')
            }}
            accessibilityLabel={t('sourceRentivoOnly', language)}
            accessibilityRole="button"
          >
            <Text style={[styles.sourceBtnText, source === 'rentivo' && styles.sourceBtnTextActive]}>
              {t('sourceRentivoOnly', language)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sourceBtn, source === 'all' && styles.sourceBtnActive]}
            onPress={() => {
              void impactAsync(ImpactFeedbackStyle.Light)
              setSource('all')
            }}
            accessibilityLabel={t('sourceAllPlatforms', language)}
            accessibilityRole="button"
          >
            <Text style={[styles.sourceBtnText, source === 'all' && styles.sourceBtnTextActive]}>
              🌐 {t('sourceAllPlatforms', language)}
            </Text>
          </TouchableOpacity>
        </View>

        {hasExternalResults && <AffiliateSearchDisclosure />}

        {/* Sort bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortContent}
          style={styles.sortBar}
        >
          {([
            { key: 'default' as typeof sortBy, label: t('sortRelevance', language) },
            { key: 'price_asc' as typeof sortBy, label: t('sortPriceAsc', language) },
            { key: 'price_desc' as typeof sortBy, label: t('sortPriceDesc', language) },
            { key: 'rating' as typeof sortBy, label: t('sortRating', language) },
          ]).map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortPill, sortBy === opt.key && styles.sortPillActive]}
              onPress={() => {
                void impactAsync(ImpactFeedbackStyle.Light)
                setSortBy(opt.key)
              }}
              accessibilityLabel={`Sort by: ${opt.label}`}
              accessibilityRole="button"
            >
              <Text style={[styles.sortPillText, sortBy === opt.key && styles.sortPillTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.sortDivider} />
          {([
            { cap: null as number | null, label: t('filterAnySize', language) },
            { cap: 4 as number | null, label: t('seats4Plus', language) },
            { cap: 8 as number | null, label: t('seats8Plus', language) },
          ]).map(opt => (
            <TouchableOpacity
              key={String(opt.cap)}
              style={[styles.sortPill, minCapacity === opt.cap && styles.sortPillActive]}
              onPress={() => {
                void impactAsync(ImpactFeedbackStyle.Light)
                setMinCapacity(opt.cap)
              }}
              accessibilityLabel={`Capacity: ${opt.label}`}
              accessibilityRole="button"
            >
              <Text style={[styles.sortPillText, minCapacity === opt.cap && styles.sortPillTextActive]}>
                👥 {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {error && <ErrorState message={error} />}
        {isLoading ? (
          <View style={styles.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <ListingCardSkeleton key={i} variant="grid" />
            ))}
          </View>
        ) : showDiscovery ? (
          <ScrollView contentContainerStyle={styles.discoveryContainer}>
            <Text style={styles.discoverySectionTitle}>💡 {t('discoverIdeas', language)}</Text>
            {INSPIRE_THEMES.map(theme => (
              <TouchableOpacity
                key={theme.title}
                style={styles.inspireCard}
                activeOpacity={0.75}
                onPress={() => {
                  void impactAsync(ImpactFeedbackStyle.Light)
                  setSelectedCategory(theme.category)
                  if (theme.city) setCityName(theme.city)
                  setViewMode('list')
                }}
                accessibilityLabel={theme.title}
                accessibilityRole="button"
              >
                <Text style={styles.inspireEmoji}>{theme.emoji}</Text>
                <View style={styles.inspireInfo}>
                  <Text style={styles.inspireTitle}>{theme.title}</Text>
                  <Text style={styles.inspireSubtitle}>{theme.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
              </TouchableOpacity>
            ))}

            <Text style={[styles.discoverySectionTitle, { marginTop: Spacing.xl }]}>
              🎭 {t('browseByMood', language)}
            </Text>
            <View style={styles.moodGrid}>
              {MOODS.map(mood => (
                <TouchableOpacity
                  key={mood.label}
                  style={styles.moodCard}
                  activeOpacity={0.75}
                  onPress={() => {
                    void impactAsync(ImpactFeedbackStyle.Light)
                    setSelectedCategory(mood.category)
                  }}
                  accessibilityLabel={mood.label}
                  accessibilityRole="button"
                >
                  <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                  <Text style={styles.moodLabel}>{mood.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            key={source === 'rentivo' ? 'grid-2' : 'list-1'}
            data={displayListings}
            keyExtractor={item => item.id}
            numColumns={source === 'rentivo' ? 2 : 1}
            columnWrapperStyle={source === 'rentivo' ? styles.columnWrapper : undefined}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={C.primary}
                colors={[C.primary]}
              />
            }
            renderItem={renderListItem}
            ListHeaderComponent={source === 'rentivo' ? (
              <View>
                {availableTodayListings.length > 0 && (
                  <View style={hStyles.section}>
                    <View style={hStyles.sectionHeader}>
                      <Text style={hStyles.sectionTitle}>
                        {`⚡ ${t('availableTodayTitle', language)}`}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setSelectedCategory(null)}
                        accessibilityLabel={t('seeAll', language)}
                        accessibilityRole="button"
                        style={hStyles.seeAllBtn}
                      >
                        <Text style={hStyles.seeAllText}>{`${t('seeAll', language)} →`}</Text>
                      </TouchableOpacity>
                    </View>
                    <FlatList
                      horizontal
                      data={availableTodayListings}
                      keyExtractor={item => `avail-${item.id}`}
                      renderItem={renderAvailableTodayItem}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={hStyles.hList}
                    />
                  </View>
                )}
                {lastMinuteListings.length > 0 && (
                  <View style={hStyles.section}>
                    <View style={hStyles.sectionHeader}>
                      <Text style={hStyles.sectionTitle}>
                        {`🔥 ${t('lastMinuteTitle', language)}`}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setSelectedCategory(null)}
                        accessibilityLabel={t('seeAll', language)}
                        accessibilityRole="button"
                        style={hStyles.seeAllBtn}
                      >
                        <Text style={hStyles.seeAllText}>{`${t('seeAll', language)} →`}</Text>
                      </TouchableOpacity>
                    </View>
                    <FlatList
                      horizontal
                      data={lastMinuteListings}
                      keyExtractor={item => `lm-${item.id}`}
                      renderItem={renderLastMinuteItem}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={hStyles.hList}
                    />
                  </View>
                )}
                {recentlyViewed.length > 0 && (
                  <View style={hStyles.section}>
                    <View style={hStyles.sectionHeader}>
                      <Text style={hStyles.sectionTitle}>🕒 {t('recentlyViewed', language)}</Text>
                    </View>
                    <FlatList
                      horizontal
                      data={recentlyViewed}
                      keyExtractor={item => `rv-${item.id}`}
                      renderItem={renderAvailableTodayItem}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={hStyles.hList}
                    />
                  </View>
                )}
              </View>
            ) : null}
          />
        )}
      </Animated.View>

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

      {/* Filter Sheet */}
      <Modal
        visible={showFilterSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterSheet(false)}
      >
        <TouchableOpacity style={filterStyles.backdrop} activeOpacity={1} onPress={() => setShowFilterSheet(false)} accessibilityLabel="Close filter" accessibilityRole="button" />
        <View style={filterStyles.sheet}>
          <View style={filterStyles.handle} />
          <Text style={filterStyles.title}>{t('sortAndFilter', language)}</Text>

          <Text style={filterStyles.sectionLabel}>{t('sortByLabel', language)}</Text>
          <View style={filterStyles.pillRow}>
            {([
              { key: 'default' as typeof sortBy, label: t('sortRelevance', language) },
              { key: 'price_asc' as typeof sortBy, label: t('sortPriceAsc', language) },
              { key: 'price_desc' as typeof sortBy, label: t('sortPriceDesc', language) },
              { key: 'rating' as typeof sortBy, label: t('sortRating', language) },
            ]).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[filterStyles.pill, sortBy === opt.key && filterStyles.pillActive]}
                onPress={() => {
                  void impactAsync(ImpactFeedbackStyle.Light)
                  setSortBy(opt.key)
                }}
                accessibilityLabel={`Sort by: ${opt.label}`}
                accessibilityRole="button"
              >
                <Text style={[filterStyles.pillText, sortBy === opt.key && filterStyles.pillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={filterStyles.sectionLabel}>{t('capacityLabel', language)}</Text>
          <View style={filterStyles.pillRow}>
            {([
              { cap: null as number | null, label: t('filterAnySize', language) },
              { cap: 4 as number | null, label: t('seats4Plus', language) },
              { cap: 8 as number | null, label: t('seats8Plus', language) },
            ]).map(opt => (
              <TouchableOpacity
                key={opt.label}
                style={[filterStyles.pill, minCapacity === opt.cap && filterStyles.pillActive]}
                onPress={() => {
                  void impactAsync(ImpactFeedbackStyle.Light)
                  setMinCapacity(opt.cap)
                }}
                accessibilityLabel={`Capacity: ${opt.label}`}
                accessibilityRole="button"
              >
                <Text style={[filterStyles.pillText, minCapacity === opt.cap && filterStyles.pillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={filterStyles.applyBtn}
            onPress={() => {
              void impactAsync(ImpactFeedbackStyle.Medium)
              setViewMode('list')
              setShowFilterSheet(false)
            }}
            accessibilityLabel={t('applyFilters', language)}
            accessibilityRole="button"
          >
            <Text style={filterStyles.applyBtnText}>{t('applyFilters', language)}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    webMapPlaceholder: {
      backgroundColor: C.surfaceWarm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    webMapText: { fontSize: 64, marginBottom: Spacing.base },
    webMapLabel: { fontSize: 16, color: C.textTertiary },

    searchBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      height: 56,
      backgroundColor: C.surface,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: C.borderWarm,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.base,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 10,
    },
    searchSection: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    searchCity: { fontSize: 14, fontWeight: '700', color: C.text },
    searchDivider: {
      width: 1, height: 20,
      backgroundColor: C.border,
      marginHorizontal: Spacing.sm,
    },
    searchDates: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
    searchDatesActive: { color: C.primaryDark, fontWeight: '700' },
    filterBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: C.primarySurface,
      alignItems: 'center', justifyContent: 'center',
      marginLeft: Spacing.sm,
    },

    categoryBar: {
      position: 'absolute',
      left: 0, right: 0,
      zIndex: 5,
    },
    categoryContent: { paddingHorizontal: Spacing.base, gap: Spacing.sm },
    categoryPill: {
      backgroundColor: C.surface,
      borderRadius: Radius.full,
      minHeight: 44, paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12, shadowRadius: 6,
      elevation: 3,
      borderWidth: 1, borderColor: C.border,
    },
    categoryPillActive: {
      backgroundColor: C.primary, borderColor: C.primary,
      shadowColor: C.primary, shadowOpacity: 0.3,
    },
    categoryPillText: { fontSize: 14, fontWeight: '600', color: C.text },
    categoryPillTextActive: { color: C.textInverse },

    toggleBtn: {
      position: 'absolute',
      right: 16,
      backgroundColor: C.background,
      borderRadius: Radius.full,
      paddingHorizontal: 16, paddingVertical: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8,
      elevation: 8, zIndex: 6,
      borderWidth: 1, borderColor: C.border,
    },
    toggleText: { color: C.text, fontWeight: '700', fontSize: 14 },

    listOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: C.background,
      zIndex: 8,
    },
    listHandle: {
      width: 40, height: 4, backgroundColor: C.border,
      borderRadius: Radius.pill,
      alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.sm,
    },

    sourceToggleRow: {
      flexDirection: 'row',
      marginHorizontal: Spacing.base, marginBottom: Spacing.sm,
      backgroundColor: C.surfaceWarm,
      borderRadius: Radius.pill, padding: 3,
      borderWidth: 1, borderColor: C.border,
    },
    sourceBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.pill },
    sourceBtnActive: { backgroundColor: C.primary },
    sourceBtnText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
    sourceBtnTextActive: { color: C.textInverse },

    skeletonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: Spacing.base,
      gap: Spacing.base,
    },
    listContent: { padding: Spacing.base, paddingTop: Spacing.sm, paddingBottom: 100 },
    columnWrapper: { gap: Spacing.base },
    sortBar: { flexGrow: 0 },
    sortContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, gap: Spacing.sm },
    sortDivider: {
      width: 1, height: 24, backgroundColor: C.border,
      marginHorizontal: Spacing.sm, alignSelf: 'center',
    },
    sortPill: {
      borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 6,
      backgroundColor: C.surfaceWarm,
      borderWidth: 1, borderColor: C.border,
      minHeight: 44,
      justifyContent: 'center',
    },
    sortPillActive: { backgroundColor: C.primary, borderColor: C.primary },
    sortPillText: { fontSize: 13, fontWeight: '600', color: C.text },
    sortPillTextActive: { color: C.textInverse },

    discoveryContainer: { padding: Spacing.base, paddingBottom: 100 },
    discoverySectionTitle: {
      fontSize: 18, fontWeight: '800', color: C.text,
      marginBottom: Spacing.md,
    },
    inspireCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: Radius.lg, padding: Spacing.base,
      marginBottom: Spacing.sm,
      borderWidth: 1, borderColor: C.border,
      gap: Spacing.md,
    },
    inspireEmoji: { fontSize: 32 },
    inspireInfo: { flex: 1 },
    inspireTitle: { fontSize: 15, fontWeight: '700', color: C.text },
    inspireSubtitle: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
    moodGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
    },
    moodCard: {
      width: '48%',
      backgroundColor: C.surface,
      borderRadius: Radius.lg,
      padding: Spacing.base,
      alignItems: 'center',
      borderWidth: 1, borderColor: C.border,
      gap: Spacing.sm,
    },
    moodEmoji: { fontSize: 28 },
    moodLabel: { fontSize: 13, fontWeight: '600', color: C.text, textAlign: 'center' },
  })

  const filterStyles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: C.overlay },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: Spacing.xl, paddingBottom: Spacing.xxxl,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center', marginBottom: Spacing.xl,
    },
    title: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: Spacing.xl },
    sectionLabel: {
      fontSize: 12, fontWeight: '700', color: C.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md,
    },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
    pill: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: Radius.pill,
      borderWidth: 1, borderColor: C.border,
      backgroundColor: C.surfaceWarm,
      minHeight: 44,
      justifyContent: 'center',
    },
    pillActive: { backgroundColor: C.primary, borderColor: C.primary },
    pillText: { fontSize: 13, fontWeight: '600', color: C.text },
    pillTextActive: { color: C.textInverse },
    applyBtn: {
      backgroundColor: C.primary,
      borderRadius: Radius.pill, paddingVertical: Spacing.base,
      alignItems: 'center', marginTop: Spacing.sm,
    },
    applyBtnText: { fontSize: 16, fontWeight: '800', color: C.textInverse },
  })

  const heroStyles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.sm,
    },
    prefix: {
      fontSize: 28,
      fontWeight: '800',
      color: C.text,
    },
    rotating: {
      fontSize: 28,
      fontWeight: '800',
      color: C.primary,
    },
  })

  const hStyles = StyleSheet.create({
    section: {
      marginBottom: Spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.base,
      marginBottom: Spacing.sm,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: C.text,
    },
    seeAllBtn: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: Spacing.sm,
    },
    seeAllText: {
      fontSize: 13,
      fontWeight: '600',
      color: C.primary,
    },
    hList: {
      paddingHorizontal: Spacing.base,
      gap: Spacing.md,
    },
    hCard: {
      width: 220,
      backgroundColor: C.surface,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
      ...Shadow.sm,
    },
    hCardImage: {
      width: '100%',
      height: 130,
    },
    hCardImagePlaceholder: {
      backgroundColor: C.surfaceWarm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hCardPlaceholderText: {
      fontSize: 36,
      fontWeight: '700',
      color: C.textTertiary,
    },
    hCardInfo: {
      padding: Spacing.sm,
      gap: 4,
    },
    hCardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: C.text,
    },
    hCardPrice: {
      fontSize: 13,
      fontWeight: '600',
      color: C.primary,
    },
    instantBadge: {
      alignSelf: 'flex-start',
      backgroundColor: C.successSurface,
      borderRadius: Radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    instantBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: C.success,
    },
    dealBadge: {
      alignSelf: 'flex-start',
      backgroundColor: C.warningSurface,
      borderRadius: Radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    dealBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: C.warning,
    },
  })

  return { styles, filterStyles, heroStyles, hStyles }
}
