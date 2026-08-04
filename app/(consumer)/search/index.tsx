import React, { useState, useMemo, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { ListingCard, ListingCardSkeleton } from '@/components/listing/ListingCard'
import { CategoryPill } from '@/components/ui/CategoryPill'
import { EmptyState } from '@/components/ui/EmptyState'
import ListingsMap from '@/components/map/ListingsMap'
import { useListings } from '@/lib/hooks/useListings'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { filterListings } from '@/lib/hooks/useSearch'
import { CATEGORIES } from '@/constants/categories'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t, type TranslationKey } from '@/constants/i18n'
import type { RentalCategory, SearchFilters } from '@/types'
import type { SearchState } from '@/lib/hooks/useSearch'
import { useColors } from '@/lib/hooks/useColors'

type SortKey = SearchState['sort']
type ViewMode = 'list' | 'map'

const SORT_OPTION_KEYS: { key: SortKey; labelKey: TranslationKey }[] = [
  { key: 'relevance', labelKey: 'sortRelevance' },
  { key: 'price_asc', labelKey: 'sortPriceAsc' },
  { key: 'price_desc', labelKey: 'sortPriceDesc' },
  { key: 'rating', labelKey: 'sortRating' },
  { key: 'newest', labelKey: 'sortNewest' },
]

const CAPACITY_OPTIONS: { cap: number | null; labelKey: TranslationKey }[] = [
  { cap: null, labelKey: 'filterAnySize' },
  { cap: 4, labelKey: 'seats4Plus' },
  { cap: 8, labelKey: 'seats8Plus' },
]

const CAT_I18N_KEYS: Record<RentalCategory, TranslationKey> = {
  car: 'catCars', motorcycle: 'catMotorcycles', yacht: 'catYachts',
  villa: 'catVillas', bike: 'catBikes', scooter: 'catScooters',
  kayak: 'catKayaks', surfboard: 'catSurfboards', equipment: 'catEquipment',
  other: 'catOther',
}

const POPULAR_SUGGESTIONS = ['BMW', 'Vespa', 'Marbella', 'Yacht', 'Villa', 'Convertible']

