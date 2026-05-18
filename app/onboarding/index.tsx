import React, { useRef, useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { Spacing, Radius, Typography, Shadow } from '@/constants/colors'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'

const { width, height } = Dimensions.get('window')

const SLIDES = [
  {
    id: '1',
    emoji: '🌊',
    title: 'Rent anything in\nthe Mediterranean',
    subtitle: 'Cars, bikes, yachts — from verified local operators',
    gradient: ['#0A1628', '#0D1F38'] as [string, string],
  },
  {
    id: '2',
    emoji: '📋',
    title: 'Digital contracts &\ndamage protection',
    subtitle: 'Every rental is covered. Photos, signatures, zero disputes.',
    gradient: ['#0A1628', '#091520'] as [string, string],
  },
  {
    id: '3',
    emoji: '⚡',
    title: 'Live in 48 hours if\nyou\'re an operator',
    subtitle: 'List your fleet and start accepting bookings today',
    gradient: ['#0A1628', '#12150A'] as [string, string],
  },
]

async function markOnboardingDone() {
  await AsyncStorage.setItem('onboarding_seen', 'true')
}

export default function OnboardingScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<FlatList>(null)
  const scrollX = useRef(new Animated.Value(0)).current

  const handleNext = async () => {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true })
    } else {
      await markOnboardingDone()
      if (Config.useMock) {
        router.replace('/(consumer)/explore')
      } else {
        router.replace('/auth')
      }
    }
  }

  const handleSkip = async () => {
    await markOnboardingDone()
    if (Config.useMock) {
      router.replace('/(consumer)/explore')
    } else {
      router.replace('/auth')
    }
  }

  const isLast = activeIndex === SLIDES.length - 1

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={e => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width)
          setActiveIndex(index)
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <LinearGradient
              colors={item.gradient}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.slideContent}>
              <View style={styles.emojiCircle}>
                <Text style={styles.emoji}>{item.emoji}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>

              {/* Trust badges on slide 1 */}
              {item.id === '1' && (
                <View style={styles.trustBadges}>
                  <View style={styles.trustBadge}>
                    <Text style={styles.trustBadgeText}>🔒 Insured</Text>
                  </View>
                  <View style={styles.trustBadge}>
                    <Text style={styles.trustBadgeText}>⚡ Instant</Text>
                  </View>
                  <View style={styles.trustBadge}>
                    <Text style={styles.trustBadgeText}>⭐ Verified</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      />

      {/* Controls */}
      <View style={styles.controls}>
        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [8, 28, 8],
              extrapolate: 'clamp',
            })
            const dotOpacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            })
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
              />
            )
          })}
        </View>

        {/* Primary button */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleNext}
          accessibilityLabel={isLast ? 'Get started' : 'Next slide'}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>
            {isLast ? 'Get started →' : 'Next →'}
          </Text>
        </TouchableOpacity>

        {!isLast && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            accessibilityLabel="Sign in to existing account"
            accessibilityRole="button"
          >
            <Text style={styles.skipBtnText}>Sign in</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  slide: {
    width,
    height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideContent: {
    paddingHorizontal: Spacing.xxxl,
    alignItems: 'center',
    paddingBottom: 220,
  },
  emojiCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(232,164,74,0.12)',
    borderWidth: 1,
    borderColor: C.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  emoji: { fontSize: 64 },
  title: {
    ...Typography.h1,
    color: C.white,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  subtitle: {
    ...Typography.body,
    color: 'rgba(245,240,232,0.7)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  trustBadges: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  trustBadge: {
    backgroundColor: 'rgba(232,164,74,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.borderGold,
  },
  trustBadgeText: {
    fontSize: 13,
    color: C.primary,
    fontWeight: '600',
  },

  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 52,
    alignItems: 'center',
    gap: Spacing.md,
  },
  dots: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: C.primary,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: C.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...Shadow.gold,
  },
  primaryBtnText: {
    ...Typography.h4,
    color: C.textInverse,
  },
  skipBtn: { paddingVertical: Spacing.sm, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  skipBtnText: {
    fontSize: 15,
    color: C.textSecondary,
    fontWeight: '500',
  },
  })
}
