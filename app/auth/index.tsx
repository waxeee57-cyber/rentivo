import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'

const { height } = Dimensions.get('window')

export default function RoleSelectionScreen() {
  const { setRole } = useAuthStore()

  const handleSelect = (role: 'consumer' | 'operator') => {
    setRole(role)
    router.push('/auth/login')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.logo}>Rentivo</Text>
        <Text style={styles.tagline}>Rent anything. Anywhere.</Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, styles.cardConsumer]}
          onPress={() => handleSelect('consumer')}
          activeOpacity={0.9}
        >
          <Text style={styles.cardIcon}>🌴</Text>
          <Text style={styles.cardTitle}>I want to rent</Text>
          <Text style={styles.cardDesc}>Find cars, boats, bikes and more</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardOperator]}
          onPress={() => handleSelect('operator')}
          activeOpacity={0.9}
        >
          <Text style={styles.cardIcon}>🚗</Text>
          <Text style={styles.cardTitle}>I manage a fleet</Text>
          <Text style={styles.cardDesc}>List your vehicles and manage bookings</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Mediterranean rental marketplace</Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
  },
  top: { alignItems: 'center', marginTop: height * 0.1 },
  logo: { fontSize: 42, fontWeight: '900', color: Colors.primary, marginBottom: Spacing.sm },
  tagline: { fontSize: 18, color: Colors.textSecondary, fontWeight: '400' },
  cards: { width: '100%', gap: Spacing.base },
  card: {
    width: '100%',
    padding: Spacing.xxl,
    borderRadius: Radius.xxl,
    alignItems: 'center',
    borderWidth: 2,
  },
  cardConsumer: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  cardOperator: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  cardIcon: { fontSize: 48, marginBottom: Spacing.md },
  cardTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: Spacing.xs },
  cardDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  footer: { fontSize: 13, color: Colors.textTertiary, marginBottom: Spacing.md },
})
