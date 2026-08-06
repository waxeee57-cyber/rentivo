import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TextInput, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { DamagePhotoCompare } from '@/components/damage/DamagePhotoCompare'
import type { DamageComparePair } from '@/components/damage/DamagePhotoCompare'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { Config } from '@/constants/config'
import { t } from '@/constants/i18n'
import { fetchBooking } from '@/lib/api/bookings'
import { fetchDamageReport } from '@/lib/api/damage'
import {
  chargeDeposit, fetchDepositState, depositBlockReason, depositChargeFailed,
  DepositChargeError,
} from '@/lib/api/deposits'
import type { DepositState, DepositBlockReason } from '@/lib/api/deposits'
import { captureException } from '@/lib/sentry'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useToastStore } from '@/lib/store/useToastStore'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { formatDate } from '@/lib/utils/formatDate'
import type { Booking, DamageReport, FuelLevel } from '@/types'

type PhotoKey = 'front' | 'back' | 'left' | 'right' | 'interior' | 'extra'

/** Slot order is fixed so pickup and return always line up front-to-front. */
const PHOTO_SLOTS: { key: PhotoKey; field: keyof DamageReport }[] = [
  { key: 'front',    field: 'photo_front' },
  { key: 'back',     field: 'photo_back' },
  { key: 'left',     field: 'photo_left' },
  { key: 'right',    field: 'photo_right' },
  { key: 'interior', field: 'photo_interior' },
  { key: 'extra',    field: 'photo_extra' },
]

// Language-neutral glyphs for the two mid-range levels; the words are marked
// i18n-pending below. Not emoji.
const FUEL_LABELS: Record<FuelLevel, string> = {
  empty: 'Empty',            // i18n-pending: fuelEmpty
  quarter: '1/4',
  half: '1/2',
  three_quarters: '3/4',
  full: 'Full',              // i18n-pending: fuelFull
}

