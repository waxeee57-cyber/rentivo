import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { captureException } from '@/lib/sentry'

const DISPUTE_REASONS = [
  'Vehicle damage by guest',
  'No-show',
  'Late return',
  'Payment dispute',
  'False damage claim by guest',
  'Other',
]

export default function OperatorDisputeScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const { language } = useAuthStore()
  const { showToast } = useToastStore()
  const [selectedReason, setSelectedReason] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selectedReason) {
      showToast({ message: t('opBkToastSelectReason', language), type: 'error' })
      return
    }
    setSubmitting(true)
    try {
      if (!Config.useMock) {
        // raised_by_auth_id is NOT NULL and must equal auth.uid(). Reading it from
        // the persisted Zustand user (user?.auth_id) can send undefined into the
        // column while a live Supabase session exists — the consumer dispute screen
        // was fixed the same way. Read the live session id instead.
        const { data: { session } } = await supabase.auth.getSession()
        const authUserId = session?.user?.id
        if (!authUserId) throw new Error('No active session')
        const { error } = await supabase.from('rentivo_disputes').insert({
          booking_id: bookingId,
          raised_by_auth_id: authUserId,
          raised_by_role: 'operator',
          reason: selectedReason,
          description: description.trim() || null,
          status: 'open',
        })
        if (error) throw error
      }
      showToast({ message: t('opBkToastDisputeOk', language), type: 'success' })
      router.back()
    } catch (e) {
      captureException(e, { screen: 'operator/dispute', bookingId })
      showToast({ message: t('opBkToastDisputeFail', language), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('opBkOpenDispute', language)} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('opBkReason', language)}</Text>
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
          <Text style={styles.sectionTitle}>{t('opBkDetails', language)}</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder={t('opBkDescribePlaceholder', language)}
            placeholderTextColor={C.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={1000}
            accessibilityLabel="Describe the issue"
          />
        </Card>

        <Button
          title={submitting ? t('opBkSubmitting', language) : t('opBkSubmitDispute', language)}
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
    fontFamily: Fonts.bold,
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
  reasonText: { fontFamily: Fonts.regular, fontSize: 14, color: C.text },
  reasonTextActive: { color: C.primaryDark, fontFamily: Fonts.semibold },
  textArea: {
    backgroundColor: C.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: C.text,
    fontFamily: Fonts.regular, fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  })
}
