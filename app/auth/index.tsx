import React, { useRef, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Spacing, Radius, Typography, Shadow } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'

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
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
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
        accessibilityRole="button"
        accessibilityLabel={title}
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
          <Text style={styles.wave}>🌊</Text>
          <Text style={styles.logo}>Rentivo</Text>
          <Text style={styles.tagline}>{t('authTagline', language)}</Text>
          <View style={styles.trustRow}>
            <Text style={styles.trustBadge}>{t('authTrustInsured', language)}</Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustBadge}>{t('authTrustInstant', language)}</Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustBadge}>{t('authTrustVerified', language)}</Text>
          </View>
        </View>

        {/* Role cards */}
        <View style={styles.cards}>
          <RoleCard
            emoji="🌴"
            title={t('authRoleTravelerTitle', language)}
            desc={t('authRoleTravelerDesc', language)}
            variant="traveler"
            onPress={() => handleSelect('consumer')}
          />
          <RoleCard
            emoji="🏠"
            title={t('authRoleHostTitle', language)}
            desc={t('authRoleHostDesc', language)}
            variant="host"
            onPress={() => handleSelect('host')}
          />
          <RoleCard
            emoji="🏢"
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
  wave: {
    fontSize: 40,
    marginBottom: Spacing.md,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    color: C.primary,
    letterSpacing: -1,
    marginBottom: Spacing.sm,
  },
  tagline: {
    ...Typography.h3,
    color: C.text,
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
    color: C.textSecondary,
    fontWeight: '500',
  },
  trustDot: {
    color: C.textTertiary,
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
  cardTraveler: {
    borderLeftWidth: 4,
    borderLeftColor: C.primary,
    borderTopColor: C.border,
    borderRightColor: C.border,
    borderBottomColor: C.border,
  },
  cardHost: {
    borderLeftWidth: 4,
    borderLeftColor: C.white,
    borderTopColor: C.border,
    borderRightColor: C.border,
    borderBottomColor: C.border,
  },
  cardOperator: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },

  cardEmoji: { fontSize: 32 },
  cardBody: { flex: 1 },
  cardTitle: {
    ...Typography.h4,
    color: C.text,
    marginBottom: 2,
  },
  cardTitleDark: { color: C.textInverse },
  cardDesc: {
    ...Typography.bodyS,
    color: C.textSecondary,
  },
  cardDescDark: { color: 'rgba(10,22,40,0.65)' },
  cardArrow: {
    fontSize: 22,
    color: C.textTertiary,
    fontWeight: '300',
  },
  cardArrowDark: { color: C.textInverse },

  footer: {
    fontSize: 13,
    color: C.textTertiary,
    textAlign: 'center',
  },
  })
}