export default function OperatorDamageScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const language = useAuthStore(s => s.language)
  const { showToast } = useToastStore()

  // Same convention as both consumer inspection screens: mock mode pins the
  // one booking that has a seeded damage report.
  const bkId = Config.useMock ? 'bk-003' : (bookingId ?? '')

  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [pickup, setPickup] = useState<DamageReport | null>(null)
  const [returnReport, setReturnReport] = useState<DamageReport | null>(null)
  const [deposit, setDeposit] = useState<DepositState | null>(null)

  const [amountText, setAmountText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [charging, setCharging] = useState(false)
  const [chargeFailure, setChargeFailure] = useState<string | null>(null)
  // A ref, not the `charging` state: two taps inside one frame both read the
  // pre-render value of state, so state alone cannot stop a double charge.
  const chargeInFlight = useRef(false)

  const load = useCallback(async () => {
    if (!bkId) {
      setLoading(false)
      setLoadFailed(true)
      return
    }
    setLoading(true)
    setLoadFailed(false)
    try {
      const [b, p, r, d] = await Promise.all([
        fetchBooking(bkId),
        fetchDamageReport(bkId, 'pickup'),
        fetchDamageReport(bkId, 'return'),
        fetchDepositState(bkId),
      ])
      setBooking(b)
      setPickup(p)
      setReturnReport(r)
      setDeposit(d)
    } catch (e) {
      // A failed load here is a failed evidence lookup before a money decision.
      // It must reach Sentry, not just a toast.
      captureException(e, { screen: 'operator/damage', bookingId: bkId })
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [bkId])

  useEffect(() => { void load() }, [load])

  // The deposit row is authoritative; booking.deposit_amount is the fallback
  // for the (rare) case the deposit read came back empty.
  const depositCap = deposit?.depositAmount ?? booking?.deposit_amount ?? 0
  // A EUR 0 cap is decided FIRST and regardless of deposit_status. If the
  // deposit row could not be read we still fall back to booking.deposit_amount,
  // and a waiver booking must never be explained away as "not set up yet".
  const blockReason: DepositBlockReason | null =
    depositCap > 0 ? depositBlockReason(deposit) : 'waived'
  const canCharge = blockReason === null && depositCap > 0

  const parsedAmount = useMemo(() => {
    // es/hu keyboards produce a comma decimal separator.
    const normalized = amountText.replace(',', '.').trim()
    if (!normalized) return NaN
    return parseFloat(normalized)
  }, [amountText])

  const amountIsValid =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= depositCap

  const slotLabels: Record<PhotoKey, string> = useMemo(() => ({
    front: t('photoFront', language),
    back: t('photoBack', language),
    left: t('photoLeft', language),
    right: t('photoRight', language),
    interior: t('photoInterior', language),
    extra: t('photoExtra', language),
  }), [language])

  const photoPairs: DamageComparePair[] = useMemo(
    () => PHOTO_SLOTS.map(slot => ({
      key: slot.key,
      label: slotLabels[slot.key],
      before: (pickup?.[slot.field] as string | null | undefined) ?? null,
      after: (returnReport?.[slot.field] as string | null | undefined) ?? null,
    })),
    [pickup, returnReport, slotLabels],
  )

  const mileageDelta =
    typeof pickup?.mileage === 'number' && typeof returnReport?.mileage === 'number'
      ? returnReport.mileage - pickup.mileage
      : null

  const handleChargePress = () => {
    setChargeFailure(null)
    if (!canCharge) return
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      // i18n-pending: opDmgAmountInvalid
      showToast({ message: 'Enter an amount greater than zero.', type: 'error' })
      return
    }
    if (parsedAmount > depositCap) {
      showToast({
        // i18n-pending: opDmgAmountOverCap
        message: `The amount cannot exceed the deposit of ${formatEURDecimal(depositCap, language)}.`,
        type: 'error',
      })
      return
    }
    setShowConfirm(true)
  }

  const handleChargeConfirm = async () => {
    // Latch before any await. ConfirmSheet's confirm button has no disabled
    // state of its own, so this is what makes a double tap harmless.
    if (chargeInFlight.current) return
    chargeInFlight.current = true
    setShowConfirm(false)
    setCharging(true)
    setChargeFailure(null)
    try {
      const result = await chargeDeposit({
        bookingId: bkId,
        assessedAmount: parsedAmount,
        depositCap,
      })
      showToast({
        // i18n-pending: opDmgDepositCharged
        message: `Deposit charged: ${formatEURDecimal(result.charged_amount, language)}`,
        type: 'success',
      })
      setAmountText('')
      // Re-read so the card immediately reflects 'charged' rather than
      // offering a second charge the server would reject anyway.
      const refreshed = await fetchDepositState(bkId)
      setDeposit(refreshed)
    } catch (e) {
      // Never swallowed: the operator sees it inline AND it reaches Sentry with
      // the edge function's own status/code attached.
      const detail = e instanceof DepositChargeError ? e.message : t('cdmgSomethingWentWrong', language)
      captureException(e, {
        where: 'operator/damage.chargeDeposit',
        bookingId: bkId,
        assessedAmount: parsedAmount,
        depositCap,
        httpStatus: e instanceof DepositChargeError ? e.httpStatus : null,
        stripeCode: e instanceof DepositChargeError ? e.code : null,
      })
      setChargeFailure(detail)
      showToast({ message: detail, type: 'error' })
      // Pull the server's view back: a 402 leaves deposit_status='charge_failed'.
      try {
        setDeposit(await fetchDepositState(bkId))
      } catch (refreshError) {
        captureException(refreshError, { where: 'operator/damage.refreshDeposit', bookingId: bkId })
      }
    } finally {
      setCharging(false)
      chargeInFlight.current = false
    }
  }

  const headerTitle = t('opBkDamageReport', language)
  const backLabel = t('opBkBack', language)
  // i18n-pending: opDmgNotFiled
  const notFiledLabel = 'Not filed'

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScreenHeader title={headerTitle} backAccessibilityLabel={backLabel} />
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} />
          <Text style={styles.centeredText}>{t('opFleetLoading', language)}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (loadFailed) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScreenHeader title={headerTitle} backAccessibilityLabel={backLabel} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('cdmgSomethingWentWrong', language)}
          action={{ label: t('tryAgain', language), onPress: () => { void load() } }}
        />
      </SafeAreaView>
    )
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScreenHeader title={headerTitle} backAccessibilityLabel={backLabel} />
        <EmptyState icon="document-text-outline" title={t('opBkNotFound', language)} />
      </SafeAreaView>
    )
  }

  const hasAnyReport = !!pickup || !!returnReport

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={headerTitle}
        subtitle={booking.listing?.title ?? undefined}
        backAccessibilityLabel={backLabel}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Which inspections exist ─────────────────────────────────── */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{t('opBkInspection', language)}</Text>
            {returnReport && (
              <Badge
                label={returnReport.damage_found ? t('damageFound', language) : t('cdmgNoDamage', language)}
                variant={returnReport.damage_found ? 'error' : 'success'}
              />
            )}
          </View>
          <DetailRow
            label={t('pickupInspection', language)}
            value={pickup ? formatDate(pickup.created_at, language) : notFiledLabel}
            muted={!pickup}
          />
          <DetailRow
            label={t('returnInspection', language)}
            value={returnReport ? formatDate(returnReport.created_at, language) : notFiledLabel}
            muted={!returnReport}
          />
        </Card>

        {!hasAnyReport && (
          <Card style={styles.card}>
            <Text style={styles.emptyText}>{t('opBkDamageEmpty', language)}</Text>
          </Card>
        )}

        {/* ── Slot-by-slot photo comparison ───────────────────────────── */}
        {hasAnyReport && (
          <Card style={styles.card}>
            {/* i18n-pending: opDmgPhotoComparison */}
            <Text style={styles.cardTitle}>Photo comparison</Text>
            {!pickup && (
              /* i18n-pending: opDmgNoPickupBaseline */
              <Text style={styles.warnText}>
                No pickup inspection was filed, so there is no baseline to compare the return photos against.
              </Text>
            )}
            {!returnReport && (
              /* i18n-pending: opDmgNoReturnYet */
              <Text style={styles.warnText}>
                The return inspection has not been filed yet.
              </Text>
            )}
            <DamagePhotoCompare
              pairs={photoPairs}
              beforeLabel={t('opBkPickup', language)}
              afterLabel={t('opBkReturn', language)}
              /* i18n-pending: opDmgPhotoMissing */
              missingLabel="No photo"
            />
          </Card>
        )}

        {/* ── Mileage & fuel, pickup vs return ────────────────────────── */}
        {hasAnyReport && (
          <Card style={styles.card}>
            {/* i18n-pending: opDmgReadings */}
            <Text style={styles.cardTitle}>Mileage and fuel</Text>
            <DetailRow
              label={`${t('mileage', language)} — ${t('opBkPickup', language)}`}
              value={typeof pickup?.mileage === 'number' ? `${pickup.mileage}` : notFiledLabel}
              muted={typeof pickup?.mileage !== 'number'}
            />
            <DetailRow
              label={`${t('mileage', language)} — ${t('opBkReturn', language)}`}
              value={typeof returnReport?.mileage === 'number' ? `${returnReport.mileage}` : notFiledLabel}
              muted={typeof returnReport?.mileage !== 'number'}
            />
            {mileageDelta !== null && (
              <DetailRow
                /* i18n-pending: opDmgDifference */
                label="Difference"
                value={`${mileageDelta >= 0 ? '+' : ''}${mileageDelta} km`}
                highlight={mileageDelta < 0}
              />
            )}
            <DetailRow
              label={`${t('fuelLevel', language)} — ${t('opBkPickup', language)}`}
              value={pickup?.fuel_level ? FUEL_LABELS[pickup.fuel_level] : notFiledLabel}
              muted={!pickup?.fuel_level}
            />
            <DetailRow
              label={`${t('fuelLevel', language)} — ${t('opBkReturn', language)}`}
              value={returnReport?.fuel_level ? FUEL_LABELS[returnReport.fuel_level] : notFiledLabel}
              muted={!returnReport?.fuel_level}
            />
          </Card>
        )}

        {/* ── Notes ───────────────────────────────────────────────────── */}
        {hasAnyReport && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{t('cdmgGeneralNotes', language)}</Text>
            <NoteBlock
              title={t('pickupInspection', language)}
              notes={pickup?.notes ?? null}
              damageNotes={pickup?.damage_found ? pickup.damage_notes : null}
              emptyLabel={notFiledLabel}
            />
            <NoteBlock
              title={t('returnInspection', language)}
              notes={returnReport?.notes ?? null}
              damageNotes={returnReport?.damage_found ? returnReport.damage_notes : null}
              emptyLabel={notFiledLabel}
            />
          </Card>
        )}

        {/* ── Signatures from both parties, both inspections ──────────── */}
        {hasAnyReport && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{t('cdmgSignaturesTitle', language)}</Text>
            {pickup && (
              <SignaturePanel
                title={t('pickupInspection', language)}
                report={pickup}
                operatorLabel={t('cdmgOperatorSignature', language)}
                renterLabel={t('cdmgRenterSignature', language)}
              />
            )}
            {returnReport && (
              <SignaturePanel
                title={t('returnInspection', language)}
                report={returnReport}
                operatorLabel={t('cdmgOperatorSignature', language)}
                renterLabel={t('cdmgRenterSignature', language)}
              />
            )}
          </Card>
        )}

        {/* ── Deposit charge ──────────────────────────────────────────── */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t('deposit', language)}</Text>
          <DetailRow
            /* i18n-pending: opDmgMaxChargeable */
            label="Maximum chargeable"
            value={formatEURDecimal(depositCap, language)}
          />
          {!!deposit && deposit.depositChargedAmount > 0 && (
            <DetailRow
              /* i18n-pending: opDmgAlreadyCharged */
              label="Already charged"
              value={formatEURDecimal(deposit.depositChargedAmount, language)}
            />
          )}

          {blockReason !== null && (
            <View style={styles.blockBox}>
              <Text style={styles.blockText}>
                {blockExplanation(blockReason, depositCap, language)}
              </Text>
            </View>
          )}

          {canCharge && (
            <View style={styles.chargeSection}>
              {depositChargeFailed(deposit) && (
                /* i18n-pending: opDmgLastAttemptDeclined */
                <Text style={styles.warnText}>
                  The last attempt was declined by the card issuer. You can try again — if it keeps
                  failing, the renter has to sort their card out with their bank.
                </Text>
              )}
              {!returnReport && (
                /* i18n-pending: opDmgChargeWithoutReturn */
                <Text style={styles.warnText}>
                  No return inspection has been filed. Charging without one leaves the claim
                  without evidence if the renter disputes it.
                </Text>
              )}
              {!!returnReport && !returnReport.damage_found && (
                /* i18n-pending: opDmgChargeWithoutDamage */
                <Text style={styles.warnText}>
                  The return inspection recorded no damage. Only charge if you can document why.
                </Text>
              )}

              {/* i18n-pending: opDmgAmountLabel */}
              <Text style={styles.inputLabel}>Amount to charge</Text>
              <TextInput
                style={styles.amountInput}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                editable={!charging}
                placeholder={formatEURDecimal(0, language)}
                placeholderTextColor={C.textTertiary}
                /* i18n-pending: opDmgAmountA11y */
                accessibilityLabel="Amount to charge against the deposit"
              />
              <Text style={styles.helpText}>
                {/* i18n-pending: opDmgCappedAt */}
                {`Capped at the deposit of ${formatEURDecimal(depositCap, language)}.`}
              </Text>

              <Button
                /* i18n-pending: opDmgChargeFull */
                title="Use the full deposit"
                variant="ghost"
                onPress={() => setAmountText(String(depositCap))}
                disabled={charging}
                style={styles.fullDepositBtn}
              />

              {/* charge-deposit sets NO application_fee, so nothing is skimmed
                  off a damage charge — the whole amount is transferred to the
                  listing owner. Config.platformCut applies to the rental
                  PaymentIntent, not to this one. */}
              <Text style={styles.payoutNote}>
                {/* i18n-pending: opDmgNoPlatformFee */}
                The full amount is transferred to you. No platform fee is taken from a damage charge.
              </Text>

              {chargeFailure !== null && (
                <Text style={styles.errorText} accessibilityRole="alert">{chargeFailure}</Text>
              )}

              <Button
                /* i18n-pending: opDmgChargeDeposit */
                title="Charge deposit"
                variant="danger"
                onPress={handleChargePress}
                loading={charging}
                disabled={charging || !amountIsValid}
                fullWidth
                style={styles.chargeBtn}
              />
            </View>
          )}
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <ConfirmSheet
        visible={showConfirm}
        /* i18n-pending: opDmgConfirmTitle */
        title="Charge the deposit?"
        /* i18n-pending: opDmgConfirmMessage */
        message="This charges the renter's saved card immediately, against the damage documented above. It cannot be reversed from the app."
        /* i18n-pending: opDmgConfirmCta */
        confirmLabel={`Charge ${Number.isFinite(parsedAmount) ? formatEURDecimal(parsedAmount, language) : ''}`}
        confirmVariant="danger"
        details={[
          /* i18n-pending: opDmgAmountLabel */
          { label: 'Amount to charge', value: Number.isFinite(parsedAmount) ? formatEURDecimal(parsedAmount, language) : '' },
          { label: t('deposit', language), value: formatEURDecimal(depositCap, language) },
        ]}
        onConfirm={() => { void handleChargeConfirm() }}
        onCancel={() => setShowConfirm(false)}
      />
    </SafeAreaView>
  )
}

