import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
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
  const { operator } = useAuthStore()
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
      showToast({ message: 'Failed to load availability', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [listingId, showToast])

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
      showToast({ message: 'Please enter start and end dates (YYYY-MM-DD)', type: 'error' })
      return
    }
    if (endDate < startDate) {
      showToast({ message: 'End date must be after start date', type: 'error' })
      return
    }
    if (!listingId || !operator?.id) {
      showToast({ message: 'Missing listing or operator context', type: 'error' })
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
      showToast({ message: 'Blackout period added', type: 'success' })
    } catch {
      showToast({ message: 'Failed to add period', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: string) => {
    Alert.alert(
      'Remove Blackout Period',
      'These dates will become available again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBlackoutPeriod(id)
              setBlackouts(prev => prev.filter(b => b.id !== id))
              showToast({ message: 'Period removed', type: 'success' })
            } catch {
              showToast({ message: 'Failed to remove period', type: 'error' })
            }
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Availability" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.subtitle}>Block dates when this vehicle is unavailable</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
            accessibilityLabel="Add blackout period"
            accessibilityRole="button"
          >
            <Text style={styles.addBtnText}>+ Add Period</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : blackouts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No blocked dates</Text>
            <Text style={styles.emptyText}>
              Add periods when this vehicle won't be available for rental.
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
                  <Text style={styles.deleteBtn}>Remove</Text>
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
            <Text style={styles.modalTitle}>Add Blackout Period</Text>
            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              accessibilityLabel="Close modal"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtn}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Annual Service"
              placeholderTextColor={C.textSecondary}
              accessibilityLabel="Blackout period title"
            />

            <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-06-01"
              placeholderTextColor={C.textSecondary}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel="Start date"
            />

            <Text style={styles.fieldLabel}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2026-06-07"
              placeholderTextColor={C.textSecondary}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel="End date"
            />

            <Text style={styles.fieldLabel}>Reason</Text>
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

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Internal notes..."
              placeholderTextColor={C.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              accessibilityLabel="Notes"
            />

            <Button
              title={saving ? 'Saving...' : 'Add Blackout Period'}
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
  subtitle: { fontSize: 13, color: C.textSecondary, flex: 1, marginRight: Spacing.sm },
  addBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: C.background },
  loadingText: { textAlign: 'center', color: C.textSecondary, marginTop: Spacing.xl },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: Spacing.sm },
  emptyText: { fontSize: 14, color: C.textSecondary, textAlign: 'center' },
  periodCard: { gap: Spacing.sm },
  periodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  periodTitle: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  deleteBtn: { fontSize: 13, color: C.error, fontWeight: '600', paddingVertical: Spacing.xs, paddingLeft: Spacing.sm, minHeight: 44, textAlignVertical: 'center' },
  periodDates: { fontSize: 14, color: C.primary, fontWeight: '600' },
  notes: { fontSize: 13, color: C.textSecondary },
  modal: { flex: 1, backgroundColor: C.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  closeBtn: { fontSize: 14, color: C.textSecondary, fontWeight: '600', minHeight: 44, textAlignVertical: 'center', paddingVertical: Spacing.sm },
  modalContent: { padding: Spacing.base },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: C.text,
    fontSize: 15,
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
  reasonChipText: { fontSize: 13, color: C.textSecondary },
  reasonChipTextActive: { color: C.primaryDark, fontWeight: '600' },
  })
}
