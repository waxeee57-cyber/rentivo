import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Animated, ScrollView, AccessibilityInfo,
} from 'react-native'
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, type SharedValue,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Image as ExpoImage } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import type { UserRole } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

const { width } = Dimensions.get('window')

interface OnboardingFlowProps {
  onComplete: (role?: UserRole) => void
}

// The intro used to be ONE photo: a top-of-range villa. The catalogue actually
// runs from ~€25/day to ~€350/day, so a single luxury frame made price-sensitive
// users self-select out before reading the tagline — and it contradicted the
// "Cars · Boats · Bikes · Villas" line sitting right under it. These slides span
// the catalogue so the first screen SHOWS the range it claims.
//
// Slide 0 is the bundled asset on purpose: it paints instantly and offline, so a
// cold network can never produce a blank first impression. The remote slides are
// catalogue photo URLs (the beach hatchback is the VW Golf straight out of
// lib/mockData.ts); the two-wheeler and the sailboat are remote URLs because the
// repo ships no photo of either and this change may not add binaries. The boat
// is a modest sailboat rather than a superyacht for the same reason the villa
// alone was the problem.
const HERO_SLIDES = [
  require('@/assets/images/onboarding-hero.jpg'),
  { uri: 'https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=1200' },
  { uri: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200' },
  { uri: 'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=1200' },
]

// Same blurhash the listing feed uses — a neutral dark blur that sits invisibly
// under the hero scrim while a remote slide decodes.
const HERO_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4'
const HERO_FADE_MS = 600
const HERO_DWELL_MS = 3500

const AnimatedHeroImage = Reanimated.createAnimatedComponent(ExpoImage)

function HeroSlide({ index, active }: { index: number; active: SharedValue<number> }) {
  const layerStyle = useAnimatedStyle(() => ({
    // Cross-fade, never slide: only opacity moves, so the frames dissolve into
    // one another instead of the hero lurching sideways behind fixed copy.
    opacity: withTiming(active.value === index ? 1 : 0, { duration: HERO_FADE_MS }),
  }))

  return (
    <AnimatedHeroImage
      source={HERO_SLIDES[index]}
      style={[StyleSheet.absoluteFill, layerStyle]}
      contentFit="cover"
      transition={HERO_FADE_MS}
      placeholder={{ blurhash: HERO_BLURHASH }}
      cachePolicy="memory-disk"
      importantForAccessibility="no"
    />
  )
}

function HeroRotation() {
  // null = not yet known. We render the bundled frame alone until the async
  // reduce-motion answer lands, which is also the right cold-start behaviour.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null)
  const active = useSharedValue(0)

  useEffect(() => {
    let cancelled = false
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (!cancelled) setReduceMotion(enabled)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (reduceMotion !== false) return
    const id = setInterval(() => {
      active.value = (active.value + 1) % HERO_SLIDES.length
    }, HERO_DWELL_MS)
    // Onboarding unmounts the moment the user taps through — leaving this timer
    // running would keep mutating a shared value on a dead tree.
    return () => clearInterval(id)
  }, [reduceMotion, active])

  // Reduce motion on: one static frame, no timer, no animated layers at all.
  if (reduceMotion !== false) {
    return (
      <ExpoImage
        source={HERO_SLIDES[0]}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        importantForAccessibility="no"
      />
    )
  }

  // One absolutely-positioned layer per slide rather than two layers whose
  // sources get swapped: swapping means re-pointing a layer's source in the same
  // commit that resets its opacity, and any frame where those two land out of
  // step flashes the previous photo. Four cached layers cost nothing here and
  // the cross-fade is exact.
  return (
    <View style={StyleSheet.absoluteFill}>
      {HERO_SLIDES.map((_, i) => (
        <HeroSlide key={i} index={i} active={active} />
      ))}
    </View>
  )
}

function HeroMark() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const float = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -10, duration: 1800, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return (
    <Animated.View style={[styles.heroMark, { transform: [{ translateY: float }] }]}>
      <Ionicons name="boat" size={36} color={C.primary} />
    </Animated.View>
  )
}