/**
 * Why the deposit cannot be charged, in the operator's terms.
 *
 * `waived` is the one that matters most: with deposit model B a renter who
 * bought the damage waiver has deposit_amount = 0, and the old behaviour would
 * have been a request that the edge function rejects with a bare 400. It has to
 * read as a product decision, not a broken screen.
 */
function blockExplanation(
  reason: DepositBlockReason,
  cap: number,
  language: 'en' | 'es' | 'hu',
): string {
  switch (reason) {
    case 'waived':
      // i18n-pending: opDmgBlockWaived
      return `This booking carries a ${formatEURDecimal(cap, language)} deposit because the renter paid for the damage waiver. There is nothing to charge here — settle any damage cost outside the app.`
    case 'no_card':
      // i18n-pending: opDmgBlockNoCard
      return 'No card was saved for this booking, so the deposit cannot be charged.'
    case 'already_charged':
      // i18n-pending: opDmgBlockAlreadyCharged
      return 'The deposit for this booking has already been charged. A booking can only be charged once.'
    case 'not_authorized':
    default:
      // i18n-pending: opDmgBlockNotAuthorized
      return 'The deposit is not in a chargeable state for this booking, so nothing can be charged here.'
  }
}

function DetailRow({
  label, value, muted, highlight,
}: { label: string; value: string; muted?: boolean; highlight?: boolean }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel} numberOfLines={2}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          muted === true && { color: C.textTertiary },
          highlight === true && { color: C.error },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

