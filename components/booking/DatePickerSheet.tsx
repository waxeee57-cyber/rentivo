import React, { useState, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native'
import { addDays, addMonths, differenceInDays, startOfWeek, isSameDay, parseISO, isAfter, isBefore } from 'date-fns'
import { Spacing, Radius } from '@/constants/colors'
import { AvailabilityCalendar } from '@/components/listing/AvailabilityCalendar'
import { formatDate } from '@/lib/utils/formatDate'
import { useColors } from '@/lib/hooks/useColors'

interface DatePickerSheetProps {
  visible: boolean
  startDate: Date | null
  endDate: Date | null
  onApply: (start: Date, end: Date) => void
  onClose: () => void
  blockedDates?: string[]  // ISO date strings e.g. "2026-05-20"
  pricePerDay?: number     // whole euros (NOT cents), for price preview
}

export function DatePickerSheet({
  visible, startDate, endDate, onApply, onClose,
  blockedDates = [], pricePerDay,
}: DatePickerSheetProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [localStart, setLocalStart] = useState<Date | null>(startDate)
  const [localEnd, setLocalEnd] = useState<Date | null>(endDate)

  const today = new Date()

  const quickSelects = [
    {
      label: 'This weekend',
      onPress: () => {
        const sat = addDays(startOfWeek(today, { weekStartsOn: 1 }), 5)
        const sun = addDays(sat, 1)
        setLocalStart(sat)
        setLocalEnd(sun)
      },
    },
    {
      label: '1 week',
      onPress: () => { setLocalStart(today); setLocalEnd(addDays(today, 7)) },
    },
    {
      label: '2 weeks',
      onPress: () => { setLocalStart(today); setLocalEnd(addDays(today, 14)) },
    },
    {
      label: '1 month',
      onPress: () => { setLocalStart(today); setLocalEnd(addMonths(today, 1)) },
    },
  ]

  const hasRange = localStart !== null && localEnd !== null && !isSameDay(localStart, localEnd)
  const duration = hasRange && localStart && localEnd
    ? Math.max(1, differenceInDays(localEnd, localStart))
    : null

  const canApply = localStart !== null && localEnd !== null

  // Price preview
  const pricePreview = (() => {
    if (!duration || !pricePerDay) return null
    const platformCut = 0.025
    const subtotal = pricePerDay * duration
    const fee = Math.round(subtotal * platformCut)
    const total = subtotal + fee
    return `${duration} night${duration > 1 ? 's' : ''} · €${total.toFixed(2)} total`
  })()

  // Check if a selected range overlaps with blocked dates
  const rangeHasBlocked = (() => {
    if (!localStart || !localEnd) return false
    const blocked = blockedDates.map(d => parseISO(d))
    return blocked.some(d => !isBefore(d, localStart!) && !isAfter(d, localEnd!))
  })()

  const handleApply = () => {
    if (localStart && localEnd) {
      onApply(localStart, localEnd)
      onClose()
    }
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Select your dates</Text>
          <Text style={styles.subtitle}>When do you want to pick up?</Text>

          {blockedDates.length > 0 && (
            <View style={styles.blockedNotice}>
              <Text style={styles.blockedNoticeText}>
                ⛔ Grayed dates are unavailable (already booked)
              </Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <AvailabilityCalendar
              onRangeSelect={(s, e) => { setLocalStart(s); setLocalEnd(e) }}
              selectedStart={localStart}
              selectedEnd={localEnd}
              blockedDates={blockedDates}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickChips}
            >
              {quickSelects.map(q => (
                <TouchableOpacity key={q.label} style={styles.chip} onPress={q.onPress}>
                  <Text style={styles.chipText}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {duration !== null && localStart && localEnd && (
              <View style={[styles.summary, rangeHasBlocked && styles.summaryError]}>
                {rangeHasBlocked ? (
                  <Text style={styles.summaryErrorText}>
                    ⛔ Selected range includes unavailable dates
                  </Text>
                ) : (
                  <>
                    <Text style={styles.summaryText}>
                      {duration} {duration === 1 ? 'night' : 'nights'} · {formatDate(localStart.toISOString())} – {formatDate(localEnd.toISOString())}
                    </Text>
                    {pricePreview && (
                      <Text style={styles.pricePreview}>{pricePreview}</Text>
                    )}
                  </>
                )}
              </View>
            )}

            {!rangeHasBlocked && (
              <TouchableOpacity
                style={[styles.applyBtn, !canApply && styles.applyBtnDisabled]}
                onPress={handleApply}
                disabled={!canApply}
              >
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.minNote}>Min 1 night rental</Text>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: Spacing.md, paddingHorizontal: Spacing.base,
    maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4, backgroundColor: C.border,
    borderRadius: Radius.pill, alignSelf: 'center', marginBottom: Spacing.base,
  },
  title: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: Spacing.xs },
  subtitle: { fontSize: 14, color: C.textSecondary, marginBottom: Spacing.base },
  blockedNotice: {
    backgroundColor: C.warningSurface,
    borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: C.warning,
  },
  blockedNoticeText: { fontSize: 13, color: C.warning, fontWeight: '600' },
  quickChips: { paddingVertical: Spacing.base, gap: Spacing.sm, paddingHorizontal: 2 },
  chip: {
    backgroundColor: C.surfaceWarm, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: C.border,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: C.text },
  summary: {
    backgroundColor: C.primarySurface, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center',
    marginBottom: Spacing.base,
    borderWidth: 1, borderColor: C.primaryLight,
  },
  summaryError: {
    backgroundColor: C.errorSurface,
    borderColor: C.error,
  },
  summaryText: { fontSize: 14, fontWeight: '600', color: C.primaryDark },
  summaryErrorText: { fontSize: 14, fontWeight: '600', color: C.error },
  pricePreview: { fontSize: 13, color: C.primary, marginTop: 4, fontWeight: '500' },
  minNote: { fontSize: 12, color: C.textTertiary, textAlign: 'center', marginBottom: Spacing.base },
  applyBtn: {
    backgroundColor: C.primary, borderRadius: Radius.pill,
    paddingVertical: Spacing.base, alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  applyBtnDisabled: { opacity: 0.4 },
  applyBtnText: { color: C.textInverse, fontWeight: '700', fontSize: 16 },
  })
}
