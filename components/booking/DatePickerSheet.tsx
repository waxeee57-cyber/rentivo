import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native'
import { addDays, addMonths, differenceInDays, startOfWeek, isSameDay } from 'date-fns'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { AvailabilityCalendar } from '@/components/listing/AvailabilityCalendar'
import { formatDate } from '@/lib/utils/formatDate'

interface DatePickerSheetProps {
  visible: boolean
  startDate: Date | null
  endDate: Date | null
  onApply: (start: Date, end: Date) => void
  onClose: () => void
}

export function DatePickerSheet({ visible, startDate, endDate, onApply, onClose }: DatePickerSheetProps) {
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

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <AvailabilityCalendar
              onRangeSelect={(s, e) => { setLocalStart(s); setLocalEnd(e) }}
              selectedStart={localStart}
              selectedEnd={localEnd}
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
              <View style={styles.summary}>
                <Text style={styles.summaryText}>
                  {duration} {duration === 1 ? 'day' : 'days'} · {formatDate(localStart.toISOString())} – {formatDate(localEnd.toISOString())}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.applyBtn, !canApply && styles.applyBtnDisabled]}
              onPress={handleApply}
              disabled={!canApply}
            >
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.base,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginBottom: Spacing.base,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.base,
  },
  quickChips: {
    paddingVertical: Spacing.base,
    gap: Spacing.sm,
    paddingHorizontal: 2,
  },
  chip: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  summary: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  applyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.base,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyBtnDisabled: {
    opacity: 0.4,
  },
  applyBtnText: {
    color: Colors.textInverse,
    fontWeight: '700',
    fontSize: 16,
  },
})
