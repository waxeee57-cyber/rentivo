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
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { useOperatorBookings } from '@/lib/hooks/useOperatorBookings'
import { useAuthStore } from '@/lib/store/useAuthStore'
import type { Booking, BookingStatus } from '@/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CELL_SIZE = (SCREEN_WIDTH - Spacing.base * 2) / 7

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: Colors.warning,
  confirmed: Colors.success,
  active: Colors.info,
  completed: Colors.textTertiary,
  cancelled: Colors.error,
  disputed: Colors.error,
}

const STATUS_ICONS: Record<BookingStatus, string> = {
  pending: '⏳',
  confirmed: '✓',
  active: '▶',
  completed: '●',
  cancelled: '✕',
  disputed: '!',
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function StatusDot({ status }: { status: BookingStatus }) {
  return (
    <View style={[dotStyles.dot, { backgroundColor: STATUS_COLORS[status] }]}>
      <Text style={dotStyles.text}>{STATUS_ICONS[status]}</Text>
    </View>
  )
}

const dotStyles = StyleSheet.create({
  dot: {
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center', marginBottom: 1,
  },
  text: { fontSize: 7, color: Colors.white, fontWeight: '800' },
})

export default function OperatorCalendarScreen() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const { operator } = useAuthStore()
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
      <ScreenHeader title="Fleet Calendar" />

      <View style={styles.monthNav}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setCurrentMonth(m => subMonths(m, 1))}
          accessibilityLabel="Previous month"
          accessibilityRole="button"
        >
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setCurrentMonth(m => addMonths(m, 1))}
          accessibilityLabel="Next month"
          accessibilityRole="button"
        >
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legend}>
        {(['pending', 'confirmed', 'active', 'completed'] as BookingStatus[]).map(s => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[s] }]} />
            <Text style={styles.legendLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
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
              >
                <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>
                  {format(day, 'd')}
                </Text>
                {dayBookings.slice(0, 3).map((b, idx) => (
                  <StatusDot key={`${b.id}-${idx}`} status={b.status} />
                ))}
                {dayBookings.length > 3 && (
                  <Text style={styles.more}>+{dayBookings.length - 3}</Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Month booking list */}
        <Text style={styles.listTitle}>Bookings this month</Text>
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
              <Text style={styles.bookingStatus}>{b.status}</Text>
            </TouchableOpacity>
          ))}
        {bookings.filter(b => {
          const start = new Date(b.start_date)
          return start >= monthStart && start <= monthEnd
        }).length === 0 && (
          <Text style={styles.emptyMonth}>No bookings this month</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  navArrow: { fontSize: 22, color: Colors.text, fontWeight: '700' },
  monthTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  legend: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: Colors.textSecondary },
  calBody: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  dayHeaderRow: { flexDirection: 'row' },
  dayHeader: {
    width: CELL_SIZE, textAlign: 'center',
    fontSize: 11, fontWeight: '700', color: Colors.textTertiary,
    paddingVertical: Spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: CELL_SIZE, minHeight: 60,
    borderWidth: 0.5, borderColor: Colors.border,
    padding: 3, alignItems: 'center',
  },
  dayCellToday: { backgroundColor: Colors.primarySurface },
  dayNum: { fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  dayNumToday: { color: Colors.primary, fontWeight: '800' },
  more: { fontSize: 8, color: Colors.textTertiary },
  listTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: Spacing.xl, marginBottom: Spacing.md,
  },
  bookingRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.sm, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  statusBar: { width: 4, height: 36, borderRadius: 2 },
  bookingInfo: { flex: 1 },
  bookingGuest: { fontSize: 14, fontWeight: '700', color: Colors.text },
  bookingDates: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  bookingStatus: { fontSize: 12, color: Colors.textTertiary, textTransform: 'capitalize' },
  emptyMonth: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl },
})
