import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { ScreenHeader } from '@/components/ui/ScreenHeader'

function CheckRow({ label, done, insurance }: { label: string; done: boolean; insurance?: boolean }) {
  return (
    <View style={styles.checkRow}>
      <Text style={[styles.checkRowIcon, insurance && { color: Colors.info }]}>
        {insurance ? '🛡️' : done ? '✅' : '⏳'}
      </Text>
      <Text style={styles.checkRowLabel}>{label}</Text>
    </View>
  )
}

export default function BookingConfirmationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const ref = (id ?? 'XXXXX').slice(0, 8).toUpperCase()

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Booking Confirmed" onBack={() => router.replace('/(consumer)/bookings')} />
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.ref}>Reference: #{ref}</Text>
        <Text style={styles.subtitle}>
          Your booking has been placed. The operator will confirm shortly.
        </Text>

        <View style={styles.checklist}>
          <CheckRow label="Booking Confirmed" done />
          <CheckRow label="Payment Processed" done />
          <CheckRow label="Contract Generated" done />
          <CheckRow label="Insurance Active" done insurance />
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          title="View booking"
          onPress={() => router.push(`/(consumer)/bookings/${id ?? 'bk-001'}`)}
          fullWidth
          style={{ marginBottom: Spacing.md }}
        />
        <Button
          title="Explore more"
          onPress={() => router.replace('/(consumer)/explore')}
          variant="ghost"
          fullWidth
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 3,
    borderColor: Colors.success,
  },
  checkMark: { fontSize: 48, color: Colors.success, fontWeight: '900' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: Spacing.sm },
  ref: { fontSize: 15, color: Colors.primary, fontWeight: '700', marginBottom: Spacing.md },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  actions: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  checklist: { marginTop: Spacing.xl, width: '100%', gap: Spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkRowIcon: { fontSize: 16, color: Colors.success },
  checkRowLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
})
