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
import { captureException } from '@/lib/sentry'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'

/**
 * `value` is what goes into rentivo_disputes.reason; `label` is what the user
 * reads. They were the same English sentence before, which broke both halves at
 * once: an operator or admin filtering the column had to string-match prose that
 * changes whenever the copy is edited, and the buttons stayed English in a
 * trilingual app. The table is empty, so no stored value needs preserving.
 *
 * Labels are English literals until the keys below land in constants/i18n.ts —
 * see docs/i18n-pending-consumerfix.json.
 */
const DISPUTE_REASONS: Array<{ value: string; label: string }> = [
  // i18n-pending: cbkDisputeReasonNotAsDescribed
  { value: 'vehicle_not_as_described', label: 'Vehicle not as described' },
  // i18n-pending: cbkDisputeReasonNotAvailable
  { value: 'vehicle_not_available', label: 'Vehicle not available at pickup' },
  // i18n-pending: cbkDisputeReasonDamageCharges
  { value: 'damage_charges', label: 'Damage charges dispute' },
  // i18n-pending: cbkDisputeReasonOvercharged
  { value: 'overcharged', label: 'Overcharged' },
  // i18n-pending: cbkDisputeReasonSafety
  { value: 'safety_concern', label: 'Safety concern' },
  // i18n-pending: cbkDisputeReasonOther
  { value: 'other', label: 'Other' },
]

export default function ConsumerDisputeScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  // Only `language` is read here now: the auth id for the insert comes from the
  // live Supabase session, not from the persisted store.
  const { language } = useAuthStore()
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
        // raised_by_auth_id is NOT NULL and has to equal auth.uid(). It was read
        // from the persisted Zustand user, which can be undefined while a
        // Supabase session is live — that sent no value at all into a NOT NULL
        // uuid column, and the bare catch below turned the rejection into a
        // generic toast that named nothing.
        const { data: { session } } = await supabase.auth.getSession()
        const authUserId = session?.user?.id
        if (!authUserId) {
          showToast({ message: t('cbkMustBeLoggedIn', language), type: 'error' })
          return
        }
        if (!bookingId) {
          throw new Error('Dispute submitted without a bookingId')
        }

        const { error } = await supabase.from('rentivo_disputes').insert({
          booking_id: bookingId,
          raised_by_auth_id: authUserId,
          raised_by_role: 'consumer',
          // The stable machine key, not the label the user tapped.
          reason: selectedReason,
          description: description.trim() || null,
          status: 'open',
        })
        if (error) throw error
      }
      showToast({ message: t('cbkDisputeSubmitted', language), type: 'success' })
      router.back()
    } catch (e) {
      // `catch {}` hid every real cause here: a dispute is the user's escalation
      // path, so a failure to file one has to be reported somewhere.
      captureException(e, { scope: 'dispute.submit', bookingId })
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
              key={r.value}
              style={[styles.reasonBtn, selectedReason === r.value && styles.reasonBtnActive]}
              onPress={() => setSelectedReason(r.value)}
              accessibilityLabel={r.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedReason === r.value }}
            >
              <Text style={[styles.reasonText, selectedReason === r.value && styles.reasonTextActive]}>
                {r.label}
              </Text>
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
  infoBox: {
    backgroundColor: C.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoText: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  })
}
