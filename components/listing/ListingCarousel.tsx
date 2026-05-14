import React, { useState, useRef } from 'react'
import { View, ScrollView, Dimensions, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Colors, Radius, Spacing } from '@/constants/colors'

const { width } = Dimensions.get('window')

interface ListingCarouselProps {
  images: string[]
  height?: number
}

export function ListingCarousel({ images, height = 300 }: ListingCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  const onScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width)
    setCurrentIndex(index)
  }

  const imgs = images.length > 0 ? images : ['https://via.placeholder.com/800x500/F5F3EF/A0A0A0?text=No+Image']

  return (
    <View style={{ height }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {imgs.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={{ width, height }}
            contentFit="cover"
          />
        ))}
      </ScrollView>

      {imgs.length > 1 && (
        <>
          <View style={styles.dots}>
            {imgs.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterText}>{currentIndex + 1}/{imgs.length}</Text>
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
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
    backgroundColor: Colors.overlayLight,
  },
  dotActive: { backgroundColor: Colors.surface, width: 18 },
  counter: {
    position: 'absolute',
    top: Spacing.base,
    right: Spacing.base,
    backgroundColor: Colors.overlay,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  counterText: { color: Colors.textInverse, fontSize: 12, fontWeight: '600' },
})
