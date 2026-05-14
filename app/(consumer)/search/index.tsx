import React, { useState, useMemo } from 'react'
import {
  View, Text, FlatList, StyleSheet, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors, Spacing } from '@/constants/colors'
import { Input } from '@/components/ui/Input'
import { ListingCard } from '@/components/listing/ListingCard'
import { CategoryPill } from '@/components/ui/CategoryPill'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useListings } from '@/lib/hooks/useListings'
import { CATEGORIES } from '@/constants/categories'
import type { RentalCategory, SearchFilters, Listing } from '@/types'

type SortKey = 'default' | 'price_asc' | 'price_desc' | 'rating'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Relevance' },
  { key: 'price_asc', label: '↑ Price' },
  { key: 'price_desc', label: '↓ Price' },
  { key: 'rating', label: '★ Rating' },
]

function sortListings(listings: Listing[], sortBy: SortKey): Listing[] {
  const arr = [...listings]
  if (sortBy === 'price_asc') arr.sort((a, b) => a.price_per_day - b.price_per_day)
  else if (sortBy === 'price_desc') arr.sort((a, b) => b.price_per_day - a.price_per_day)
  else if (sortBy === 'rating') arr.sort((a, b) => b.rating - a.rating)
  return arr
}

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<RentalCategory | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('default')

  const filters: SearchFilters = {
    category: selectedCategory ?? undefined,
  }
  const { listings, loading } = useListings(filters)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? listings.filter(l =>
          l.title.toLowerCase().includes(q) ||
          l.make?.toLowerCase().includes(q) ||
          l.model?.toLowerCase().includes(q) ||
          l.operator?.name?.toLowerCase().includes(q),
        )
      : listings
    return sortListings(matched, sortBy)
  }, [listings, query, sortBy])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Search</Text>

      <View style={styles.searchBar}>
        <Input
          placeholder="Search cars, boats, bikes..."
          value={query}
          onChangeText={setQuery}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

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
            emoji={c.emoji}
            active={selectedCategory === c.key}
            onPress={() => setSelectedCategory(selectedCategory === c.key ? null : c.key)}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortBar}>
        {SORT_OPTIONS.map(opt => (
          <CategoryPill
            key={opt.key}
            label={opt.label}
            active={sortBy === opt.key}
            onPress={() => setSortBy(opt.key)}
          />
        ))}
      </ScrollView>

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
          subtitle={query ? 'Try different dates or search terms' : 'Try a different category'}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={2}
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
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  searchBar: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  categories: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  sortBar: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  grid: { padding: Spacing.base },
  columnWrapper: { justifyContent: 'space-between' },
})