function NoteBlock({
  title, notes, damageNotes, emptyLabel,
}: { title: string; notes: string | null; damageNotes: string | null; emptyLabel: string }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.noteBlock}>
      <Text style={styles.noteTitle}>{title}</Text>
      <Text style={[styles.noteBody, !notes && { color: C.textTertiary }]}>
        {notes ?? emptyLabel}
      </Text>
      {!!damageNotes && (
        <Text style={[styles.noteBody, { color: C.error }]}>{damageNotes}</Text>
      )}
    </View>
  )
}

/**
 * Signatures are stored as base64 data URIs by SignatureCanvas, but both
 * columns are nullable — an inspection can be flagged signed without the image
 * ever being persisted. Render the image only when there is one.
 */
function SignaturePanel({
  title, report, operatorLabel, renterLabel,
}: { title: string; report: DamageReport; operatorLabel: string; renterLabel: string }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.noteBlock}>
      <Text style={styles.noteTitle}>{title}</Text>
      <View style={styles.sigRow}>
        <SignatureSlot label={operatorLabel} uri={report.operator_signature} signed={report.operator_signed} />
        <SignatureSlot label={renterLabel} uri={report.consumer_signature} signed={report.consumer_signed} />
      </View>
    </View>
  )
}

function SignatureSlot({ label, uri, signed }: { label: string; uri: string | null; signed: boolean }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.sigSlot}>
      <Text style={styles.sigLabel} numberOfLines={2}>{label}</Text>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.sigImage}
          contentFit="contain"
          accessible
          accessibilityLabel={label}
        />
      ) : (
        <View style={styles.sigPlaceholder}>
          <Text style={[styles.sigStatus, { color: signed ? C.success : C.textTertiary }]}>
            {/* i18n-pending: opDmgSigned / opDmgNotSigned */}
            {signed ? 'Signed' : 'Not signed'}
          </Text>
        </View>
      )}
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingTop: Spacing.base, paddingBottom: Spacing.xxxl },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    centeredText: {
      marginTop: Spacing.md,
      fontFamily: Fonts.regular,
      fontSize: 14,
      color: C.textSecondary,
    },

    card: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    cardTitle: {
      fontSize: 13,
      fontFamily: Fonts.bold,
      color: C.text,
      marginBottom: Spacing.md,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyText: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      color: C.textSecondary,
      lineHeight: 20,
    },

    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: C.borderLight,
      gap: Spacing.md,
    },
    detailLabel: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary },
    detailValue: { fontSize: 13, fontFamily: Fonts.semibold, color: C.text, textAlign: 'right' },

    noteBlock: { marginBottom: Spacing.md },
    noteTitle: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: C.textSecondary,
      marginBottom: Spacing.xs,
    },
    noteBody: { fontFamily: Fonts.regular, fontSize: 14, color: C.text, lineHeight: 20 },

    sigRow: { flexDirection: 'row', gap: Spacing.sm },
    sigSlot: { flex: 1 },
    sigLabel: {
      fontSize: 11,
      fontFamily: Fonts.regular,
      color: C.textTertiary,
      marginBottom: Spacing.xs,
    },
    sigImage: {
      height: 64,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.white,
    },
    sigPlaceholder: {
      height: 64,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceWarm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sigStatus: { fontSize: 13, fontFamily: Fonts.semibold },

    warnText: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      color: C.warning,
      lineHeight: 19,
      marginBottom: Spacing.md,
    },
    blockBox: {
      backgroundColor: C.infoSurface,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginTop: Spacing.md,
    },
    blockText: { fontFamily: Fonts.regular, fontSize: 13, color: C.text, lineHeight: 19 },

    chargeSection: { marginTop: Spacing.md },
    inputLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: C.textSecondary,
      marginBottom: Spacing.xs,
    },
    amountInput: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      fontFamily: Fonts.semibold,
      fontSize: 17,
      color: C.text,
    },
    helpText: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      color: C.textTertiary,
      marginTop: Spacing.xs,
    },
    fullDepositBtn: { marginTop: Spacing.md },
    payoutNote: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      color: C.textSecondary,
      lineHeight: 18,
      marginTop: Spacing.md,
    },
    errorText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: C.error,
      lineHeight: 19,
      marginTop: Spacing.md,
    },
    chargeBtn: { marginTop: Spacing.md },

    bottomSpacer: { height: Spacing.xxl },
  })
}
