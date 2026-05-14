import React, { useState } from 'react'
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
import type { RentalCategory, SearchFilters } from '@/types'

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<RentalCategory | null>(null)

  const filters: SearchFilters = {
    category: selectedCategory ?? undefined,
  }
  const { listings, loading } = useListings(filters)

  const filtered = query.trim()
    ? listings.filter(l =>
        l.title.toLowerCase().includes(query.toLowerCase()) ||
        l.make?.toLowerCase().includes(query.toLowerCase()) ||
        l.model?.toLowerCase().includes(query.toLowerCase()),
      )
    : listings

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
        <EmptyState emoji="🔍" title="No results" subtitle="Try a different search or category" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item }) => <ListingCard listing={item} />}
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
  grid: { padding: Spacing.base },
  columnWrapper: { justifyContent: 'space-between' },
})
