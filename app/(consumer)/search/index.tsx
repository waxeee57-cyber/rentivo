import React, { useState, useMemo, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, StyleSheet, ScrollView, TouchableOpacity, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ListingCard } from '@/components/listing/ListingCard'
import { CategoryPill } from '@/components/ui/CategoryPill'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useListings } from '@/lib/hooks/useListings'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { filterListings } from '@/lib/hooks/useSearch'
import { CATEGORIES } from '@/constants/categories'
import type { RentalCategory, SearchFilters } from '@/types'
import type { SearchState } from '@/lib/hooks/useSearch'

type SortKey = SearchState['sort']

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'price_asc', label: '↑ Price' },
  { key: 'price_desc', label: '↓ Price' },
  { key: 'rating', label: '★ Rating' },
  { key: 'newest', label: 'Newest' },
]

const POPULAR_SUGGESTIONS = ['BMW', 'Vespa', 'Marbella', 'Yacht', 'Villa', 'Convertible']

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<RentalCategory | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('relevance')
  const [instantBook, setInstantBook] = useState(false)
  const [minCapacity, setMinCapacity] = useState<number | null>(null)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<TextInput>(null)

  const { history, addSearch, clearHistory } = useSearchHistory()

  const filters: SearchFilters = { category: selectedCategory ?? undefined }
  const { listings, loading } = useListings(filters)

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Search</Text>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Cars, boats, villas, bikes..."
            placeholderTextColor={Colors.textTertiary}
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
              <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* History / Suggestions dropdown */}
      {showSuggestions && (
        <View style={styles.suggestions}>
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
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.suggestionText}>{h}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          <Text style={styles.trendingLabel}>🔥 Trending</Text>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        <CategoryPill
          label="All"
          active={selectedCategory === null}
          onPress={() => setSelectedCategory(null)}
        />
        {CATEGORIES.map(c => (
          <CategoryPill
            key={c.key}
            label={c.label}
            icon={c.icon as any}
            active={selectedCategory === c.key}
            onPress={() => setSelectedCategory(selectedCategory === c.key ? null : c.key)}
          />
        ))}
      </ScrollView>

      {/* Sort + Filters bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortBar}>
        {SORT_OPTIONS.map(opt => (
          <CategoryPill
            key={opt.key}
            label={opt.label}
            active={sortBy === opt.key}
            onPress={() => setSortBy(opt.key)}
          />
        ))}
        <View style={styles.sortDivider} />
        <CategoryPill
          label="⚡ Instant"
          active={instantBook}
          onPress={() => setInstantBook(v => !v)}
        />
        {[
          { cap: null, label: 'Any' },
          { cap: 4, label: '4+' },
          { cap: 8, label: '8+' },
        ].map(opt => (
          <CategoryPill
            key={String(opt.cap)}
            label={`👥 ${opt.label}`}
            active={minCapacity === opt.cap}
            onPress={() => setMinCapacity(opt.cap)}
          />
        ))}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <FlatList
          data={Array(4).fill(null)}
          keyExtractor={(_, i) => String(i)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={() => <SkeletonCard />}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No results"
          subtitle={query ? 'Try different search terms or remove filters' : 'Try a different category'}
        />
      ) : (
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
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: {
    fontSize: 26, fontWeight: '800', color: Colors.text,
    paddingHorizontal: Spacing.base, paddingTop: Spacing.md,
  },
  searchRow: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchIcon: { marginRight: 2 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },
  suggestions: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.base,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.border,
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
    fontSize: 11, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  clearText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  suggestionText: { fontSize: 14, color: Colors.text },
  trendingChips: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.sm },
  trendingChip: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.primaryLight,
  },
  trendingChipText: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark },
  categories: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  sortBar: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, gap: Spacing.sm },
  trendingLabel: {
    paddingHorizontal: Spacing.base, paddingTop: Spacing.sm,
    fontSize: 11, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sortDivider: {
    width: 1, height: 24, backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs, alignSelf: 'center',
  },
  list: { flex: 1 },
  grid: { padding: Spacing.base, paddingBottom: 100 },
  columnWrapper: { justifyContent: 'space-between' },
})
