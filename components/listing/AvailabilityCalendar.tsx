import React, { useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameDay, isBefore, isWithinInterval,
  addMonths, startOfDay } from 'date-fns'
import { Radius, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface AvailabilityCalendarProps {
  blockedDates?: string[]
  onRangeSelect: (start: Date, end: Date) => void
  selectedStart?: Date | null
  selectedEnd?: Date | null
}

export function AvailabilityCalendar({
  blockedDates = [],
  onRangeSelect,
  selectedStart,
  selectedEnd,
}: AvailabilityCalendarProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [displayMonth, setDisplayMonth] = useState(new Date())
  const [pickingStart, setPickingStart] = useState(!selectedStart)

  const today = startOfDay(new Date())
  const blocked = blockedDates.map(d => startOfDay(new Date(d)))

  const monthStart = startOfMonth(displayMonth)
  const monthEnd = endOfMonth(displayMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const isBlocked = (d: Date) => blocked.some(b => isSameDay(b, d))
  const isPast = (d: Date) => isBefore(d, today)
  const isSelected = (d: Date) =>
    (selectedStart && isSameDay(d, selectedStart)) ||
    (selectedEnd && isSameDay(d, selectedEnd))
  const isInRange = (d: Date) =>
    selectedStart && selectedEnd
      ? isWithinInterval(d, { start: selectedStart, end: selectedEnd })
      : false

  const handlePress = (d: Date) => {
    if (isBlocked(d) || isPast(d)) return
    if (!selectedStart || !pickingStart) {
      if (selectedStart && isBefore(d, selectedStart)) {
        onRangeSelect(d, selectedStart)
        setPickingStart(true)
      } else if (selectedStart && !isSameDay(d, selectedStart)) {
        onRangeSelect(selectedStart, d)
        setPickingStart(true)
      } else {
        onRangeSelect(d, d)
        setPickingStart(false)
      }
    } else {
      onRangeSelect(d, d)
      setPickingStart(false)
    }
  }

  const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDisplayMonth(m => addMonths(m, -1))} style={styles.navBtn}>
          <Text style={styles.navText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{format(displayMonth, 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={() => setDisplayMonth(m => addMonths(m, 1))} style={styles.navBtn}>
          <Text style={styles.navText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAYS.map(d => (
          <Text key={d} style={styles.weekday}>{d}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((d, i) => {
          const outOfMonth = d.getMonth() !== displayMonth.getMonth()
          const blocked2 = isBlocked(d)
          const past = isPast(d)
          const sel = isSelected(d)
          const inRange = isInRange(d)

          return (
            <TouchableOpacity
              key={i}
              onPress={() => handlePress(d)}
              disabled={blocked2 || past}
              style={[
                styles.day,
                sel && styles.daySelected,
                inRange && !sel && styles.dayInRange,
                (blocked2 || past) && styles.dayDisabled,
                outOfMonth && styles.dayOutOfMonth,
              ]}
            >
              <Text style={[
                styles.dayText,
                sel && styles.dayTextSelected,
                (blocked2 || past) && styles.dayTextDisabled,
                outOfMonth && styles.dayTextOutOfMonth,
              ]}>
                {format(d, 'd')}
              </Text>
              {blocked2 && <Text style={styles.blockedX}>✕</Text>}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const DAY_SIZE = 40

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { backgroundColor: C.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  navBtn: { padding: Spacing.sm },
  navText: { fontSize: 22, color: C.primary, fontWeight: '700' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: C.text },
  weekdays: { flexDirection: 'row', paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  weekday: {
    width: DAY_SIZE,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: C.textTertiary,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.sm },
  day: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DAY_SIZE / 2,
    marginBottom: 4,
  },
  daySelected: { backgroundColor: C.primary },
  dayInRange: { backgroundColor: C.primarySurface, borderRadius: 0 },
  dayDisabled: { opacity: 0.4 },
  dayOutOfMonth: { opacity: 0.25 },
  dayText: { fontSize: 14, color: C.text, fontWeight: '500' },
  dayTextSelected: { color: C.textInverse, fontWeight: '700' },
  dayTextDisabled: { textDecorationLine: 'line-through' },
  dayTextOutOfMonth: { color: C.textTertiary },
  blockedX: { position: 'absolute', fontSize: 8, color: C.error, bottom: 2 },
  })
}
