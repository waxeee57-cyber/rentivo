import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Radius, Spacing, Fonts } from '@/constants/colors'
import { formatDateRange } from '@/lib/utils/formatDate'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import type { Booking } from '@/types'
import { useColors } from '@/lib/hooks/useColors'
import { t, tPlural } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'

interface ContractViewProps {
  booking: Booking
}

export function ContractView({ booking }: ContractViewProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  // Every label below used to be an English literal, so a Hungarian or Spanish
  // signer was shown an English legal agreement. All 18 now come from the
  // translation table under the `contract*` prefix.
  const language = useAuthStore(s => s.language)
  const na = t('contractNotAvailable', language)
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('contractTitle', language)}</Text>
      <Text style={styles.ref}>#{booking.id.slice(0, 8).toUpperCase()}</Text>

      <Section title={t('contractSectionRentalDetails', language)}>
        <Row label={t('contractVehicle', language)} value={booking.listing?.title ?? na} />
        <Row label={t('contractOperator', language)} value={booking.operator?.name ?? na} />
        <Row
          label={t('contractPeriod', language)}
          value={formatDateRange(booking.start_date, booking.end_date, language)}
        />
        <Row
          label={t('contractDuration', language)}
          // Hungarian takes a singular noun after a numeral ("3 nap"), so the
          // count/noun pairing goes through tPlural rather than string + 's'.
          value={`${booking.total_days} ${tPlural('contractDayOne', 'contractDayOther', booking.total_days, language)}`}
        />
      </Section>

      <Section title={t('contractSectionRenter', language)}>
        <Row label={t('contractName', language)} value={booking.guest_name} />
        {booking.guest_phone && <Row label={t('contractPhone', language)} value={booking.guest_phone} />}
        {booking.guest_email && <Row label={t('contractEmail', language)} value={booking.guest_email} />}
        {booking.driver_license_no && (
          <Row label={t('contractLicenseNo', language)} value={booking.driver_license_no} />
        )}
      </Section>

      <Section title={t('contractSectionPayment', language)}>
        <Row label={t('contractDailyRate', language)} value={formatEURDecimal(booking.price_per_day, language)} />
        <Row label={t('contractSubtotal', language)} value={formatEURDecimal(booking.subtotal, language)} />
        <Row label={t('contractServiceFee', language)} value={formatEURDecimal(booking.platform_fee, language)} />
        <Row label={t('contractTotal', language)} value={formatEURDecimal(booking.total_amount, language)} bold />
        {booking.deposit_amount > 0 && (
          <Row
            label={t('contractSecurityDeposit', language)}
            value={formatEURDecimal(booking.deposit_amount, language)}
          />
        )}
      </Section>

      <Section title={t('contractSectionTerms', language)}>
        <Text style={styles.terms}>{t('contractTermsBody', language)}</Text>
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
  title: { fontSize: 22, fontFamily: Fonts.extrabold, color: C.primary, marginBottom: 4 },
  ref: { fontFamily: Fonts.regular, fontSize: 13, color: C.textTertiary, marginBottom: Spacing.xl },
  section: {
    marginBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: C.textTertiary,
    marginBottom: Spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  rowLabel: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, flex: 1 },
  rowValue: { fontSize: 14, color: C.text, fontFamily: Fonts.medium, textAlign: 'right' },
  bold: { fontFamily: Fonts.bold },
  terms: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  })
}
