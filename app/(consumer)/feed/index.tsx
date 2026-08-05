import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator,
  useWindowDimensions, type ViewToken,
} from 'react-native'
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics'
import { router } from 'expo-router'
import { Fonts, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { useListings } from '@/lib/hooks/useListings'
import { useWishlistStore } from '@/lib/store/useWishlistStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { FeedCard } from '@/components/feed/FeedCard'
import { DensityGrid } from '@/components/feed/DensityGrid'
import { ShortlistTray } from '@/components/feed/ShortlistTray'
import { CompareSheet } from '@/components/feed/CompareSheet'
import { ErrorState } from '@/components/ui/ErrorState'
import { t } from '@/constants/i18n'
import type { Listing } from '@/types'

type Lang = 'en' | 'es' | 'hu'

/**
 * Discover - one space at three densities, not three screens.
 *
 * Renting is four tasks that want opposite interfaces: wonder, gather, decide,
 * commit. A grid alone makes browsing feel like filling in a form; a feed
 * alone feels wonderful and sells nothing, because choosing between four
 * vehicles is a column task that a one-at-a-time surface cannot do.
 *
 * So feed and grid are the SAME items at different densities, and moving
 * between them is a zoom rather than a navigation. Crucially the scroll
 * position maps both ways: tapping a tile returns you to that exact card. That
 * one property is what makes this read as a place instead of a stack of
 * screens, and it is the first thing that quietly breaks if someone later
 * swaps the transition for a router push.
 */

const EASE = Easing.bezier(0.16, 1, 0.3, 1)
const DUR = 460
const DEFAULT_DAYS = 3

export default function FeedScreen() {
  const C = useColors()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const lang: Lang = useAuthStore(s => s.language)

  const { listings, loading, error } = useListings()
  const wishlist = useWishlistStore()

  const [dense, setDense] = useState(false)      // false = feed, true = grid
  const [compare, setCompare] = useState(false)
  const [index, setIndex] = useState(0)
  const feedRef = useRef<FlatList<Listing>>(null)

  const days = DEFAULT_DAYS

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]
    if (first?.index != null) setIndex(first.index)
  }).current
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current

  const feedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dense ? 0 : 1, { duration: DUR, easing: EASE }),
    transform: [{ scale: withTiming(dense ? 0.9 : 1, { duration: DUR, easing: EASE }) }],
  }), [dense])

  const gridStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dense ? 1 : 0, { duration: DUR, easing: EASE }),
    transform: [{ scale: withTiming(dense ? 1 : 1.12, { duration: DUR, easing: EASE }) }],
  }), [dense])

  const toggleDensity = useCallback(() => {
    void impactAsync(ImpactFeedbackStyle.Light)
    setDense(d => !d)
  }, [])

  // Zooming back IN lands on the tile you touched, not at the top of the feed.
  // Losing the position in either direction is what makes a browse surface
  // feel like it punishes you for looking around.
  const openFromGrid = useCallback((listing: Listing) => {
    const i = listings.findIndex(l => l.id === listing.id)
    if (i >= 0) {
      setIndex(i)
      requestAnimationFrame(() => feedRef.current?.scrollToIndex({ index: i, animated: false }))
    }
    setDense(false)
  }, [listings])

  const onToggleSave = useCallback((listing: Listing) => { wishlist.toggle(listing) }, [wishlist])
  const onReserve = useCallback((listing: Listing) => {
    router.push(`/(consumer)/booking/${listing.id}`)
  }, [])
  const onShare = useCallback((listing: Listing) => {
    router.push(`/(consumer)/listing/${listing.id}`)
  }, [])

  const savedIds = useMemo(() => new Set(wishlist.items.map(i => i.id)), [wishlist.items])

  const renderCard = useCallback(({ item, index: i }: { item: Listing; index: number }) => (
    <FeedCard
      listing={item}
      days={days}
      lang={lang}
      saved={savedIds.has(item.id)}
      onToggleSave={onToggleSave}
      onReserve={onReserve}
      onShare={onShare}
      active={Math.abs(i - index) <= 1}
    />
  ), [days, lang, savedIds, onToggleSave, onReserve, onShare, index])

  if (error) {
    return (
      <View style={[styles.fill, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <ErrorState message={error} />
      </View>
    )
  }

  return (
    <View style={[styles.fill, { backgroundColor: C.background }]} testID="feed-screen">
      <Animated.View style={[StyleSheet.absoluteFill, feedStyle]} pointerEvents={dense ? 'none' : 'auto'}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={C.primary} /></View>
        ) : (
          <FlatList
            ref={feedRef}
            data={listings}
            keyExtractor={l => l.id}
            renderItem={renderCard}
            pagingEnabled
            snapToInterval={height}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={2}
            removeClippedSubviews
            onViewableItemsChanged={onViewable}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          />
        )}
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, gridStyle]} pointerEvents={dense ? 'auto' : 'none'}>
        <DensityGrid
          listings={listings}
          lang={lang}
          onOpen={openFromGrid}
          headerHeight={insets.top + 64}
          bottomInset={insets.bottom + 96}
        />
      </Animated.View>

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          /* No `back` key exists and this surface is pushed, not a tab, so
             "Close" is the honest label rather than inventing a 1200th key. */
          accessibilityLabel={t('closeSheet', lang)}
          onPress={() => router.back()}
          style={[styles.round, { borderColor: C.borderStrong }]}
        >
          <Ionicons name="chevron-back" size={19} color={C.text} />
        </Pressable>

        <Pressable
          testID="density-toggle"
          accessibilityRole="button"
          onPress={toggleDensity}
          style={[styles.density, { borderColor: C.borderStrong }]}
        >
          <Ionicons name={dense ? 'albums-outline' : 'grid-outline'} size={14} color={C.text} />
          <Text style={[styles.densityText, { color: C.text }]}>
            {dense ? t('feedFeed', lang) : t('feedGrid', lang)}
          </Text>
        </Pressable>
      </View>

      <ShortlistTray lang={lang} onCompare={() => setCompare(true)} bottomOffset={0} />

      <CompareSheet
        visible={compare}
        onClose={() => setCompare(false)}
        lang={lang}
        days={days}
        onOpen={(l) => { setCompare(false); openFromGrid(l) }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: {
    position: 'absolute', left: 0, right: 0, top: 0,
    paddingHorizontal: 16, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  round: { width: 38, height: 38, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  density: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 13, paddingVertical: 8,
  },
  densityText: { fontFamily: Fonts.bold, fontSize: 12 },
})
