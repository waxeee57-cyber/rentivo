import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'

const DISPUTE_REASONS = [
  'Vehicle damage by guest',
  'No-show',
  'Late return',
  'Payment dispute',
  'False damage claim by guest',
  'Other',
]

export default function OperatorDisputeScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const { user } = useAuthStore()
  const { showToast } = useToastStore()
  const [selectedReason, setSelectedReason] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selectedReason) {
      showToast({ message: 'Please select a reason', type: 'error' })
      return
    }
    setSubmitting(true)
    try {
      if (!Config.useMock) {
        const { error } = await supabase.from('rentivo_disputes').insert({
          booking_id: bookingId,
          raised_by_auth_id: user?.auth_id,
          raised_by_role: 'operator',
          reason: selectedReason,
          description: description.trim() || null,
          status: 'open',
        })
        if (error) throw error
      }
      showToast({ message: 'Dispute submitted successfully', type: 'success' })
      router.back()
    } catch {
      showToast({ message: 'Failed to submit dispute', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Open a Dispute" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>REASON</Text>
          {DISPUTE_REASONS.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.reasonBtn, selectedReason === r && styles.reasonBtnActive]}
              onPress={() => setSelectedReason(r)}
              accessibilityLabel={r}
              accessibilityRole="radio"
            >
              <Text style={[styles.reasonText, selectedReason === r && styles.reasonTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>DETAILS (OPTIONAL)</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={1000}
          />
        </Card>

        <Button
          title={submitting ? 'Submitting...' : 'Submit Dispute'}
          onPress={() => void handleSubmit()}
          loading={submitting}
          fullWidth
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.md },
  card: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  reasonBtn: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  reasonBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  reasonText: { fontSize: 14, color: Colors.text },
  reasonTextActive: { color: Colors.primaryDark, fontWeight: '600' },
  textArea: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
})
