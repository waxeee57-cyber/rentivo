import React, { useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'

function RoleCard({
  emoji,
  title,
  desc,
  variant = 'traveler',
  onPress,
}: {
  emoji: string
  title: string
  desc: string
  variant?: 'traveler' | 'host' | 'operator'
  onPress: () => void
}) {
  const scale = useRef(new Animated.Value(1)).current

  const cardStyle = [
    styles.card,
    variant === 'traveler' && styles.cardTraveler,
    variant === 'host'     && styles.cardHost,
    variant === 'operator' && styles.cardOperator,
  ]

  const titleStyle = [styles.cardTitle, variant === 'operator' && styles.cardTitleDark]
  const descStyle  = [styles.cardDesc,  variant === 'operator' && styles.cardDescDark]
  const arrowStyle = [styles.cardArrow, variant === 'operator' && styles.cardArrowDark]

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, damping: 15, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 15, useNativeDriver: true }).start()}
        activeOpacity={1}
      >
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <View style={styles.cardBody}>
          <Text style={titleStyle}>{title}</Text>
          <Text style={descStyle}>{desc}</Text>
        </View>
        <Text style={arrowStyle}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

export default function RoleSelectionScreen() {
  const { setRole } = useAuthStore()

  const handleSelect = (role: 'consumer' | 'operator' | 'host') => {
    setRole(role)
    if (role === 'host') {
      router.push('/auth/host-setup')
    } else if (Config.useMock && role === 'operator') {
      router.replace('/(operator)/dashboard')
    } else {
      router.push('/auth/login')
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A1628', '#0D1F38']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.wave}>🌊</Text>
          <Text style={styles.logo}>Rentivo</Text>
          <Text style={styles.tagline}>Premium rentals across the Mediterranean</Text>
          <View style={styles.trustRow}>
            <Text style={styles.trustBadge}>🔒 Insured</Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustBadge}>⚡ Instant</Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustBadge}>⭐ Verified</Text>
          </View>
        </View>

        {/* Role cards */}
        <View style={styles.cards}>
          <RoleCard
            emoji="🌴"
            title="I want to rent something"
            desc="Cars, boats, bikes and more"
            variant="traveler"
            onPress={() => handleSelect('consumer')}
          />
          <RoleCard
            emoji="🏠"
            title="I own something to rent"
            desc="List your vehicle, earn money"
            variant="host"
            onPress={() => handleSelect('host')}
          />
          <RoleCard
            emoji="🏢"
            title="I run a rental business"
            desc="Fleet management, bookings"
            variant="operator"
            onPress={() => handleSelect('operator')}
          />
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          By continuing you agree to our Terms · Privacy
        </Text>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl,
  },

  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
  },
  wave: {
    fontSize: 40,
    marginBottom: Spacing.md,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -1,
    marginBottom: Spacing.sm,
  },
  tagline: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  trustBadge: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  trustDot: {
    color: Colors.textTertiary,
  },

  cards: {
    gap: Spacing.md,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 76,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  cardTraveler: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    borderTopColor: Colors.border,
    borderRightColor: Colors.border,
    borderBottomColor: Colors.border,
  },
  cardHost: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.white,
    borderTopColor: Colors.border,
    borderRightColor: Colors.border,
    borderBottomColor: Colors.border,
  },
  cardOperator: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  cardEmoji: { fontSize: 32 },
  cardBody: { flex: 1 },
  cardTitle: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: 2,
  },
  cardTitleDark: { color: Colors.textInverse },
  cardDesc: {
    ...Typography.bodyS,
    color: Colors.textSecondary,
  },
  cardDescDark: { color: 'rgba(10,22,40,0.65)' },
  cardArrow: {
    fontSize: 22,
    color: Colors.textTertiary,
    fontWeight: '300',
  },
  cardArrowDark: { color: Colors.textInverse },

  footer: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
})
