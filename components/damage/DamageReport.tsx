import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Image } from 'expo-image'
import { Radius, Spacing, Fonts } from '@/constants/colors'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils/formatDate'
import type { DamageReport as DamageReportType } from '@/types'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'

interface DamageReportProps {
  report: DamageReportType
}

export function DamageReport({ report }: DamageReportProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  // This component renders the signed record of a vehicle's condition — the
  // evidence a deposit charge is justified against. Every visible string here
  // was hardcoded English inside an otherwise fully translated app. All the keys
  // used below already existed in constants/i18n.ts; only `cdmgNoDamage` is new
  // (staged in docs/i18n-pending-cleanup.json).
  const language = useAuthStore(s => s.language)
  // `photos` keys the slot label the same way DamagePhotoGrid does, so the
  // capture screen and the report screen cannot disagree about what a photo is.
  // Annotated BEFORE .filter(): a contextual type does not flow through the
  // call, so filtering the literal inline widens labelKey to `string` and it
  // stops satisfying TranslationKey.
  const allPhotos: { labelKey: TranslationKey; uri: string | null }[] = [
    { labelKey: 'photoFront',    uri: report.photo_front },
    { labelKey: 'photoBack',     uri: report.photo_back },
    { labelKey: 'photoLeft',     uri: report.photo_left },
    { labelKey: 'photoRight',    uri: report.photo_right },
    { labelKey: 'photoInterior', uri: report.photo_interior },
    { labelKey: 'photoExtra',    uri: report.photo_extra },
  ]
  const photos = allPhotos.filter(p => p.uri)

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        {/* One key per whole phrase, not "Pickup" + " Inspection": Hungarian
            compounds this into a single word (Átvételi állapotfelmérés), so a
            concatenation could not be translated correctly at all. */}
        <Text style={styles.title}>
          {t(report.type === 'pickup' ? 'pickupInspection' : 'returnInspection', language)}
        </Text>
        <Badge
          // i18n-pending: cdmgNoDamage
          label={report.damage_found ? t('damageFound', language) : 'No damage'}
          variant={report.damage_found ? 'error' : 'success'}
        />
      </View>

      <Text style={styles.date}>{formatDate(report.created_at)}</Text>

      {photos.length > 0 && (
        <View style={styles.photos}>
          {photos.map(p => (
            <Image
              key={p.labelKey}
              source={{ uri: p.uri! }}
              style={styles.photo}
              contentFit="cover"
              accessibilityLabel={t(p.labelKey, language)}
            />
          ))}
        </View>
      )}

      <View style={styles.details}>
        {/* `mileage` already reads "Mileage (km)" / "Kilométeróra (km)", so the
            value carries the bare number rather than repeating the unit. */}
        {report.mileage && <Detail label={t('mileage', language)} value={String(report.mileage)} />}
        {report.fuel_level && (
          <Detail label={t('fuelLevel', language)} value={report.fuel_level.replace('_', ' ')} />
        )}
        {report.notes && <Detail label={t('cdmgGeneralNotes', language)} value={report.notes} />}
        {report.damage_found && report.damage_notes && (
          <Detail
            label={t('cdmgDamageDescriptionA11y', language)}
            value={report.damage_notes}
            highlight
          />
        )}
      </View>

      <View style={styles.signatures}>
        <SigStatus label={t('contractOperator', language)} signed={report.operator_signed} />
        <SigStatus label={t('contractSectionRenter', language)} signed={report.consumer_signed} />
      </View>
    </ScrollView>
  )
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: C.error }]}>{value}</Text>
    </View>
  )
}

function SigStatus({ label, signed }: { label: string; signed: boolean }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const language = useAuthStore(s => s.language)
  return (
    <View style={styles.sigRow}>
      <Text style={styles.sigLabel}>{label}</Text>
      <Text style={[styles.sigStatus, { color: signed ? C.success : C.textTertiary }]}>
        {signed ? `✓ ${t('opDmgSigned', language)}` : t('pending', language)}
      </Text>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  title: { fontSize: 18, fontFamily: Fonts.bold, color: C.text },
  date: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, marginBottom: Spacing.base },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  photo: { width: 100, height: 75, borderRadius: Radius.md },
  details: { marginBottom: Spacing.base },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  detailLabel: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary },
  detailValue: { fontSize: 13, color: C.text, fontFamily: Fonts.medium },
  signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.base },
  sigRow: { alignItems: 'center' },
  sigLabel: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary },
  sigStatus: { fontSize: 14, fontFamily: Fonts.bold, marginTop: 2 },
  })
}