function Screen1({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.screen}>
      {/* Full-bleed photography — the marketplace opens on the dream, not on a
          gradient. Now a cross-fading rotation instead of one villa, so the
          catalogue's whole range is the first thing a new user sees. */}
      <HeroRotation />
      <LinearGradient
        // The hero now ROTATES through the catalogue, so this scrim can no longer
        // be tuned to one photo. It has to hold white text at AA on the brightest
        // frame in the set (the sunset motorcycle shot, which is far lighter than
        // the original villa). Deeper and earlier: 0.62 where the headline sits
        // keeps #FFFFFF above 4.5:1 even over pale sky, and the near-opaque foot
        // carries the Skip link, which was the weakest element on every frame.
        colors={['rgba(6,12,24,0.34)', 'rgba(6,12,24,0.62)', 'rgba(6,12,24,0.94)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.screenContent, styles.photoContent]}>
          <Text style={[styles.heroTitle, styles.heroTitleOnPhoto]}>Rent anything.</Text>
          <Text style={[styles.heroSubtitle, styles.heroSubtitleOnPhoto]}>Anywhere in the Mediterranean.</Text>
          <Text style={[styles.heroCats, styles.heroCatsOnPhoto]}>Cars · Boats · Bikes · Villas</Text>
        </View>
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              onNext()
            }}
          >
            <Text style={styles.primaryBtnText}>Get started →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
            <Text style={[styles.skipBtnText, styles.skipBtnTextOnPhoto]}>Skip</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

const HOW_STEPS: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; desc: string }[] = [
  { icon: 'search-outline', label: 'Search', desc: 'Find what you need' },
  { icon: 'flash-outline', label: 'Book', desc: 'Pay securely in minutes' },
  { icon: 'key-outline', label: 'Go', desc: 'Pick up and enjoy' },
]

function Screen2({ onNext }: { onNext: () => void }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const anims = useRef(HOW_STEPS.map(() => new Animated.Value(0))).current

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: i * 350,
        useNativeDriver: true,
      })
    )
    Animated.stagger(350, animations).start()
  }, [])

  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screenContent}>
          <Text style={styles.howTitle}>How it works</Text>
          <View style={styles.howSteps}>
            {HOW_STEPS.map((step, i) => (
              <Animated.View
                key={step.label}
                style={[
                  styles.howStep,
                  {
                    opacity: anims[i],
                    transform: [{
                      translateX: anims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [-30, 0],
                      }),
                    }],
                  },
                ]}
              >
                <View style={styles.howStepIconWrap}>
                  <Ionicons name={step.icon} size={22} color={C.primary} />
                </View>
                <View style={styles.howStepText}>
                  <Text style={styles.howStepLabel}>{step.label}</Text>
                  <Text style={styles.howStepDesc}>{step.desc}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </View>
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onNext()
            }}
          >
            <Text style={styles.primaryBtnText}>Next →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

const ROLE_OPTIONS: {
  role: UserRole;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string
}[] = [
  {
    role: 'consumer',
    icon: 'car-sport-outline',
    title: 'I want to rent something',
    subtitle: 'Browse cars, boats, bikes & more',
  },
  {
    role: 'host',
    icon: 'home-outline',
    title: 'I own something to rent',
    subtitle: 'Earn money as a private host',
  },
  {
    role: 'operator',
    icon: 'business-outline',
    title: 'I run a rental business',
    subtitle: 'Manage your fleet professionally',
  },
]

