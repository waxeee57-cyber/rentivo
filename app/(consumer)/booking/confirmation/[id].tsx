import React, { useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { useToastStore } from '@/lib/store/useToastStore'

function NextStep({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.nextStep}>
      <Text style={styles.nextStepIcon}>{icon}</Text>
      <Text style={styles.nextStepText}>{text}</Text>
    </View>
  )
}

export default function BookingConfirmationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const ref = (id ?? 'XXXXX').slice(0, 8).toUpperCase()
  const { showToast } = useToastStore()

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setTimeout(() => {
      showToast({ message: 'Booking confirmed! ✓', type: 'success' })
    }, 800)
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Booking Confirmed" onBack={() => router.replace('/(consumer)/bookings')} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.successSection}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.title}>Booking Confirmed!</Text>
          <Text style={styles.ref}>Reference: #{ref}</Text>
          <Text style={styles.subtitle}>
            Your booking has been placed. The operator will confirm shortly.
          </Text>
        </View>

        {/* What happens next */}
        <View style={styles.nextCard}>
          <Text style={styles.nextCardTitle}>What happens next</Text>
          <NextStep
            icon="→"
            text="The operator will contact you about pickup details"
          />
          <NextStep
            icon="→"
            text="You'll receive a digital contract to sign"
          />
          <NextStep
            icon="→"
            text="On pickup day: inspect the vehicle together"
          />
        </View>

        {/* Checklist */}
        <View style={styles.checklist}>
          <View style={styles.checkRow}>
            <Text style={styles.checkRowIcon}>✅</Text>
            <Text style={styles.checkRowLabel}>Booking Confirmed</Text>
          </View>
          <View style={styles.checkRow}>
            <Text style={styles.checkRowIcon}>✅</Text>
            <Text style={styles.checkRowLabel}>Payment Processed</Text>
          </View>
          <View style={styles.checkRow}>
            <Text style={styles.checkRowIcon}>✅</Text>
            <Text style={styles.checkRowLabel}>Contract Generated</Text>
          </View>
          <View style={styles.checkRow}>
            <Text style={[styles.checkRowIcon, { color: Colors.info }]}>🛡️</Text>
            <Text style={styles.checkRowLabel}>Insurance Active</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button
          title="View booking details"
          onPress={() => router.push(`/(consumer)/bookings/${id ?? 'bk-001'}`)}
          fullWidth
          style={{ marginBottom: Spacing.sm }}
        />
        <TouchableOpacity
          style={styles.msgBtn}
          onPress={() => router.push(`/(consumer)/bookings/chat/${id ?? 'bk-001'}` as Parameters<typeof router.push>[0])}
        >
          <Text style={styles.msgBtnText}>💬 Message operator</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl },
  successSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
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

  nextCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  nextCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  nextStepIcon: { fontSize: 14, color: Colors.primary, fontWeight: '700', marginTop: 2 },
  nextStepText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  checklist: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkRowIcon: { fontSize: 16, color: Colors.success },
  checkRowLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },

  actions: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xxxl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  msgBtn: {
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
})
