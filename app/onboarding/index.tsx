import React, { useRef, useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Typography, Shadow, Fonts } from '@/constants/colors'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'

const { width, height } = Dimensions.get('window')

const SLIDES: {
  id: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  titleKey: string
  subtitleKey: string
  gradient: [string, string]
}[] = [
  {
    id: '1',
    icon: 'boat-outline',
    titleKey: 'auth2Slide1Title',
    subtitleKey: 'auth2Slide1Subtitle',
    gradient: ['#0A1628', '#0D1F38'],
  },
  {
    id: '2',
    icon: 'document-text-outline',
    titleKey: 'auth2Slide2Title',
    subtitleKey: 'auth2Slide2Subtitle',
    gradient: ['#0A1628', '#091520'],
  },
  {
    id: '3',
    icon: 'flash-outline',
    titleKey: 'auth2Slide3Title',
    subtitleKey: 'auth2Slide3Subtitle',
    gradient: ['#0A1628', '#12150A'],
  },
]

async function markOnboardingDone() {
  await AsyncStorage.setItem('onboarding_seen', 'true')
}

export default function OnboardingScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language } = useAuthStore()
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
                <Ionicons name={item.icon} size={64} color={C.primary} importantForAccessibility="no" />
              </View>
              <Text style={styles.title}>{t(item.titleKey as TranslationKey, language)}</Text>
              <Text style={styles.subtitle}>{t(item.subtitleKey as TranslationKey, language)}</Text>

              {/* Trust badges on slide 1 */}
              {item.id === '1' && (
                <View style={styles.trustBadges}>
                  {([
                    { icon: 'lock-closed', label: t('auth2TrustInsured', language) },
                    { icon: 'flash', label: t('auth2TrustInstant', language) },
                    { icon: 'checkmark-circle', label: t('auth2TrustVerified', language) },
                  ] as const).map(badge => (
                    <View key={badge.label} style={styles.trustBadge}>
                      <Ionicons name={badge.icon} size={12} color={C.primary} importantForAccessibility="no" />
                      <Text style={styles.trustBadgeText}>{badge.label}</Text>
                    </View>
                  ))}
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
          accessibilityLabel={isLast
            ? t('auth2GetStarted', language)
            : t('auth2NextSlide', language)}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>
            {isLast
              ? `${t('auth2GetStarted', language)} →`
              : t('nextStep', language)}
          </Text>
        </TouchableOpacity>

        {!isLast && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            accessibilityLabel={t('auth2SignInExisting', language)}
            accessibilityRole="button"
          >
            <Text style={styles.skipBtnText}>{t('auth2SignIn', language)}</Text>
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
    borderColor: C.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(232,164,74,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  trustBadgeText: {
    fontSize: 13,
    color: C.primary,
    fontFamily: Fonts.semibold,
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
    ...Shadow.accent,
  },
  primaryBtnText: {
    ...Typography.h4,
    color: C.textInverse,
  },
  skipBtn: { paddingVertical: Spacing.sm, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  skipBtnText: {
    fontSize: 15,
    color: C.textSecondary,
    fontFamily: Fonts.medium,
  },
  })
}
