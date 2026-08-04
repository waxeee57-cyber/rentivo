import React, { useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { ReviewCard } from '@/components/listing/ReviewCard'
import { Spacing, Fonts } from '@/constants/colors'
import { useReviews } from '@/lib/hooks/useReviews'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { Review } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

export default function AllReviewsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { id } = useLocalSearchParams<{ id: string }>()
  const { language } = useAuthStore()
  const { reviews, loading, error } = useReviews(id ?? '')

  const renderItem = useCallback(
    ({ item }: { item: Review }) => (
      <ReviewCard key={item.id} review={item} userName="Guest" />
    ),
    [],
  )

  const keyExtractor = useCallback((item: Review) => item.id, [])

  const renderEmpty = () => {
    if (loading) return null
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyIcon}>★</Text>
        <Text style={styles.emptyTitle}>{t('noReviewsYet', language)}</Text>
        <Text style={styles.emptySub}>{t('noReviewsYetSub', language)}</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('allReviews', language)} />

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      )}

      {error != null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && error == null && (
        <FlatList
          data={reviews}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  list: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 100,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontFamily: Fonts.regular, fontSize: 14,
    color: C.error,
    textAlign: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    fontFamily: Fonts.regular, fontSize: 40,
    color: C.textTertiary,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: C.textSecondary,
  },
  emptySub: {
    fontFamily: Fonts.regular, fontSize: 14,
    color: C.textTertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  })
}
