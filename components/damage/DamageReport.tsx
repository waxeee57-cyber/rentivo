import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Image } from 'expo-image'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils/formatDate'
import type { DamageReport as DamageReportType } from '@/types'

interface DamageReportProps {
  report: DamageReportType
}

export function DamageReport({ report }: DamageReportProps) {
  const photos = [
    { label: 'Front',    uri: report.photo_front },
    { label: 'Back',     uri: report.photo_back },
    { label: 'Left',     uri: report.photo_left },
    { label: 'Right',    uri: report.photo_right },
    { label: 'Interior', uri: report.photo_interior },
    { label: 'Extra',    uri: report.photo_extra },
  ].filter(p => p.uri)

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {report.type === 'pickup' ? 'Pickup' : 'Return'} Inspection
        </Text>
        <Badge
          label={report.damage_found ? 'Damage found' : 'No damage'}
          variant={report.damage_found ? 'error' : 'success'}
        />
      </View>

      <Text style={styles.date}>{formatDate(report.created_at)}</Text>

      {photos.length > 0 && (
        <View style={styles.photos}>
          {photos.map(p => (
            <Image
              key={p.label}
              source={{ uri: p.uri! }}
              style={styles.photo}
              contentFit="cover"
            />
          ))}
        </View>
      )}

      <View style={styles.details}>
        {report.mileage && <Detail label="Mileage" value={`${report.mileage} km`} />}
        {report.fuel_level && <Detail label="Fuel level" value={report.fuel_level.replace('_', ' ')} />}
        {report.notes && <Detail label="Notes" value={report.notes} />}
        {report.damage_found && report.damage_notes && (
          <Detail label="Damage notes" value={report.damage_notes} highlight />
        )}
      </View>

      <View style={styles.signatures}>
        <SigStatus label="Operator" signed={report.operator_signed} />
        <SigStatus label="Renter" signed={report.consumer_signed} />
      </View>
    </ScrollView>
  )
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: Colors.error }]}>{value}</Text>
    </View>
  )
}

function SigStatus({ label, signed }: { label: string; signed: boolean }) {
  return (
    <View style={styles.sigRow}>
      <Text style={styles.sigLabel}>{label}</Text>
      <Text style={[styles.sigStatus, { color: signed ? Colors.success : Colors.textTertiary }]}>
        {signed ? '✓ Signed' : 'Pending'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  date: { fontSize: 12, color: Colors.textTertiary, marginBottom: Spacing.base },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  photo: { width: 100, height: 75, borderRadius: Radius.md },
  details: { marginBottom: Spacing.base },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  detailLabel: { fontSize: 13, color: Colors.textSecondary },
  detailValue: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.base },
  sigRow: { alignItems: 'center' },
  sigLabel: { fontSize: 12, color: Colors.textTertiary },
  sigStatus: { fontSize: 14, fontWeight: '700', marginTop: 2 },
})
