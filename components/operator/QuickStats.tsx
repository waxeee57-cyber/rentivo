import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Spacing } from '@/constants/colors'
import { RevenueCard } from '@/components/operator/RevenueCard'
import { formatEUR } from '@/lib/utils/formatCurrency'
import type { Booking } from '@/types'

interface QuickStatsProps {
  bookings: Booking[]
  totalVehicles: number
}

export function QuickStats({ bookings, totalVehicles }: QuickStatsProps) {
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
        emoji="📅"
        label="Today's pickups"
        value={todayBookings === 0 ? '☀️ Free' : String(todayBookings)}
      />
      <RevenueCard emoji="💰" label="Month revenue" value={formatEUR(monthRevenue)} />
      <RevenueCard emoji="🚗" label="Active rentals" value={String(activeRentals)} />
      <RevenueCard emoji="📊" label="Utilization" value={`${utilization}%`} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
})
