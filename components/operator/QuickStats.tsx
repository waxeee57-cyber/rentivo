import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Spacing } from '@/constants/colors'
import { RevenueCard } from '@/components/operator/RevenueCard'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { Booking } from '@/types'

interface QuickStatsProps {
  bookings: Booking[]
  totalVehicles: number
}

export function QuickStats({ bookings, totalVehicles }: QuickStatsProps) {
  const { language } = useAuthStore()
  const today = new Date().toISOString().split('T')[0]
  const todayBookings = bookings.filter(b =>
    b.start_date === today && b.status !== 'cancelled',
  ).length

  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthRevenue = bookings
    .filter(b => b.payment_status === 'paid' && b.created_at.startsWith(thisMonth))
    .reduce((sum, b) => sum + b.total_amount, 0)

  const activeRentals = bookings.filter(b => b.status === 'active').length
  const utilization = totalVehicles > 0
    ? Math.round((activeRentals / totalVehicles) * 100)
    : 0

  return (
    <View style={styles.row}>
      <RevenueCard
        icon="calendar-outline"
        label={t('todaysPickups', language)}
        value={String(todayBookings)}
      />
      <RevenueCard icon="cash-outline" label={t('monthRevenue', language)} value={formatEUR(monthRevenue)} />
      <RevenueCard icon="car-sport-outline" label={t('activeRentals', language)} value={String(activeRentals)} />
      <RevenueCard icon="stats-chart-outline" label={t('utilizationStat', language)} value={`${utilization}%`} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
})
