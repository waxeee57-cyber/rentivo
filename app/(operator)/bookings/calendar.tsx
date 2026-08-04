import React, { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay,
} from 'date-fns'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { useOperatorBookings } from '@/lib/hooks/useOperatorBookings'
import { useAuthStore } from '@/lib/store/useAuthStore'
import type { Booking, BookingStatus } from '@/types'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CELL_SIZE = (SCREEN_WIDTH - Spacing.base * 2) / 7

const STATUS_ICONS: Record<BookingStatus, string> = {
  pending: '○',
  confirmed: '✓',
  active: '▶',
  completed: '●',
  cancelled: '✕',
  disputed: '!',
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function StatusDot({ status, color }: { status: BookingStatus; color: string }) {
  return (
    <View style={[{ width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 1 }, { backgroundColor: color }]}>
      {/* intentional: white text on colored dot — theme-independent */}
      <Text style={{ fontSize: 7, color: '#FFFFFF', fontFamily: Fonts.extrabold }}>{STATUS_ICONS[status]}</Text>
    </View>
  )
}

export default function OperatorCalendarScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const STATUS_COLORS: Record<BookingStatus, string> = useMemo(() => ({
    pending: C.warning,
    confirmed: C.success,
    active: C.info,
    completed: C.textTertiary,
    cancelled: C.error,
    disputed: C.error,
  }), [C])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const { operator, language } = useAuthStore()
  const { bookings } = useOperatorBookings(operator?.id ?? 'op-001')

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Monday = 0, Sunday = 6
  const startDayOfWeek = (() => {
    const d = getDay(monthStart)
    return d === 0 ? 6 : d - 1
  })()

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>()
    bookings.forEach(b => {
      const start = new Date(b.start_date)
      const end = new Date(b.end_date)
      daysInMonth.forEach(day => {
        if (day >= start && day <= end) {
          const key = format(day, 'yyyy-MM-dd')
          map.set(key, [...(map.get(key) ?? []), b])
        }
      })
    })
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, currentMonth])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={t('opBkFleetCalendar', language)} />

      <View style={styles.monthNav}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setCurrentMonth(m => subMonths(m, 1))}
          accessibilityLabel={t('opBkPrevMonth', language)}
          accessibilityRole="button"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setCurrentMonth(m => addMonths(m, 1))}
          accessibilityLabel={t('opBkNextMonth', language)}
          accessibilityRole="button"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legend}>
        {(['pending', 'confirmed', 'active', 'completed'] as BookingStatus[]).map(s => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[s] }]} />
            <Text style={styles.legendLabel}>{t(s as TranslationKey, language)}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.calBody}>
        {/* Day headers */}
        <View style={styles.dayHeaderRow}>
          {DAY_LABELS.map(d => (
            <Text key={d} style={styles.dayHeader}>{d}</Text>
          ))}
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {Array(startDayOfWeek).fill(null).map((_, i) => (
            <View key={`pad-${i}`} style={styles.dayCell} />
          ))}
          {daysInMonth.map(day => {
            const key = format(day, 'yyyy-MM-dd')
            const dayBookings = bookingsByDate.get(key) ?? []
            const isToday = isSameDay(day, new Date())
            return (
              <TouchableOpacity
                key={key}
                style={[styles.dayCell, isToday && styles.dayCellToday]}
                onPress={() => {
                  if (dayBookings.length === 1) {
                    router.push(`/(operator)/bookings/${dayBookings[0].id}`)
                  }
                }}
                accessibilityLabel={`${format(day, 'MMMM d')}, ${dayBookings.length} bookings`}
                accessibilityRole="button"
              >
                <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>
                  {format(day, 'd')}
                </Text>
                {dayBookings.slice(0, 3).map((b, idx) => (
                  <StatusDot key={`${b.id}-${idx}`} status={b.status} color={STATUS_COLORS[b.status]} />
                ))}
                {dayBookings.length > 3 && (
                  <Text style={styles.more}>+{dayBookings.length - 3}</Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Month booking list */}
        <Text style={styles.listTitle}>{t('opBkBookingsMonth', language)}</Text>
        {bookings
          .filter(b => {
            const start = new Date(b.start_date)
            return start >= monthStart && start <= monthEnd
          })
          .map(b => (
            <TouchableOpacity
              key={b.id}
              style={styles.bookingRow}
              onPress={() => router.push(`/(operator)/bookings/${b.id}`)}
              accessibilityLabel={`${b.guest_name} booking`}
              accessibilityRole="button"
            >
              <View style={[styles.statusBar, { backgroundColor: STATUS_COLORS[b.status] }]} />
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingGuest}>{b.guest_name}</Text>
                <Text style={styles.bookingDates}>
                  {format(new Date(b.start_date), 'MMM d')} – {format(new Date(b.end_date), 'MMM d')}
                </Text>
              </View>
              <Text style={styles.bookingStatus}>{t(b.status as TranslationKey, language)}</Text>
            </TouchableOpacity>
          ))}
        {bookings.filter(b => {
          const start = new Date(b.start_date)
          return start >= monthStart && start <= monthEnd
        }).length === 0 && (
          <Text style={styles.emptyMonth}>{t('opBkNoBookingsMonth', language)}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  navArrow: { fontSize: 22, color: C.text, fontFamily: Fonts.bold },
  monthTitle: { fontSize: 18, fontFamily: Fonts.extrabold, color: C.text },
  legend: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary },
  calBody: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  dayHeaderRow: { flexDirection: 'row' },
  dayHeader: {
    width: CELL_SIZE, textAlign: 'center',
    fontSize: 11, fontFamily: Fonts.bold, color: C.textTertiary,
    paddingVertical: Spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: CELL_SIZE, minHeight: 60,
    borderWidth: 0.5, borderColor: C.border,
    padding: 3, alignItems: 'center',
  },
  dayCellToday: { backgroundColor: C.primarySurface },
  dayNum: { fontSize: 12, fontFamily: Fonts.semibold, color: C.text, marginBottom: 2 },
  dayNumToday: { color: C.primary, fontFamily: Fonts.extrabold },
  more: { fontFamily: Fonts.regular, fontSize: 8, color: C.textTertiary },
  listTitle: {
    fontSize: 12, fontFamily: Fonts.bold, color: C.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: Spacing.xl, marginBottom: Spacing.md,
  },
  bookingRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.sm, gap: Spacing.md,
    borderWidth: 1, borderColor: C.border,
  },
  statusBar: { width: 4, height: 36, borderRadius: 2 },
  bookingInfo: { flex: 1 },
  bookingGuest: { fontSize: 14, fontFamily: Fonts.bold, color: C.text },
  bookingDates: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  bookingStatus: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, textTransform: 'capitalize' },
  emptyMonth: { fontFamily: Fonts.regular, fontSize: 14, color: C.textTertiary, textAlign: 'center', marginTop: Spacing.xl },
  })
}