function Screen3({ onSelectRole }: { onSelectRole: (role: UserRole) => void }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.roleTitle}>How will you use{'\n'}Rentivo?</Text>
          <View style={styles.roleCards}>
            {ROLE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.role}
                style={styles.roleCard}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  onSelectRole(opt.role)
                }}
                activeOpacity={0.85}
              >
                <View style={styles.roleCardIconWrap}>
                  <Ionicons name={opt.icon} size={22} color={C.primary} />
                </View>
                <View style={styles.roleCardText}>
                  <Text style={styles.roleCardTitle}>{opt.title}</Text>
                  <Text style={styles.roleCardSub}>{opt.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [screen, setScreen] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current

  // Mount ONLY the active screen (fade transition) instead of a translateX
  // slider with all three screens mounted side-by-side. Two wins:
  //  1. Native-driver transforms don't update the accessibility/view-hierarchy
  //     bounds, so E2E tools (Maestro) kept "seeing" the off-screen pages at
  //     their original positions and visibility checks never converged.
  //  2. Two fewer mounted screens (and their entry animations) at any time.
  const goToScreen = (n: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setScreen(n)
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start()
    })
  }

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.slider, { opacity: fadeAnim }]}>
        {screen === 0 && (
          <View style={{ width }}>
            <Screen1
              onNext={() => goToScreen(1)}
              onSkip={() => onComplete()}
            />
          </View>
        )}
        {screen === 1 && (
          <View style={{ width }}>
            <Screen2 onNext={() => goToScreen(2)} />
          </View>
        )}
        {screen === 2 && (
          <View style={{ width }}>
            <Screen3 onSelectRole={(role) => onComplete(role)} />
          </View>
        )}
      </Animated.View>

      {/* Dots */}
      <View style={styles.dots}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={[styles.dot, screen === i && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
    overflow: 'hidden',
  },
  slider: {
    flexDirection: 'row',
    flex: 1,
  },
  screen: {
    width,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl,
  },

  heroMark: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.primarySurface,
    borderWidth: 1,
    borderColor: C.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  heroTitle: {
    fontSize: 42,
    fontFamily: Fonts.extrabold,
    color: C.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontFamily: Fonts.regular, fontSize: 20,
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  heroCats: {
    fontSize: 15,
    color: C.primary,
    fontFamily: Fonts.semibold,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  // On-photo variants — fixed light ink over the scrimmed hero image,
  // pushed to the lower third where the scrim is strongest.
  photoContent: { justifyContent: 'flex-end', paddingBottom: Spacing.xl },
  heroTitleOnPhoto: { color: '#FFFFFF', textAlign: 'left', alignSelf: 'stretch' },
  heroSubtitleOnPhoto: { color: 'rgba(255,255,255,0.85)', textAlign: 'left', alignSelf: 'stretch' },
  heroCatsOnPhoto: { color: '#F0B15C', textAlign: 'left', alignSelf: 'stretch' },
  // Was 0.75 alpha — the lowest-contrast interactive element in the app, and the
  // only escape hatch on the first screen. Opaque white over the 0.94 scrim foot.
  skipBtnTextOnPhoto: { color: '#FFFFFF' },

  howTitle: {
    fontSize: 30,
    fontFamily: Fonts.extrabold,
    color: C.text,
    textAlign: 'center',
    marginBottom: Spacing.xxxl,
  },
  howSteps: {
    width: '100%',
    gap: Spacing.xl,
  },
  howStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
  },
  howStepIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepEmoji: { fontFamily: Fonts.regular, fontSize: 28 },
  howStepText: { flex: 1 },
  howStepLabel: {
    fontSize: 18,
    fontFamily: Fonts.extrabold,
    color: C.text,
    marginBottom: 2,
  },
  howStepDesc: {
    fontFamily: Fonts.regular, fontSize: 14,
    color: C.textSecondary,
  },

  roleTitle: {
    fontSize: 30,
    fontFamily: Fonts.extrabold,
    color: C.text,
    textAlign: 'center',
    marginBottom: Spacing.xxxl,
    paddingTop: Spacing.xl,
  },
  roleCards: {
    width: '100%',
    gap: Spacing.md,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 80,
  },
  roleCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardEmoji: { fontFamily: Fonts.regular, fontSize: 36, width: 48, textAlign: 'center' },
  roleCardText: { flex: 1 },
  roleCardTitle: {
    fontSize: 16,
    fontFamily: Fonts.extrabold,
    color: C.text,
    marginBottom: 2,
  },
  roleCardSub: {
    fontFamily: Fonts.regular, fontSize: 13,
    color: C.textSecondary,
  },
  roleCardArrow: {
    fontSize: 24,
    color: C.textTertiary,
    fontFamily: Fonts.regular,
  },

  bottomActions: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: Fonts.extrabold,
    color: C.textInverse,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipBtnText: {
    fontSize: 14,
    color: C.textTertiary,
    fontFamily: Fonts.medium,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 32,
    paddingTop: 8,
    backgroundColor: C.background,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: C.primary,
  },
  })
}
