import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Animated, ScrollView,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import type { UserRole } from '@/types'

const { width } = Dimensions.get('window')

interface OnboardingFlowProps {
  onComplete: (role?: UserRole) => void
}

function WaveEmoji() {
  const float = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -12, duration: 1800, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return (
    <Animated.Text style={[styles.heroEmoji, { transform: [{ translateY: float }] }]}>
      🌊
    </Animated.Text>
  )
}

function Screen1({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <LinearGradient
      colors={[Colors.background, Colors.surfaceWarm, Colors.background]}
      style={styles.screen}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screenContent}>
          <WaveEmoji />
          <Text style={styles.heroTitle}>Rent anything.</Text>
          <Text style={styles.heroSubtitle}>Anywhere in the Mediterranean.</Text>
          <Text style={styles.heroCats}>Cars · Boats · Bikes · Villas</Text>
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
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}

const HOW_STEPS = [
  { emoji: '🔍', label: 'Search', desc: 'Find what you need' },
  { emoji: '⚡', label: 'Book', desc: 'Pay securely in minutes' },
  { emoji: '🗝️', label: 'Go', desc: 'Pick up and enjoy' },
]

function Screen2({ onNext }: { onNext: () => void }) {
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
    <View style={[styles.screen, { backgroundColor: Colors.background }]}>
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
                  <Text style={styles.howStepEmoji}>{step.emoji}</Text>
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
  emoji: string;
  title: string;
  subtitle: string
}[] = [
  {
    role: 'consumer',
    emoji: '🌴',
    title: 'I want to rent something',
    subtitle: 'Browse cars, boats, bikes & more',
  },
  {
    role: 'host',
    emoji: '🏠',
    title: 'I own something to rent',
    subtitle: 'Earn money as a private host',
  },
  {
    role: 'operator',
    emoji: '🏢',
    title: 'I run a rental business',
    subtitle: 'Manage your fleet professionally',
  },
]

function Screen3({ onSelectRole }: { onSelectRole: (role: UserRole) => void }) {
  return (
    <View style={[styles.screen, { backgroundColor: Colors.background }]}>
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
                <Text style={styles.roleCardEmoji}>{opt.emoji}</Text>
                <View style={styles.roleCardText}>
                  <Text style={styles.roleCardTitle}>{opt.title}</Text>
                  <Text style={styles.roleCardSub}>{opt.subtitle}</Text>
                </View>
                <Text style={styles.roleCardArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [screen, setScreen] = useState(0)
  const slideAnim = useRef(new Animated.Value(0)).current

  const goToScreen = (n: number) => {
    Animated.timing(slideAnim, {
      toValue: -n * width,
      duration: 320,
      useNativeDriver: true,
    }).start(() => setScreen(n))
  }

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.slider,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        <View style={{ width }}>
          <Screen1
            onNext={() => goToScreen(1)}
            onSkip={() => onComplete()}
          />
        </View>
        <View style={{ width }}>
          <Screen2 onNext={() => goToScreen(2)} />
        </View>
        <View style={{ width }}>
          <Screen3 onSelectRole={(role) => onComplete(role)} />
        </View>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
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

  heroEmoji: { fontSize: 80, marginBottom: Spacing.xl },
  heroTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontSize: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  heroCats: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  howTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.text,
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  howStepIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepEmoji: { fontSize: 28 },
  howStepText: { flex: 1 },
  howStepLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  howStepDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  roleTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.text,
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
  },
  roleCardEmoji: { fontSize: 36, width: 48, textAlign: 'center' },
  roleCardText: { flex: 1 },
  roleCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  roleCardSub: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  roleCardArrow: {
    fontSize: 24,
    color: Colors.textTertiary,
    fontWeight: '300',
  },

  bottomActions: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textInverse,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipBtnText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 32,
    paddingTop: 8,
    backgroundColor: Colors.background,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: Colors.primary,
  },
})
