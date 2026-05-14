import React, { useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'

function RoleCard({
  emoji,
  title,
  desc,
  dark = false,
  onPress,
}: {
  emoji: string
  title: string
  desc: string
  dark?: boolean
  onPress: () => void
}) {
  const scale = useRef(new Animated.Value(1)).current

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.card, dark ? styles.cardDark : styles.cardLight]}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, damping: 15, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 15, useNativeDriver: true }).start()}
        activeOpacity={1}
      >
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, dark && styles.cardTitleDark]}>{title}</Text>
          <Text style={[styles.cardDesc, dark && styles.cardDescDark]}>{desc}</Text>
        </View>
        <Text style={[styles.cardArrow, dark && styles.cardArrowDark]}>→</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

export default function RoleSelectionScreen() {
  const { setRole } = useAuthStore()

  const handleSelect = (role: 'consumer' | 'operator') => {
    setRole(role)
    router.push('/auth/login')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>Rentivo</Text>
        <Text style={styles.tagline}>Rent anything. Anywhere.</Text>
        <Text style={styles.subTagline}>Mediterranean & Beyond</Text>
      </View>

      <View style={styles.cards}>
        <RoleCard
          emoji="🌴"
          title="I'm a traveler"
          desc="Find cars, boats & more"
          onPress={() => handleSelect('consumer')}
        />
        <RoleCard
          emoji="🚗"
          title="I manage a fleet"
          desc="List vehicles, track revenue"
          dark
          onPress={() => handleSelect('operator')}
        />
      </View>

      <Text style={styles.footer}>By continuing you agree to our Terms of Service</Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.primary,
    marginBottom: Spacing.sm,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subTagline: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.textSecondary,
  },

  cards: {
    gap: Spacing.base,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    gap: Spacing.base,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  cardLight: {
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
  },
  cardDark: {
    backgroundColor: Colors.primary,
    borderWidth: 0,
    shadowColor: '#000',
  },
  cardEmoji: { fontSize: 40 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  cardTitleDark: { color: Colors.dark },
  cardDesc: { fontSize: 14, color: Colors.textSecondary },
  cardDescDark: { color: 'rgba(10,22,40,0.7)' },
  cardArrow: { fontSize: 20, color: Colors.textTertiary, fontWeight: '700' },
  cardArrowDark: { color: Colors.dark },

  footer: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
})
