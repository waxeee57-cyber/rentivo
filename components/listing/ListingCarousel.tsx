import React, { useState, useRef, useMemo } from 'react'
import { View, ScrollView, Dimensions, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Radius, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

const { width } = Dimensions.get('window')

interface ListingCarouselProps {
  images: string[]
  height?: number
}

export function ListingCarousel({ images, height = 300 }: ListingCarouselProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  const onScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width)
    setCurrentIndex(index)
  }

  const hasImages = images.length > 0

  return (
    <View style={{ height }}>
      {hasImages ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {images.map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={{ width, height }}
              contentFit="cover"
            />
          ))}
        </ScrollView>
      ) : (
        <View style={[{ width, height }, styles.placeholder]}>
          <Text style={styles.placeholderText}>🚗</Text>
        </View>
      )}

      {hasImages && images.length > 1 && (
        <>
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterText}>{currentIndex + 1}/{images.length}</Text>
          </View>
        </>
      )}
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  placeholder: {
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 60 },
  dots: {
    position: 'absolute',
    bottom: Spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.overlayLight,
  },
  dotActive: { backgroundColor: C.surface, width: 18 },
  counter: {
    position: 'absolute',
    top: Spacing.base,
    right: Spacing.base,
    backgroundColor: C.overlay,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  counterText: { color: C.textInverse, fontSize: 12, fontWeight: '600' },
  })
}
