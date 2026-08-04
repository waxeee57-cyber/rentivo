import React, { useRef, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Spacing, Radius, Typography, Shadow, Fonts } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'

// This screen sits on a FIXED navy gradient (not theme-reactive), so hero
// accents use fixed values from the dark palette.
const HERO_AMBER = '#F0B15C'
const HERO_AMBER_TINT = 'rgba(240,177,92,0.14)'
const HERO_AMBER_BORDER = 'rgba(240,177,92,0.35)'

function RoleCard({
  icon,
  title,
  desc,
  variant = 'traveler',
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  title: string
  desc: string
  variant?: 'traveler' | 'host' | 'operator'
  onPress: () => void
}) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const scale = useRef(new Animated.Value(1)).current

  const cardStyle = [
    styles.card,
    variant === 'operator' && styles.cardOperator,
  ]

  const titleStyle = [styles.cardTitle, variant === 'operator' && styles.cardTitleOnTint]
  const descStyle  = [styles.cardDesc,  variant === 'operator' && styles.cardDescOnTint]

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, damping: 15, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 15, useNativeDriver: true }).start()}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <View style={[styles.cardIconCircle, variant === 'operator' && styles.cardIconCircleOnTint]}>
          <Ionicons name={icon} size={22} color={variant === 'operator' ? HERO_AMBER : C.primary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={titleStyle}>{title}</Text>
          <Text style={descStyle}>{desc}</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={variant === 'operator' ? 'rgba(242,240,235,0.7)' : C.textTertiary}
        />
      </TouchableOpacity>
    </Animated.View>
  )
}

export default function RoleSelectionScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { setRole, language } = useAuthStore()

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
          <View style={styles.markCircle}>
            <Ionicons name="boat" size={30} color={HERO_AMBER} />
          </View>
          <Text style={styles.logo}>Rentivo</Text>
          <Text style={styles.tagline}>{t('authTagline', language)}</Text>
          <View style={styles.trustRow}>
            <View style={styles.trustChip}>
              <Ionicons name="shield-checkmark-outline" size={13} color={HERO_AMBER} />
              <Text style={styles.trustBadge}>{t('authTrustInsured', language)}</Text>
            </View>
            <View style={styles.trustChip}>
              <Ionicons name="flash-outline" size={13} color={HERO_AMBER} />
              <Text style={styles.trustBadge}>{t('authTrustInstant', language)}</Text>
            </View>
            <View style={styles.trustChip}>
              <Ionicons name="star" size={13} color={HERO_AMBER} />
              <Text style={styles.trustBadge}>{t('authTrustVerified', language)}</Text>
            </View>
          </View>
        </View>

        {/* Role cards */}
        <View style={styles.cards}>
          <RoleCard
            icon="car-sport-outline"
            title={t('authRoleTravelerTitle', language)}
            desc={t('authRoleTravelerDesc', language)}
            variant="traveler"
            onPress={() => handleSelect('consumer')}
          />
          <RoleCard
            icon="home-outline"
            title={t('authRoleHostTitle', language)}
            desc={t('authRoleHostDesc', language)}
            variant="host"
            onPress={() => handleSelect('host')}
          />
          <RoleCard
            icon="business-outline"
            title={t('authRoleOperatorTitle', language)}
            desc={t('authRoleOperatorDesc', language)}
            variant="operator"
            onPress={() => handleSelect('operator')}
          />
        </View>

        {/* Footer */}
        <Text style={styles.footer}>{t('authFooterTerms', language)}</Text>
      </SafeAreaView>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
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
  markCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: HERO_AMBER_TINT,
    borderWidth: 1,
    borderColor: HERO_AMBER_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  logo: {
    fontSize: 44,
    fontFamily: Fonts.extrabold,
    color: '#F2F0EB',
    letterSpacing: -1.5,
    marginBottom: Spacing.sm,
  },
  tagline: {
    // NOTE: this screen's background is a fixed dark-navy gradient
    // (see LinearGradient colors above), not theme-reactive — so text here
    // must use fixed light colors, not C.text/C.textSecondary/C.textTertiary
    // (which flip to near-black in light theme and become unreadable).
    ...Typography.h3,
    color: 'rgba(245,240,232,0.95)',
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  trustBadge: {
    fontSize: 12,
    color: 'rgba(242,240,235,0.85)',
    fontFamily: Fonts.medium,
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
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    ...Shadow.sm,
  },
  // Business card: subtle amber tint over the navy (an equal member of the
  // set — not a solid orange slab shouting over the other two)
  cardOperator: {
    backgroundColor: HERO_AMBER_TINT,
    borderColor: HERO_AMBER_BORDER,
  },

  cardIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconCircleOnTint: {
    backgroundColor: 'rgba(240,177,92,0.18)',
  },
  cardBody: { flex: 1 },
  cardTitle: {
    ...Typography.h4,
    color: C.text,
    marginBottom: 2,
  },
  cardTitleOnTint: { color: '#F2F0EB' },
  cardDesc: {
    ...Typography.bodyS,
    color: C.textSecondary,
  },
  cardDescOnTint: { color: 'rgba(242,240,235,0.65)' },

  footer: {
    fontFamily: Fonts.regular, fontSize: 13,
    color: C.textTertiary,
    textAlign: 'center',
  },
  })
}
