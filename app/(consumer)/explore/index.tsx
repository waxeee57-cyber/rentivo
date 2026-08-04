import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Platform, Animated, Modal, RefreshControl,
  ListRenderItem, ActivityIndicator,
} from 'react-native'
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Shadow, Fonts, Typography } from '@/constants/colors'
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
import { formatEUR, formatPricePerDay } from '@/lib/utils/formatCurrency'
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
import { LeafletMap } from '@/components/map/LeafletMap'

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

// Hero headline copy per app language ("Rent a <rotating word>")
const HERO_COPY: Record<'en' | 'es' | 'hu', { prefix: string; words: string[] }> = {
  en: { prefix: 'Rent a ', words: ['car', 'boat', 'villa', 'scooter', 'drone'] },
  es: { prefix: 'Alquila ', words: ['un coche', 'un barco', 'una villa', 'un scooter', 'un dron'] },
  hu: { prefix: 'Bérelj ', words: ['autót', 'hajót', 'villát', 'robogót', 'drónt'] },
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const INSPIRE_THEMES: { icon: IoniconName; title: string; subtitle: string; category: RentalCategory; city: string | null }[] = [
  { icon: 'sunny-outline', title: 'Weekend in Marbella', subtitle: 'Cars & villas from €35/day', category: 'car' as RentalCategory, city: 'Marbella' },
  { icon: 'partly-sunny-outline', title: 'Mediterranean road trip', subtitle: 'Convertibles in Nice, Barcelona', category: 'car' as RentalCategory, city: null },
  { icon: 'boat-outline', title: 'Yacht week in the islands', subtitle: '8+ person boats from €200/day', category: 'yacht' as RentalCategory, city: null },
  { icon: 'bicycle-outline', title: 'Vespa adventures', subtitle: 'Scooters in Dubrovnik · Lisbon', category: 'scooter' as RentalCategory, city: null },
]

const MOODS: { icon: IoniconName; label: string; category: RentalCategory }[] = [
  { icon: 'sunny-outline', label: 'Beach & sun', category: 'yacht' as RentalCategory },
  { icon: 'triangle-outline', label: 'Mountain escape', category: 'bike' as RentalCategory },
  { icon: 'wine-outline', label: 'City & culture', category: 'car' as RentalCategory },
  { icon: 'boat-outline', label: 'Sea adventure', category: 'kayak' as RentalCategory },
]

export default function ExploreScreen() {
  const insets = useSafeAreaInsets()
  const { language } = useAuthStore()
  const isDark = useThemeStore(s => s.isDark)
  const C = useColors()
  // Default to list when maps are gated off (no native key) — the map layer below
  // is absoluteFill and would otherwise mount a crashing <MapView> regardless of mode.
  const [viewMode, setViewMode] = useState<'map' | 'list'>(Config.mapsEnabled ? 'map' : 'list')
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
  const { listings: rawListings, loading, error, refetch, loadMore, loadingMore } = useListings(filters)

  const listings = React.useMemo(() => {
    let arr = [...rawListings]
    if (minCapacity !== null) arr = arr.filter(l => (l.capacity ?? 0) >= minCapacity)
    if (sortBy === 'price_asc') arr.sort((a, b) => a.price_per_day - b.price_per_day)
    else if (sortBy === 'price_desc') arr.sort((a, b) => b.price_per_day - a.price_per_day)
    else if (sortBy === 'rating') arr.sort((a, b) => b.rating - a.rating)
    return arr
  }, [rawListings, sortBy, minCapacity])

  // Cheapest live price in the loaded catalogue. The range runs from ~€25/day
  // (kayaks) to ~€350/day (yachts), but nothing above the fold showed the bottom
  // of it, so price-sensitive users bounced before scrolling. Derived from the
  // real listings — never a hardcoded figure that would drift from the data —
  // and null until at least one listing has loaded, so nothing flashes.
  const minPricePerDay = useMemo(
    () => (listings.length > 0 ? Math.min(...listings.map(l => l.price_per_day)) : null),
    [listings],
  )

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

  // Pull-to-refresh used to be a lie: it flipped `refreshing` and (in mock mode only)
  // waited 700ms, never fetching anything. Now it re-runs the real listing query and
  // clears the spinner from the hook's own loading flag.
  const handleRefresh = useCallback(() => {
    void impactAsync(ImpactFeedbackStyle.Light)
    setRefreshing(true)
    refetch()
  }, [refetch])

  useEffect(() => {
    if (!loading) setRefreshing(false)
  }, [loading])

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
      {(item.images?.[0] ?? item.cover_image_url) != null ? (
        <Image source={{ uri: item.images?.[0] ?? item.cover_image_url as string }} style={hStyles.hCardImage} contentFit="cover" />
      ) : (
        <View style={[hStyles.hCardImage, hStyles.hCardImagePlaceholder]}>
          <Text style={hStyles.hCardPlaceholderText}>{item.title.charAt(0)}</Text>
        </View>
      )}
      <View style={hStyles.hCardInfo}>
        <Text style={hStyles.hCardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={hStyles.hCardPrice}>{formatPricePerDay(item.price_per_day, language)}</Text>
        {item.instant_book === true && (
          <Text style={hStyles.hCardMeta}>Instant booking</Text>
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
      {(item.images?.[0] ?? item.cover_image_url) != null ? (
        <Image source={{ uri: item.images?.[0] ?? item.cover_image_url as string }} style={hStyles.hCardImage} contentFit="cover" />
      ) : (
        <View style={[hStyles.hCardImage, hStyles.hCardImagePlaceholder]}>
          <Text style={hStyles.hCardPlaceholderText}>{item.title.charAt(0)}</Text>
        </View>
      )}
      <View style={hStyles.hCardInfo}>
        <Text style={hStyles.hCardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={hStyles.hCardPrice}>{formatPricePerDay(item.price_per_day, language)}</Text>
        <Text style={hStyles.hCardMeta}>Last-minute deal</Text>
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
    : (language === 'hu' ? 'Dátumok' : language === 'es' ? 'Fechas' : 'Dates')

  const searchBarTop = insets.top + 8
  // Hide the floating filter + map/list toggle while a preview card is up, so they
  // never paint or intercept touches over the ListingPreviewSheet (iOS z-order).
  const previewOpen = viewMode === 'map' && selectedListing != null
  const isLoading = source === 'all' ? allSourceLoading : loading
  const showDiscovery = displayListings.length === 0 && !isLoading && !error

  return (
    <View style={styles.container}>
      {/* Map layer */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: mapOpacity }]}>
        {Platform.OS !== 'web' && MapView && Config.mapsEnabled ? (
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
          <LeafletMap
            pins={listings
              .filter(l => l.latitude != null && l.longitude != null)
              .map(l => ({
                id: l.id,
                lat: l.latitude as number,
                lng: l.longitude as number,
                label: `€${Math.round(l.price_per_day)}`,
                selected: selectedListing?.id === l.id,
              }))}
            onPinPress={(id) => {
              const hit = listings.find(x => x.id === id)
              if (hit) {
                setSelectedListing(hit)
                setViewMode('map')
              }
            }}
          />
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
      {!previewOpen && (
      <View style={[styles.categoryBar, { bottom: Spacing.base }]}>
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
      )}

      {/* Map/List toggle — hidden when maps are gated off (list-only build) */}
      {!previewOpen && Config.mapsEnabled && (
      <TouchableOpacity
        style={[styles.toggleBtn, { bottom: Spacing.base + 56 }]}
        onPress={() => {
          void impactAsync(ImpactFeedbackStyle.Light)
          setViewMode(v => v === 'map' ? 'list' : 'map')
          setSelectedListing(null)
        }}
        accessibilityLabel={viewMode === 'map' ? 'Switch to list view' : 'Switch to map view'}
        accessibilityRole="button"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={viewMode === 'map' ? 'list' : 'map'} size={16} color={C.text} />
          <Text style={styles.toggleText}>
            {viewMode === 'map' ? 'List' : 'Map'}
          </Text>
        </View>
      </TouchableOpacity>
      )}

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
          <Text style={heroStyles.prefix}>{HERO_COPY[language].prefix}</Text>
          <RotatingText
            words={HERO_COPY[language].words}
            style={heroStyles.rotating}
            interval={2400}
          />
        </View>

        {/* Low-price anchor, directly under the headline and above the first
            rail. Quiet supporting text on purpose — the accent colour is
            reserved for the primary CTA and the active tab, and a promotional
            pill here would read as a deal badge rather than as information. */}
        {minPricePerDay !== null && (
          <Text style={heroStyles.fromPrice}>
            {t('fromPricePerDay', language).replace('{price}', formatEUR(minPricePerDay, language))}
          </Text>
        )}

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
              {t('sourceAllPlatforms', language)}
            </Text>
          </TouchableOpacity>
        </View>

        {hasExternalResults && <AffiliateSearchDisclosure />}

        {/* onRetry wired to the (now real) refetch — this used to be a dead end. */}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {isLoading ? (
          <View style={styles.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <ListingCardSkeleton key={i} variant="grid" />
            ))}
          </View>
        ) : showDiscovery ? (
          <ScrollView contentContainerStyle={styles.discoveryContainer}>
            <Text style={styles.discoverySectionTitle}>{t('discoverIdeas', language)}</Text>
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
                <Ionicons name={theme.icon} size={32} color={C.textSecondary} importantForAccessibility="no" />
                <View style={styles.inspireInfo}>
                  <Text style={styles.inspireTitle}>{theme.title}</Text>
                  <Text style={styles.inspireSubtitle}>{theme.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
              </TouchableOpacity>
            ))}

            <Text style={[styles.discoverySectionTitle, { marginTop: Spacing.xl }]}>
              {t('browseByMood', language)}
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
                  <Ionicons name={mood.icon} size={28} color={C.textSecondary} importantForAccessibility="no" />
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
            // Infinite scroll — only the native feed is paginated; the merged
            // "all platforms" result set arrives in one shot from searchAllSources.
            onEndReached={source === 'rentivo' ? loadMore : undefined}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              source === 'rentivo' && loadingMore ? (
                <View style={styles.listFooter}>
                  <ActivityIndicator size="small" color={C.primary} />
                </View>
              ) : null
            }
            ListHeaderComponent={source === 'rentivo' ? (
              <View>
                {availableTodayListings.length > 0 && (
                  <View style={hStyles.section}>
                    <View style={hStyles.sectionHeader}>
                      <View style={hStyles.sectionTitleRow}>
                        <Text style={hStyles.sectionTitle}>{t('availableTodayTitle', language)}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setSelectedCategory(null)}
                        accessibilityLabel={t('seeAll', language)}
                        accessibilityRole="button"
                        style={hStyles.seeAllBtn}
                      >
                        <Text style={hStyles.seeAllText}>{t('seeAll', language)}</Text>
                        <Ionicons name="chevron-forward" size={13} color={C.textSecondary} />
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
                      <View style={hStyles.sectionTitleRow}>
                        <Text style={hStyles.sectionTitle}>{t('lastMinuteTitle', language)}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setSelectedCategory(null)}
                        accessibilityLabel={t('seeAll', language)}
                        accessibilityRole="button"
                        style={hStyles.seeAllBtn}
                      >
                        <Text style={hStyles.seeAllText}>{t('seeAll', language)}</Text>
                        <Ionicons name="chevron-forward" size={13} color={C.textSecondary} />
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
                      <View style={hStyles.sectionTitleRow}>
                        <Text style={hStyles.sectionTitle}>{t('recentlyViewed', language)}</Text>
                      </View>
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
    webMapText: { fontFamily: Fonts.regular, fontSize: 64, marginBottom: Spacing.base },
    webMapLabel: { fontFamily: Fonts.regular, fontSize: 16, color: C.textTertiary },

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
    searchCity: { fontSize: 14, fontFamily: Fonts.bold, color: C.text },
    searchDivider: {
      width: 1, height: 20,
      backgroundColor: C.border,
      marginHorizontal: Spacing.sm,
    },
    searchDates: { fontSize: 13, color: C.textSecondary, fontFamily: Fonts.medium },
    searchDatesActive: { color: C.primaryDark, fontFamily: Fonts.bold },
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
    categoryPillText: { fontSize: 14, fontFamily: Fonts.semibold, color: C.text },
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
    toggleText: { color: C.text, fontFamily: Fonts.bold, fontSize: 14 },

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

    // Compact segmented — hugs content, breathes, no full-width slab
    sourceToggleRow: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      marginHorizontal: Spacing.base, marginBottom: Spacing.base,
      backgroundColor: C.surfaceWarm,
      borderRadius: Radius.pill, padding: 3,
    },
    sourceBtn: { paddingVertical: 8, paddingHorizontal: 18, alignItems: 'center', borderRadius: Radius.pill },
    sourceBtnActive: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, ...Shadow.sm },
    sourceBtnText: { fontSize: 13, fontFamily: Fonts.semibold, color: C.textTertiary },
    sourceBtnTextActive: { color: C.text },

    skeletonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: Spacing.base,
      gap: Spacing.base,
    },
    listContent: { padding: Spacing.base, paddingTop: Spacing.sm, paddingBottom: 100 },
    listFooter: { paddingVertical: Spacing.lg, alignItems: 'center' },
    columnWrapper: { gap: Spacing.base },
    discoveryContainer: { padding: Spacing.base, paddingBottom: 100 },
    discoverySectionTitle: {
      fontSize: 18, fontFamily: Fonts.extrabold, color: C.text,
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
    inspireEmoji: { fontFamily: Fonts.regular, fontSize: 32 },
    inspireInfo: { flex: 1 },
    inspireTitle: { fontSize: 15, fontFamily: Fonts.bold, color: C.text },
    inspireSubtitle: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary, marginTop: 2 },
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
    moodEmoji: { fontFamily: Fonts.regular, fontSize: 28 },
    moodLabel: { fontSize: 13, fontFamily: Fonts.semibold, color: C.text, textAlign: 'center' },
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
    title: { fontSize: 18, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.xl },
    sectionLabel: {
      fontSize: 12, fontFamily: Fonts.bold, color: C.textTertiary,
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
    pillText: { fontSize: 13, fontFamily: Fonts.semibold, color: C.text },
    pillTextActive: { color: C.textInverse },
    applyBtn: {
      backgroundColor: C.primary,
      borderRadius: Radius.pill, paddingVertical: Spacing.base,
      alignItems: 'center', marginTop: Spacing.sm,
    },
    applyBtnText: { fontSize: 16, fontFamily: Fonts.extrabold, color: C.textInverse },
  })

  const heroStyles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.sm,
    },
    prefix: {
      fontFamily: 'Manrope_800ExtraBold',
      fontSize: 32,
      letterSpacing: -1.0,
      color: C.text,
    },
    rotating: {
      fontFamily: 'Manrope_800ExtraBold',
      fontSize: 32,
      letterSpacing: -1.0,
      color: C.text,
    },
    // Deliberately secondary ink and body type: helpful information, not a badge.
    fromPrice: {
      ...Typography.bodyS,
      color: C.textSecondary,
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.sm,
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
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sectionTitle: {
      fontFamily: 'Manrope_700Bold',
      fontSize: 16,
      letterSpacing: -0.3,
      color: C.text,
    },
    seeAllBtn: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: Spacing.sm,
    },
    seeAllText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
      color: C.textSecondary,
    },
    hList: {
      paddingHorizontal: Spacing.base,
      gap: Spacing.md,
    },
    hCard: {
      width: 220,
    },
    hCardImage: {
      width: '100%',
      height: 140,
      borderRadius: Radius.xl,
    },
    hCardImagePlaceholder: {
      backgroundColor: C.surfaceWarm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hCardPlaceholderText: {
      fontSize: 36,
      fontFamily: Fonts.bold,
      color: C.textTertiary,
    },
    hCardInfo: {
      paddingTop: Spacing.sm,
      paddingHorizontal: 2,
      gap: 3,
    },
    hCardTitle: {
      fontFamily: 'Manrope_700Bold',
      fontSize: 14,
      color: C.text,
    },
    hCardPrice: {
      fontFamily: 'Manrope_700Bold',
      fontSize: 13,
      color: C.text,
      fontVariant: ['tabular-nums'],
    },
    hCardMeta: {
      fontSize: 12,
      fontFamily: Fonts.medium,
      color: C.textTertiary,
    },
  })

  return { styles, filterStyles, heroStyles, hStyles }
}
