/**
 * KYC Gate Placeholder
 *
 * JELENLEGI ÁLLAPOT: Simple Electronic Signature (eIDAS szintű)
 * Az app eIDAS Simple Electronic Signature szinten működik — EU-ban jogilag elfogadott.
 *
 * JÖVŐBENI KAPUK:
 *
 * KAPU 1 — Stripe Identity (ajánlott első lépés):
 * - Integráció: @stripe/stripe-react-native StripeProvider-rel
 * - Use case: operator onboarding, driver license verification autóbérlésnél
 * - Aktiválás: amikor Stripe Connect production live
 * - Dokumentáció: https://stripe.com/docs/identity
 *
 * KAPU 2 — Didit (EU-natív, eIDAS 2.0):
 * - Integráció: Didit SDK (React Native)
 * - Use case: EUDI Wallet kompatibilis verification 2026+
 * - Fallback: ha Stripe Identity nem fed egy EU országot
 * - Előny: ingyenes alap tier, ZK proof alapú, GDPR by design
 *
 * KAPU 3 — Veriff (premium, gyors):
 * - 12,000+ dokumentum típus, 6 másodperces döntés
 * - Use case: magas értékű bérletek (yacht, luxury car)
 * - Ár: ~$0.80-1.50/check
 *
 * IMPLEMENTÁLÁS AMIKOR:
 * 1. Stripe Connect production live ÉS
 * 2. Első 10 valódi operátor onboardingja ÉS
 * 3. Jogi tanácsadás lezárva
 */

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Spacing, Radius } from '@/constants/colors'

interface KYCGatePlaceholderProps {
  userType: 'consumer' | 'host' | 'operator'
  isVerified: boolean
  onPress?: () => void
}

export function KYCGatePlaceholder({ userType, isVerified, onPress }: KYCGatePlaceholderProps) {
  if (isVerified) {
    return (
      <View style={styles.verified}>
        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
        <Text style={styles.verifiedText}>Személyazonosság igazolva</Text>
      </View>
    )
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name="shield-outline" size={20} color={Colors.primary} />
      <View style={styles.content}>
        <Text style={styles.title}>Személyazonosság igazolás</Text>
        <Text style={styles.subtitle}>
          {userType === 'operator'
            ? 'Szükséges a flottakezelői funkcióhoz'
            : 'Szükséges a foglaláshoz'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
  },
  content: { flex: 1 },
  title: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  verifiedText: { color: Colors.success, fontSize: 14, fontWeight: '600' },
})
