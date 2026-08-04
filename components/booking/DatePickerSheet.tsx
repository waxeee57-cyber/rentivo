import React, { useState, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native'
import { addDays, addMonths, differenceInDays, startOfWeek, isSameDay, parseISO, isAfter, isBefore } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { AvailabilityCalendar } from '@/components/listing/AvailabilityCalendar'
import { formatDate } from '@/lib/utils/formatDate'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { useColors } from '@/lib/hooks/useColors'
import { t, tPlural } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'

interface DatePickerSheetProps {
  visible: boolean
  startDate: Date | null
  endDate: Date | null
  onApply: (start: Date, end: Date) => void
  onClose: () => void
  blockedDates?: string[]  // ISO date strings e.g. "2026-05-20"
  pricePerDay?: number     // whole euros (NOT cents), for price preview
  /**
   * The listing's real minimum stay. The footer note used to be a hardcoded
   * "Min 1 night rental" regardless of the listing, which lies to the user on
   * any listing with a longer minimum. Callers should pass the listing value;
   * the default of 1 only matches the previous (unconditional) copy.
   */
  minNights?: number
}

export function DatePickerSheet({
  visible, startDate, endDate, onApply, onClose,
  blockedDates = [], pricePerDay, minNights = 1,
}: DatePickerSheetProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const language = useAuthStore(s => s.language)
  const [localStart, setLocalStart] = useState<Date | null>(startDate)
  const [localEnd, setLocalEnd] = useState<Date | null>(endDate)

  const today = new Date()

  const quickSelects = [
    {
      label: t('datePickerQuickWeekend', language),
      onPress: () => {
        const sat = addDays(startOfWeek(today, { weekStartsOn: 1 }), 5)
        const sun = addDays(sat, 1)
        setLocalStart(sat)
        setLocalEnd(sun)
      },
    },
    {
      label: t('datePickerQuickOneWeek', language),
      onPress: () => { setLocalStart(today); setLocalEnd(addDays(today, 7)) },
    },
    {
      label: t('datePickerQuickTwoWeeks', language),
      onPress: () => { setLocalStart(today); setLocalEnd(addDays(today, 14)) },
    },
    {
      label: t('datePickerQuickOneMonth', language),
      onPress: () => { setLocalStart(today); setLocalEnd(addMonths(today, 1)) },
    },
  ]

  const hasRange = localStart !== null && localEnd !== null && !isSameDay(localStart, localEnd)
  const duration = hasRange && localStart && localEnd
    ? Math.max(1, differenceInDays(localEnd, localStart))
    : null

  const canApply = localStart !== null && localEnd !== null

  // Price breakdown — itemised, never a bare total. An unexplained
  // "€1100" under a "no hidden fees" promise is the fastest way to lose
  // a booking; the service fee is shown as its own line.
  const priceBreakdown = (() => {
    if (!duration || !pricePerDay) return null
    const platformCut = 0.10
    const subtotal = pricePerDay * duration
    const fee = Math.round(subtotal * platformCut)
    const total = subtotal + fee
    return { subtotal, fee, total }
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
        {/* Full-screen dismiss target: without a role/label it is an
            unannounced tappable region for screen-reader users. */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('datePickerCloseA11y', language)}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('datePickerTitle', language)}</Text>
          <Text style={styles.subtitle}>{t('datePickerSubtitle', language)}</Text>

          {blockedDates.length > 0 && (
            <View style={styles.blockedNotice}>
              <Ionicons name="ban-outline" size={14} color={C.warning} importantForAccessibility="no" />
              <Text style={styles.blockedNoticeText}>
                {t('datePickerBlockedNotice', language)}
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
                <TouchableOpacity
                  key={q.label}
                  style={styles.chip}
                  onPress={q.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={q.label}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Text style={styles.chipText}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {duration !== null && localStart && localEnd && (
              <View style={[styles.summary, rangeHasBlocked && styles.summaryError]}>
                {rangeHasBlocked ? (
                  <View style={styles.summaryErrorRow}>
                    <Ionicons name="ban-outline" size={14} color={C.error} importantForAccessibility="no" />
                    <Text style={styles.summaryErrorText}>
                      {t('datePickerRangeBlocked', language)}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.summaryText}>
                      {/* `duration === 1 ? 'night' : 'nights'` was wrong in two of
                          the three shipped languages — Hungarian keeps the noun
                          singular after a numeral ("2 éjszaka"). */}
                      {duration} {tPlural('nightOne', 'nightOther', duration, language)} · {formatDate(localStart.toISOString(), language)} – {formatDate(localEnd.toISOString(), language)}
                    </Text>
                    {priceBreakdown && (
                      <View style={styles.breakdown}>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>
                            {formatEUR(pricePerDay ?? 0, language)} × {duration} {tPlural('nightOne', 'nightOther', duration, language)}
                          </Text>
                          <Text style={styles.breakdownValue}>{formatEUR(priceBreakdown.subtotal, language)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>{t('datePickerServiceFee', language)}</Text>
                          <Text style={styles.breakdownValue}>{formatEUR(priceBreakdown.fee, language)}</Text>
                        </View>
                        <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
                          <Text style={styles.breakdownTotalLabel}>{t('datePickerTotal', language)}</Text>
                          <Text style={styles.breakdownTotalValue}>{formatEUR(priceBreakdown.total, language)}</Text>
                        </View>
                      </View>
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
                accessibilityRole="button"
                accessibilityLabel={t('datePickerApplyA11y', language)}
                accessibilityState={{ disabled: !canApply }}
              >
                <Text style={styles.applyBtnText}>{t('datePickerApply', language)}</Text>
              </TouchableOpacity>
            )}

            {/* Was a hardcoded "Min 1 night rental" on every listing; now
                reflects the listing's actual minimum via the `minNights` prop. */}
            <Text style={styles.minNote}>
              {tPlural('datePickerMinNightsOne', 'datePickerMinNightsOther', minNights, language)}
            </Text>

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
  title: { fontSize: 18, fontFamily: Fonts.bold, color: C.text, marginBottom: Spacing.xs },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, marginBottom: Spacing.base },
  blockedNotice: {
    backgroundColor: C.warningSurface,
    borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: C.warning,
  },
  blockedNoticeText: { flex: 1, fontSize: 13, color: C.warning, fontFamily: Fonts.semibold },
  quickChips: { paddingVertical: Spacing.base, gap: Spacing.sm, paddingHorizontal: 2 },
  chip: {
    backgroundColor: C.surfaceWarm, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: C.border,
  },
  chipText: { fontSize: 13, fontFamily: Fonts.semibold, color: C.text },
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
  summaryText: { fontSize: 14, fontFamily: Fonts.semibold, color: C.primaryDark },
  summaryErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryErrorText: { fontSize: 14, fontFamily: Fonts.semibold, color: C.error },
  breakdown: { marginTop: Spacing.sm, alignSelf: 'stretch', gap: 3 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary },
  breakdownValue: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  breakdownTotalRow: {
    marginTop: 4, paddingTop: 6,
    borderTopWidth: 1, borderTopColor: C.borderGold,
  },
  breakdownTotalLabel: { fontSize: 14, fontFamily: Fonts.bold, color: C.text },
  breakdownTotalValue: { fontSize: 14, fontFamily: Fonts.bold, color: C.text, fontVariant: ['tabular-nums'] },
  minNote: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, textAlign: 'center', marginBottom: Spacing.base },
  applyBtn: {
    backgroundColor: C.primary, borderRadius: Radius.pill,
    paddingVertical: Spacing.base, alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  applyBtnDisabled: { opacity: 0.4 },
  applyBtnText: { color: C.textInverse, fontFamily: Fonts.bold, fontSize: 16 },
  })
}
