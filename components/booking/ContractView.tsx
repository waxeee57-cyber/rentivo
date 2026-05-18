import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Radius, Spacing } from '@/constants/colors'
import { formatDate, formatDateRange } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import type { Booking } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

interface ContractViewProps {
  booking: Booking
}

export function ContractView({ booking }: ContractViewProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Rental Agreement</Text>
      <Text style={styles.ref}>#{booking.id.slice(0, 8).toUpperCase()}</Text>

      <Section title="Rental Details">
        <Row label="Vehicle" value={booking.listing?.title ?? 'N/A'} />
        <Row label="Operator" value={booking.operator?.name ?? 'N/A'} />
        <Row label="Period" value={formatDateRange(booking.start_date, booking.end_date)} />
        <Row label="Duration" value={`${booking.total_days} days`} />
      </Section>

      <Section title="Renter">
        <Row label="Name" value={booking.guest_name} />
        {booking.guest_phone && <Row label="Phone" value={booking.guest_phone} />}
        {booking.guest_email && <Row label="Email" value={booking.guest_email} />}
        {booking.driver_license_no && <Row label="License No." value={booking.driver_license_no} />}
      </Section>

      <Section title="Payment">
        <Row label="Daily rate" value={formatEURDecimal(booking.price_per_day)} />
        <Row label="Subtotal" value={formatEURDecimal(booking.subtotal)} />
        <Row label="Service fee" value={formatEURDecimal(booking.platform_fee)} />
        <Row label="Total" value={formatEURDecimal(booking.total_amount)} bold />
        {booking.deposit_amount > 0 && (
          <Row label="Security deposit" value={formatEURDecimal(booking.deposit_amount)} />
        )}
      </Section>

      <Section title="Terms">
        <Text style={styles.terms}>
          The renter agrees to return the vehicle in the same condition as received.
          Any damage found during the return inspection will be documented and may
          result in charges against the security deposit. The renter must hold a
          valid driver's license for the duration of the rental.
        </Text>
      </Section>
    </ScrollView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  title: { fontSize: 22, fontWeight: '800', color: C.primary, marginBottom: 4 },
  ref: { fontSize: 13, color: C.textTertiary, marginBottom: Spacing.xl },
  section: {
    marginBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: C.textTertiary,
    marginBottom: Spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  rowLabel: { fontSize: 14, color: C.textSecondary, flex: 1 },
  rowValue: { fontSize: 14, color: C.text, fontWeight: '500', textAlign: 'right' },
  bold: { fontWeight: '700' },
  terms: { fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  })
}
