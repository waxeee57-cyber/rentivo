import React from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { ListingCard } from '@/components/listing/ListingCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { useWishlistStore } from '@/lib/store/useWishlistStore'

export default function WishlistScreen() {
  const { items } = useWishlistStore()

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="❤️ Saved listings" />

      {items.length === 0 ? (
        <EmptyState
          emoji="❤️"
          title="No saved listings yet"
          subtitle="Browse vehicles and tap the heart to save them here"
          action={{
            label: 'Browse vehicles →',
            onPress: () => router.push('/(consumer)/explore'),
          }}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.columnWrapper}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          renderItem={({ item }) => <ListingCard listing={item} showAvailableBadge />}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  grid: { padding: Spacing.base },
  columnWrapper: { justifyContent: 'space-between' },
})
