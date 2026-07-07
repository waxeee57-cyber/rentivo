import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'

const DISPUTE_REASONS = [
  'Vehicle not as described',
  'Vehicle not available at pickup',
  'Damage charges dispute',
  'Overcharged',
  'Safety concern',
  'Other',
]

export default function ConsumerDisputeScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const { user, language } = useAuthStore()
  const { showToast } = useToastStore()
  const [selectedReason, setSelectedReason] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selectedReason) {
      showToast({ message: t('cbkSelectReason', language), type: 'error' })
      return
    }
    setSubmitting(true)
    try {
      if (!Config.useMock) {
        const { error } = await supabase.from('rentivo_disputes').insert({
          booking_id: bookingId,
          raised_by_auth_id: user?.auth_id,
          raised_by_role: 'consumer',
          reason: selectedReason,
          description: description.trim() || null,
          status: 'open',
        })
        if (error) throw error
      }
      showToast({ message: t('cbkDisputeSubmitted', language), type: 'success' })
      router.back()
    } catch {
      showToast({ message: t('cbkDisputeFailed', language), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('cbkOpenDispute', language)} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('cbkReason', language)}</Text>
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
          <Text style={styles.sectionTitle}>{t('cbkDetailsOptional', language)}</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder={t('cbkDescribeIssue', language)}
            placeholderTextColor={C.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={1000}
          />
        </Card>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{t('cbkDisputeInfo', language)}</Text>
        </View>

        <Button
          title={submitting ? t('cbkSubmitting', language) : t('cbkSubmitDispute', language)}
          onPress={() => void handleSubmit()}
          loading={submitting}
          fullWidth
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: Spacing.base, gap: Spacing.md },
  card: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  reasonBtn: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  reasonBtnActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
  reasonText: { fontSize: 14, color: C.text },
  reasonTextActive: { color: C.primaryDark, fontWeight: '600' },
  textArea: {
    backgroundColor: C.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: C.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  infoBox: {
    backgroundColor: C.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoText: { fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  })
}
