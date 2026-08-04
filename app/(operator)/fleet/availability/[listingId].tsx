import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToastStore } from '@/lib/store/useToastStore'
import {
  getBlackoutPeriods,
  addBlackoutPeriod,
  deleteBlackoutPeriod,
  type BlackoutPeriod,
  type NewBlackoutPeriod,
} from '@/lib/api/availability'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'

const REASONS: { value: BlackoutPeriod['reason']; label: string }[] = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'personal_use', label: 'Personal Use' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'other', label: 'Other' },
]

const REASON_BADGE_VARIANT: Record<string, 'warning' | 'info' | 'neutral' | 'success'> = {
  maintenance: 'warning',
  personal_use: 'info',
  seasonal: 'success',
  other: 'neutral',
}

export default function ListingAvailabilityScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { listingId } = useLocalSearchParams<{ listingId: string }>()
  const { operator, language } = useAuthStore()
  const { showToast } = useToastStore()
  const [blackouts, setBlackouts] = useState<BlackoutPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('Unavailable')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState<BlackoutPeriod['reason']>('maintenance')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getBlackoutPeriods(listingId ?? '')
      setBlackouts(data)
    } catch {
      showToast({ message: t('opFleet2LoadFailedAvailability', language), type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [listingId, showToast, language])

  useEffect(() => { void load() }, [load])

  const resetForm = () => {
    setTitle('Unavailable')
    setStartDate('')
    setEndDate('')
    setReason('maintenance')
    setNotes('')
  }

  const handleAdd = async () => {
    if (!startDate || !endDate) {
      showToast({ message: t('opFleet2EnterDates', language), type: 'error' })
      return
    }
    if (endDate < startDate) {
      showToast({ message: t('opFleet2EndDateAfterStart', language), type: 'error' })
      return
    }
    if (!listingId || !operator?.id) {
      showToast({ message: t('opFleet2MissingContext', language), type: 'error' })
      return
    }

    setSaving(true)
    try {
      const payload: NewBlackoutPeriod = {
        listing_id: listingId,
        operator_id: operator.id,
        title: title.trim() || 'Unavailable',
        start_date: startDate,
        end_date: endDate,
        reason,
        notes: notes.trim() || null,
      }
      const newPeriod = await addBlackoutPeriod(payload)
      setBlackouts(prev => [...prev, newPeriod])
      setShowAddModal(false)
      resetForm()
      showToast({ message: t('opFleet2BlackoutAdded', language), type: 'success' })
    } catch {
      showToast({ message: t('opFleet2AddPeriodFailed', language), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: string) => {
    Alert.alert(
      t('opFleet2RemoveBlackout', language),
      t('opFleet2RemoveBlackoutDesc', language),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('opFleet2Remove', language),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBlackoutPeriod(id)
              setBlackouts(prev => prev.filter(b => b.id !== id))
              showToast({ message: t('opFleet2PeriodRemoved', language), type: 'success' })
            } catch {
              showToast({ message: t('opFleet2RemovePeriodFailed', language), type: 'error' })
            }
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('opFleet2Availability', language)} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.subtitle}>{t('opFleet2AvailabilitySubtitle', language)}</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
            accessibilityLabel={t('opFleet2AddBlackoutPeriod', language)}
            accessibilityRole="button"
          >
            <Text style={styles.addBtnText}>{t('opFleet2AddPeriod', language)}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={styles.loadingText}>{t('opFleet2Loading', language)}</Text>
        ) : blackouts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('opFleet2NoBlockedDates', language)}</Text>
            <Text style={styles.emptyText}>
              {t('opFleet2NoBlockedDatesDesc', language)}
            </Text>
          </Card>
        ) : (
          blackouts.map(b => (
            <Card key={b.id} style={styles.periodCard}>
              <View style={styles.periodHeader}>
                <Text style={styles.periodTitle}>{b.title}</Text>
                <TouchableOpacity
                  onPress={() => handleDelete(b.id)}
                  accessibilityLabel={`Delete blackout period: ${b.title}`}
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteBtn}>{t('opFleet2Remove', language)}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.periodDates}>{b.start_date} to {b.end_date}</Text>
              {b.reason != null && (
                <Badge
                  label={REASONS.find(r => r.value === b.reason)?.label ?? b.reason}
                  variant={REASON_BADGE_VARIANT[b.reason] ?? 'neutral'}
                />
              )}
              {b.notes != null && b.notes.length > 0 && (
                <Text style={styles.notes}>{b.notes}</Text>
              )}
            </Card>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('opFleet2AddBlackoutPeriod', language)}</Text>
            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              accessibilityLabel={t('opFleet2Close', language)}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtn}>{t('opFleet2Close', language)}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>{t('opFleet2BlackoutTitle', language)}</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t('opFleet2TitlePlaceholder', language)}
              placeholderTextColor={C.textSecondary}
              accessibilityLabel={t('opFleet2BlackoutTitleA11y', language)}
            />

            <Text style={styles.fieldLabel}>{t('opFleet2StartDate', language)}</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-06-01"
              placeholderTextColor={C.textSecondary}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel={t('opFleet2StartDate', language)}
            />

            <Text style={styles.fieldLabel}>{t('opFleet2EndDate', language)}</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2026-06-07"
              placeholderTextColor={C.textSecondary}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel={t('opFleet2EndDate', language)}
            />

            <Text style={styles.fieldLabel}>{t('opFleet2Reason', language)}</Text>
            <View style={styles.reasonRow}>
              {REASONS.map(r => (
                <TouchableOpacity
                  key={r.value ?? 'null'}
                  style={[styles.reasonChip, reason === r.value && styles.reasonChipActive]}
                  onPress={() => setReason(r.value)}
                  accessibilityLabel={r.label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: reason === r.value }}
                >
                  <Text style={[styles.reasonChipText, reason === r.value && styles.reasonChipTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t('opFleet2Notes', language)}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('opFleet2NotesPlaceholder', language)}
              placeholderTextColor={C.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              accessibilityLabel={t('opFleet2Notes', language)}
            />

            <Button
              title={saving ? t('opFleet2Saving', language) : t('opFleet2AddBlackoutPeriod', language)}
              onPress={() => void handleAdd()}
              loading={saving}
              fullWidth
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: Spacing.base, gap: Spacing.md },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, flex: 1, marginRight: Spacing.sm },
  addBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: C.background },
  loadingText: { textAlign: 'center', color: C.textSecondary, marginTop: Spacing.xl },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: C.text, marginBottom: Spacing.sm },
  emptyText: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, textAlign: 'center' },
  periodCard: { gap: Spacing.sm },
  periodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  periodTitle: { fontSize: 15, fontFamily: Fonts.bold, color: C.text, flex: 1 },
  deleteBtn: { fontSize: 13, color: C.error, fontFamily: Fonts.semibold, paddingVertical: Spacing.xs, paddingLeft: Spacing.sm, minHeight: 44, textAlignVertical: 'center' },
  periodDates: { fontSize: 14, color: C.primary, fontFamily: Fonts.semibold },
  notes: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary },
  modal: { flex: 1, backgroundColor: C.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 18, fontFamily: Fonts.bold, color: C.text },
  closeBtn: { fontSize: 14, color: C.textSecondary, fontFamily: Fonts.semibold, minHeight: 44, textAlignVertical: 'center', paddingVertical: Spacing.sm },
  modalContent: { padding: Spacing.base },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.semibold,
    color: C.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: C.text,
    fontFamily: Fonts.regular, fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  reasonChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonChipActive: { backgroundColor: C.primarySurface, borderColor: C.primary },
  reasonChipText: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary },
  reasonChipTextActive: { color: C.primaryDark, fontFamily: Fonts.semibold },
  })
}
