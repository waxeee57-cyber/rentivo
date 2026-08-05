import React, { useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, Pressable, type LayoutChangeEvent,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Fonts, Radius, Spacing, Shadow } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { useWishlistStore } from '@/lib/store/useWishlistStore'
import { t } from '@/constants/i18n'

type Lang = 'en' | 'es' | 'hu'

/**
 * The shortlist as a permanent EDGE of the screen, never a place you navigate to.
 *
 * Saving is only worth something if the saved pile stays in peripheral vision
 * while you keep browsing. A wishlist tab means abandoning the feed to find out
 * what you already liked, and nobody does that mid-scroll — so the pile grows
 * out of the bottom of whatever you are already looking at.
 *
 * It subscribes to the wishlist store itself instead of taking items as a prop:
 * every heart in the app writes to that one store, and threading the list down
 * through the feed screen is how the two copies start to disagree.
 */

const MAX_THUMBS = 4

// Ease-out, no spring. A spring would overshoot past the tab bar and bounce a
// piece of chrome, which reads as a glitch rather than as feedback — the tray
// is not something the user flicked, it is something that arrived.
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1)

// Only used until the first layout pass reports the real height; it just has to
// be tall enough that the tray starts fully off-screen.
const PARK_FALLBACK = 160

export interface ShortlistTrayProps {
  lang: Lang
  onCompare: () => void
  /** Height of the tab bar (or whatever else) the tray has to clear. */
  bottomOffset?: number
}

function ShortlistTrayImpl({ lang, onCompare, bottomOffset = 0 }: ShortlistTrayProps) {
  const C = useColors()
  const insets = useSafeAreaInsets()
  const items = useWishlistStore(s => s.items)
  const count = items.length

  const gap = bottomOffset + insets.bottom
  const shown = useSharedValue(0)
  const park = useSharedValue(PARK_FALLBACK)

  useEffect(() => {
    shown.value = withTiming(count > 0 ? 1 : 0, { duration: 340, easing: EASE_OUT })
  }, [count, shown])

  // Measured rather than assumed: the bar's height moves with the user's font
  // scale, and a hardcoded park distance leaves a sliver of it showing at large
  // text sizes — the one setting where a stray sliver is most obvious.
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    park.value = e.nativeEvent.layout.height + gap
  }, [gap, park])

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - shown.value) * park.value }],
  }))

  const thumbs = items.slice(0, MAX_THUMBS)

  return (
    <Animated.View
      testID="shortlist-tray"
      onLayout={onLayout}
      style={[styles.wrap, { bottom: gap }, slide]}
      // Parked off-screen it is still mounted and still laid out, so without
      // this it goes on swallowing taps along the bottom edge of the feed and
      // goes on announcing itself to a screen reader from nowhere.
      pointerEvents={count > 0 ? 'box-none' : 'none'}
      accessibilityElementsHidden={count === 0}
      importantForAccessibility={count === 0 ? 'no-hide-descendants' : 'auto'}
    >
      <View style={[styles.bar, { backgroundColor: C.surface, borderColor: C.border }, Shadow.md]}>
        <View style={styles.stack}>
          {thumbs.map((listing, i) => {
            const uri = listing.cover_image_url ?? listing.images?.[0] ?? null
            return (
              <View
                key={listing.id}
                style={[styles.thumb, {
                  borderColor: C.surface,
                  backgroundColor: C.surfaceWarm,
                  // Negative inset from the second tile on, and the first one
                  // painted on top: a left-over-right fan reads as one pile,
                  // where an evenly spaced row would read as four buttons.
                  marginLeft: i === 0 ? 0 : -10,
                  zIndex: MAX_THUMBS - i,
                }]}
              >
                {/* A listing with no photo still holds its slot, so the pile
                    always agrees with the number printed next to it. */}
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={styles.thumbImage}
                    contentFit="cover"
                    transition={160}
                    recyclingKey={listing.id}
                  />
                ) : null}
              </View>
            )
          })}
        </View>

        <Text style={[styles.count, { color: C.text }]} numberOfLines={1}>
          {t('feedShortlistedN', lang, { n: count })}
        </Text>

        <Pressable
          testID="shortlist-compare"
          accessibilityRole="button"
          onPress={onCompare}
          style={({ pressed }) => [styles.compare, {
            backgroundColor: pressed ? C.primaryDark : C.primary,
          }]}
        >
          <Text style={[styles.compareText, { color: C.textInverse }]} numberOfLines={1}>
            {t('feedCompare', lang)}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: Spacing.md },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 1, borderRadius: Radius.full,
    paddingLeft: Spacing.md, paddingRight: Spacing.xs, paddingVertical: Spacing.xs + 2,
  },
  stack: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 34, height: 34, borderRadius: Radius.sm, borderWidth: 1.5, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  count: { fontFamily: Fonts.bold, fontSize: 13.5, flex: 1 },
  compare: { borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: 11 },
  compareText: { fontFamily: Fonts.extrabold, fontSize: 13.5 },
})

// The feed screen above this re-renders on every card change; the tray's only
// real input is the store it subscribes to itself.
export const ShortlistTray = React.memo(ShortlistTrayImpl)
