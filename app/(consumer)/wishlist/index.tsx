import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { ListingCard } from '@/components/listing/ListingCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { useWishlistStore, syncWishlistFromSupabase } from '@/lib/store/useWishlistStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'

export default function WishlistScreen() {
  const { items } = useWishlistStore()
  const { language, user } = useAuthStore()
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (user?.id) {
      setSyncing(true)
      void syncWishlistFromSupabase(user.id).finally(() => setSyncing(false))
    }
  }, [user?.id])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={`❤️ ${t('savedListings', language)}`} />

      {syncing && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          emoji="❤️"
          title={t('noSavedListings', language)}
          subtitle={t('wishlistEmptySub', language)}
          action={{
            label: t('browseVehicles', language),
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
  grid: { padding: Spacing.base, paddingBottom: 100 },
  columnWrapper: { justifyContent: 'space-between' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
