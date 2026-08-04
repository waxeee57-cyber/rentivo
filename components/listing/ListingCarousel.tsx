import React, { useState, useRef, useMemo, useCallback } from 'react'
import { View, ScrollView, Text, StyleSheet, useWindowDimensions } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  interpolate, interpolateColor, runOnJS, Extrapolation,
  type SharedValue,
} from 'react-native-reanimated'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Radius, Spacing, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import {
  IMAGE_PLACEHOLDER, IMAGE_TRANSITION_HERO, IMAGE_CACHE_POLICY,
} from '@/components/ui/imagePlaceholder'

const DOT_SIZE = 6
const DOT_ACTIVE_WIDTH = 18

interface ListingCarouselProps {
  images: string[]
  height?: number
}

/**
 * One pagination dot. Its width/opacity/colour are driven straight off the
 * scroll offset, so the active pill GROWS as you swipe instead of snapping
 * between two static Views the moment `currentIndex` state catches up.
 */
function PaginationDot({
  index, scrollX, pageWidth, inactiveColor, activeColor,
}: {
  index: number
  scrollX: SharedValue<number>
  pageWidth: number
  inactiveColor: string
  activeColor: string
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * pageWidth, index * pageWidth, (index + 1) * pageWidth]
    return {
      width: interpolate(scrollX.value, input, [DOT_SIZE, DOT_ACTIVE_WIDTH, DOT_SIZE], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, input, [0.55, 1, 0.55], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(scrollX.value, input, [inactiveColor, activeColor, inactiveColor]),
    }
  })

  return <Animated.View style={[styles.dot, animatedStyle]} />
}

export function ListingCarousel({ images, height = 300 }: ListingCarouselProps) {
  const C = useColors()
  const themed = useMemo(() => makeStyles(C), [C])
  // Read live rather than at module scope so a rotation re-pages the carousel
  // instead of leaving every slide offset by the old screen width.
  const { width } = useWindowDimensions()
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollRef = useRef<Animated.ScrollView>(null)

  const scrollX = useSharedValue(0)
  // Mirrors currentIndex on the UI thread so we only hop to JS when the page
  // actually changes, not on all ~60 scroll events per second.
  const lastIndex = useSharedValue(0)

  const scrollHandler = useAnimatedScrollHandler(e => {
    scrollX.value = e.contentOffset.x
    const index = Math.round(e.contentOffset.x / width)
    if (index !== lastIndex.value) {
      lastIndex.value = index
      runOnJS(setCurrentIndex)(index)
    }
  })

  const total = images.length
  const hasImages = total > 0

  const imageLabel = useCallback(
    (i: number) => `Photo ${i + 1} of ${total}`,
    [total],
  )

  return (
    <View style={{ height }}>
      {hasImages ? (
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {images.map((uri, i) => (
            <Image
              key={uri || i}
              source={{ uri }}
              style={{ width, height }}
              contentFit="cover"
              // Slightly longer than the 250ms used on cards: this is a
              // full-bleed hero, and a fast fade at that size reads as a flash.
              transition={IMAGE_TRANSITION_HERO}
              placeholder={IMAGE_PLACEHOLDER}
              cachePolicy={IMAGE_CACHE_POLICY}
              recyclingKey={uri}
              // Only the first frame is above the fold — giving every slide
              // high priority would just make them compete with each other.
              priority={i === 0 ? 'high' : 'normal'}
              accessible
              accessibilityLabel={imageLabel(i)}
            />
          ))}
        </Animated.ScrollView>
      ) : (
        <View style={[{ width, height }, themed.placeholder]}>
          <Ionicons name="car-sport-outline" size={60} color={C.textTertiary} importantForAccessibility="no" />
        </View>
      )}

      {hasImages && total > 1 && (
        <>
          {/* Decorative: the counter below already states the position, and
              each image carries its own "Photo N of M" label. */}
          <View
            style={styles.dots}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {images.map((uri, i) => (
              <PaginationDot
                key={uri || i}
                index={i}
                scrollX={scrollX}
                pageWidth={width}
                inactiveColor={C.overlayLight}
                activeColor={C.surface}
              />
            ))}
          </View>
          <View style={themed.counter}>
            <Text style={themed.counterText}>{currentIndex + 1}/{total}</Text>
          </View>
        </>
      )}
    </View>
  )
}

// Theme-independent geometry: kept at module scope so PaginationDot can use it
// without threading a themed StyleSheet down. Colour comes from props.
const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: Spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
})

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  placeholder: {
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontFamily: Fonts.regular, fontSize: 60 },
  counter: {
    position: 'absolute',
    top: Spacing.base,
    right: Spacing.base,
    backgroundColor: C.overlay,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  counterText: { color: C.textInverse, fontSize: 12, fontFamily: Fonts.semibold },
  })
}