export default function SearchScreen() {
  const { language } = useAuthStore()
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<RentalCategory | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('relevance')
  const [instantBook, setInstantBook] = useState(false)
  const [minCapacity, setMinCapacity] = useState<number | null>(null)
  const [focused, setFocused] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const inputRef = useRef<TextInput>(null)

  const { history, addSearch, clearHistory } = useSearchHistory()

  const filters: SearchFilters = { category: selectedCategory ?? undefined }
  const { listings, loading, loadMore, loadingMore } = useListings(filters)

  const searchState: SearchState = {
    query,
    category: selectedCategory,
    minPrice: null,
    maxPrice: null,
    sort: sortBy,
    instantBook,
    capacity: minCapacity,
    country: null,
    city: null,
  }

  const filtered = useMemo(
    () => filterListings(listings, searchState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listings, query, selectedCategory, sortBy, instantBook, minCapacity],
  )

  const handleSearch = useCallback((text: string) => {
    setQuery(text)
    if (text.trim().length >= 2) void addSearch(text.trim())
  }, [addSearch])

  const handleSuggestion = useCallback((text: string) => {
    setQuery(text)
    inputRef.current?.blur()
    setFocused(false)
    void addSearch(text)
  }, [addSearch])

  const showSuggestions = focused && query.length === 0

  const hasActiveFilters =
    query.trim().length > 0 || selectedCategory !== null ||
    instantBook || minCapacity !== null || sortBy !== 'relevance'

  const clearFilters = useCallback(() => {
    setQuery('')
    setSelectedCategory(null)
    setSortBy('relevance')
    setInstantBook(false)
    setMinCapacity(null)
  }, [])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['top']}>
      {/* Header row: title + List/Map toggle */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: C.text }]}>{t('search', language)}</Text>
        <View style={[styles.viewToggle, { backgroundColor: C.surface, borderColor: C.border }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
            accessibilityLabel={t('viewList', language)}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'list' }}
          >
            <Ionicons
              name="list"
              size={16}
              color={viewMode === 'list' ? C.textInverse : C.textSecondary}
            />
            <Text style={[styles.toggleText, { color: C.textSecondary }, viewMode === 'list' && { color: C.textInverse }]}>
              {t('viewList', language)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
            onPress={() => setViewMode('map')}
            accessibilityLabel={t('viewMap', language)}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'map' }}
          >
            <Ionicons
              name="map"
              size={16}
              color={viewMode === 'map' ? C.textInverse : C.textSecondary}
            />
            <Text style={[styles.toggleText, { color: C.textSecondary }, viewMode === 'map' && { color: C.textInverse }]}>
              {t('viewMap', language)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Ionicons name="search" size={16} color={C.textSecondary} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: C.text }]}
            placeholder={t('searchPlaceholder', language)}
            placeholderTextColor={C.textTertiary}
            value={query}
            onChangeText={handleSearch}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="search"
            accessibilityLabel="Search listings"
            accessibilityHint="Type to search by vehicle, location, or operator name"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={C.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* History / Suggestions dropdown */}
      {showSuggestions && (
        <View style={[styles.suggestions, { backgroundColor: C.surface, borderColor: C.border }]}>
          {history.length > 0 && (
            <>
              <View style={styles.suggestionsHeader}>
                <Text style={styles.suggestionsLabel}>Recent searches</Text>
                <TouchableOpacity onPress={clearHistory}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>
              {history.map(h => (
                <TouchableOpacity key={h} style={styles.suggestionRow} onPress={() => handleSuggestion(h)}>
                  <Ionicons name="time-outline" size={14} color={C.textSecondary} />
                  <Text style={[styles.suggestionText, { color: C.text }]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          <Text style={styles.trendingLabel}>Trending</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingChips}>
            {POPULAR_SUGGESTIONS.map(s => (
              <TouchableOpacity key={s} style={styles.trendingChip} onPress={() => handleSuggestion(s)}>
                <Text style={styles.trendingChipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.categories}>
        <CategoryPill
          label={t('catAll', language)}
          active={selectedCategory === null}
          onPress={() => setSelectedCategory(null)}
        />
        {CATEGORIES.map(c => (
          <CategoryPill
            key={c.key}
            label={t(CAT_I18N_KEYS[c.key], language)}
            icon={c.icon}
            active={selectedCategory === c.key}
            onPress={() => setSelectedCategory(selectedCategory === c.key ? null : c.key)}
          />
        ))}
      </ScrollView>

      {/* Sort + Filters bar — only shown in list mode */}
      {viewMode === 'list' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.sortBar}>
          {SORT_OPTION_KEYS.map(opt => (
            <CategoryPill
              key={opt.key}
              label={t(opt.labelKey, language)}
              active={sortBy === opt.key}
              onPress={() => setSortBy(opt.key)}
            />
          ))}
          <View style={[styles.sortDivider, { backgroundColor: C.border }]} />
          <CategoryPill
            label={t('filterInstant', language)}
            active={instantBook}
            onPress={() => setInstantBook(v => !v)}
          />
          {CAPACITY_OPTIONS.map(opt => (
            <CategoryPill
              key={String(opt.cap)}
              label={t(opt.labelKey, language)}
              active={minCapacity === opt.cap}
              onPress={() => setMinCapacity(opt.cap)}
            />
          ))}
        </ScrollView>
      )}

      {/* Map view */}
      {viewMode === 'map' ? (
        <ListingsMap listings={filtered} />
      ) : loading ? (
        /* List loading state */
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <ListingCardSkeleton key={i} variant="grid" />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        /* List empty state */
        /* Dead end before: a bare "no results" message with nothing to tap. */
        <EmptyState
          icon="search-outline"
          title="No results"
          subtitle={query ? 'Try different search terms or remove filters' : 'Try a different category'}
          action={hasActiveFilters
            ? { label: t('clearFiltersAction', language), onPress: clearFilters }
            : undefined}
          secondaryAction={{
            label: t('browseAll', language),
            onPress: () => router.push('/(consumer)/explore' as Parameters<typeof router.push>[0]),
          }}
        />
      ) : (
        /* List results */
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={2}
          style={styles.list}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.columnWrapper}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item }) => <ListingCard listing={item} showAvailableBadge />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? (
            <View style={styles.listFooter}>
              <ActivityIndicator size="small" color={C.primary} />
            </View>
          ) : null}
        />
      )}
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  title: {
    fontFamily: 'Manrope_800ExtraBold', fontSize: 26, letterSpacing: -0.6, color: C.text,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: C.border,
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    minHeight: 44,
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: C.text,
  },
  toggleText: {
    fontSize: 13,
    fontFamily: Fonts.semibold,
    color: C.textSecondary,
  },
  searchRow: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchIcon: { marginRight: 2 },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.regular, fontSize: 15,
    color: C.text,
    paddingVertical: 0,
  },
  suggestions: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.base,
    marginTop: 4,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: Spacing.sm,
    zIndex: 50,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  suggestionsLabel: {
    fontSize: 11, fontFamily: Fonts.bold, color: C.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  clearText: { fontSize: 12, color: C.primary, fontFamily: Fonts.semibold },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  suggestionText: { fontFamily: Fonts.regular, fontSize: 14, color: C.text },
  trendingChips: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.sm },
  trendingChip: {
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
  },
  trendingChipText: { fontSize: 13, fontFamily: Fonts.semibold, color: C.text },
  // Horizontal chip rows must hug their content height; without flexGrow:0 a
  // horizontal ScrollView expands vertically in the flex column and shoves the
  // list down (the big empty gap bug).
  chipScroll: { flexGrow: 0 },
  categories: { paddingHorizontal: 16, paddingVertical: Spacing.sm, alignItems: 'center' },
  sortBar: { paddingHorizontal: 16, paddingVertical: Spacing.sm, alignItems: 'center' },
  trendingLabel: {
    paddingHorizontal: Spacing.base, paddingTop: Spacing.sm,
    fontSize: 11, fontFamily: Fonts.bold, color: C.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sortDivider: {
    width: 1, height: 24, backgroundColor: C.border,
    marginHorizontal: Spacing.xs, alignSelf: 'center',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.base,
    gap: Spacing.base,
  },
  list: { flex: 1 },
  grid: { padding: Spacing.base, paddingBottom: 100 },
  listFooter: { paddingVertical: Spacing.lg, alignItems: 'center' },
  columnWrapper: { justifyContent: 'space-between' },
}) }
