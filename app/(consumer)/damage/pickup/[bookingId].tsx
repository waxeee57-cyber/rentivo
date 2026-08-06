import React, { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, Switch, TextInput, StyleSheet, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { DamagePhotoGrid } from '@/components/damage/DamagePhotoGrid'
import { SignatureCanvas } from '@/components/booking/SignatureCanvas'
import { Card } from '@/components/ui/Card'
import { createDamageReport, DamageReportExistsError } from '@/lib/api/damage'
import { uploadDamagePhoto } from '@/lib/storage'
import { useToastStore } from '@/lib/store/useToastStore'
import { getError } from '@/lib/errors'
import { Config } from '@/constants/config'
import type { PhotoSlot } from '@/components/damage/DamagePhotoGrid'
import type { FuelLevel } from '@/types'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { captureException } from '@/lib/sentry'

const FUEL_LEVELS: { key: FuelLevel; label: string }[] = [
  { key: 'empty', label: 'Empty' },
  { key: 'quarter', label: '¼' },
  { key: 'half', label: '½' },
  { key: 'three_quarters', label: '¾' },
  { key: 'full', label: 'Full' },
]

const REQUIRED_SLOTS: PhotoSlot[] = ['front', 'back', 'left', 'right', 'interior', 'extra']

interface ValidationErrors {
  photos?: string
  mileage?: string
  damageDescription?: string
  operatorSignature?: string
  consumerSignature?: string
}

function FieldError({ message }: { message: string | undefined }) {
  const C = useColors()
  if (!message) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 4 }}>
      <Ionicons name="warning-outline" size={12} color={C.error} importantForAccessibility="no" />
      <Text style={{ fontSize: 12, color: C.error, fontFamily: Fonts.semibold }}>{message}</Text>
    </View>
  )
}

export default function PickupDamageScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const bkId = Config.useMock ? 'bk-003' : (bookingId ?? '')
  const { showToast } = useToastStore()
  const { language } = useAuthStore()

  const [step, setStep] = useState(1)
  const [photos, setPhotos] = useState<Partial<Record<PhotoSlot, string | null>>>({})
  const [mileage, setMileage] = useState('')
  const [fuelLevel, setFuelLevel] = useState<FuelLevel>('full')
  const [damageFound, setDamageFound] = useState(false)
  const [damageNotes, setDamageNotes] = useState('')
  const [notes, setNotes] = useState('')
  const [operatorSig, setOperatorSig] = useState('')
  const [consumerSig, setConsumerSig] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})

  const handlePhoto = (slot: PhotoSlot, uri: string) => {
    setPhotos(prev => ({ ...prev, [slot]: uri }))
    if (errors.photos) setErrors(prev => ({ ...prev, photos: undefined }))
  }

  const validateStep = (s: number): ValidationErrors => {
    const errs: ValidationErrors = {}
    if (s === 1) {
      const filledPhotos = REQUIRED_SLOTS.filter(slot => photos[slot]).length
      if (filledPhotos < 6) {
        errs.photos = `${6 - filledPhotos} more photo${6 - filledPhotos > 1 ? 's' : ''} needed`
      }
    }
    if (s === 2) {
      if (!mileage || isNaN(Number(mileage))) {
        errs.mileage = t('cdmgEnterMileage', language)
      }
      if (damageFound && damageNotes.trim().length < 10) {
        errs.damageDescription = t('cdmgDescribeDamageMin', language)
      }
    }
    if (s === 3) {
      if (!operatorSig) errs.operatorSignature = t('cdmgOperatorSigRequired', language)
      if (!consumerSig) errs.consumerSignature = t('cdmgConsumerSigRequired', language)
    }
    return errs
  }

  const handleNext = () => {
    const errs = validateStep(step)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    if (step === 3) {
      setShowConfirm(true)
      return
    }
    if (step < 3) setStep(s => s + 1)
  }

  const handleSubmit = async () => {
    setShowConfirm(false)
    const finalErrors = validateStep(3)
    if (Object.keys(finalErrors).length > 0) {
      setErrors(finalErrors)
      return
    }
    setSubmitting(true)
    try {
      if (Config.useMock) {
        await new Promise<void>(r => setTimeout(r, 1000))
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        showToast({ message: t('cdmgInspectionComplete', language), type: 'success' })
        router.back()
        return
      }

      const uploadedPhotos: Partial<Record<PhotoSlot, string>> = {}
      for (const [slot, uri] of Object.entries(photos)) {
        if (uri) {
          const url = await uploadDamagePhoto(bkId, 'pickup', slot, uri)
          if (url) uploadedPhotos[slot as PhotoSlot] = url
        }
      }

      // `listing_id` / `operator_id` are deliberately absent. They were empty
      // strings here, and both are UUID columns, so Postgres rejected EVERY
      // insert with "invalid input syntax for type uuid" - after all six
      // photos had already uploaded - and the bare `catch` below turned it
      // into a generic toast. No damage report has ever been stored, and every
      // deposit dispute has had zero evidence behind it. `createDamageReport`
      // now derives both from the booking and no longer accepts them, so this
      // screen cannot reintroduce the bug.
      await createDamageReport({
        booking_id: bkId,
        type: 'pickup',
        photo_front: uploadedPhotos.front ?? null,
        photo_back: uploadedPhotos.back ?? null,
        photo_left: uploadedPhotos.left ?? null,
        photo_right: uploadedPhotos.right ?? null,
        photo_interior: uploadedPhotos.interior ?? null,
        photo_extra: uploadedPhotos.extra ?? null,
        mileage: mileage ? parseInt(mileage) : null,
        fuel_level: fuelLevel,
        notes: notes || null,
        damage_found: damageFound,
        damage_notes: damageNotes || null,
        operator_signed: !!operatorSig,
        consumer_signed: !!consumerSig,
        operator_signature: operatorSig || null,
        consumer_signature: consumerSig || null,
        signed_at: consumerSig ? new Date().toISOString() : null,
      })

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: t('cdmgPickupComplete', language), type: 'success' })
      router.back()
    } catch (e) {
      // "Already filed" is the correct answer to a second submission (a back
      // navigation, a double tap, two staff members at the same counter), not a
      // fault to report. Say so plainly rather than showing "something went
      // wrong" after six photos have finished uploading.
      if (e instanceof DamageReportExistsError) {
        showToast({
          // i18n-pending: cdmgInspectionAlreadyFiled
          message: 'This inspection has already been filed for this booking.',
          type: 'error',
        })
        router.back()
        return
      }
      // The bare `catch` here is what hid the UUID bug above for as long as it
      // existed: six photos uploaded, the row rejected, and a generic toast.
      // Report it so the next failure of this kind is visible in Sentry rather
      // than only in a renter's confusion at the counter.
      captureException(e, { screen: 'damage/pickup', bookingId: bkId })
      showToast({ message: getError('server_error'), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const filledPhotoCount = REQUIRED_SLOTS.filter(s => photos[s]).length

  const nextLabel = (() => {
    if (step === 1) {
      return filledPhotoCount < 6
        ? `${filledPhotoCount}/6 photos · Need ${6 - filledPhotoCount} more`
        : t('cdmgNextDetails', language)
    }
    if (step === 2) return t('cdmgNextSignatures', language)
    if (!operatorSig || !consumerSig) return t('cdmgSignFirst', language)
    return t('cdmgSubmitInspectionBtn', language)
  })()

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={t('pickupInspection', language)}
        onBack={() => step > 1 ? setStep(s => s - 1) : router.back()}
        rightAction={
          <HelpTooltip
            title={t('cdmgVehicleInspection', language)}
            description={t('cdmgHelpTakePhotos', language)}
            faqs={[
              { q: t('cdmgHelp6PhotosQ', language), a: t('cdmgHelp6PhotosA', language) },
              { q: t('cdmgHelpDamageFoundQ', language), a: t('cdmgHelpDamageFoundA', language) },
            ]}
          />
        }
      />

      <StepIndicator
        totalSteps={3}
        currentStep={step}
        labels={[t('cdmgStepPhotos', language), t('cdmgStepDetails', language), t('cdmgSignaturesTitle', language)]}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 && (
          <>
            <Text style={styles.stepHint}>{t('cdmgTake6Photos', language)}</Text>
            <DamagePhotoGrid photos={photos} onPhoto={handlePhoto} />
            <FieldError message={errors.photos} />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.stepHint}>{t('cdmgRecordCondition', language)}</Text>
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>{t('cdmgMileageAndFuel', language)}</Text>
              <TextInput
                style={[styles.mileageInput, errors.mileage && styles.inputError]}
                placeholder={t('cdmgMileagePlaceholder', language)}
                value={mileage}
                onChangeText={v => { setMileage(v); setErrors(prev => ({ ...prev, mileage: undefined })) }}
                keyboardType="numeric"
                placeholderTextColor={C.textTertiary}
                accessibilityLabel={t('cdmgCurrentMileageA11y', language)}
              />
              <FieldError message={errors.mileage} />
              <View style={styles.fuelRow}>
                {FUEL_LEVELS.map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.fuelBtn, fuelLevel === f.key && styles.fuelBtnActive]}
                    onPress={() => setFuelLevel(f.key)}
                    accessibilityLabel={`Fuel level: ${f.label}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: fuelLevel === f.key }}
                  >
                    <Text style={[styles.fuelText, fuelLevel === f.key && styles.fuelTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            <Card style={styles.card}>
              <View style={styles.damageRow}>
                <Text style={styles.damageLabel}>{t('cdmgAnyDamageFound', language)}</Text>
                <Switch
                  value={damageFound}
                  onValueChange={v => { setDamageFound(v); setErrors(prev => ({ ...prev, damageDescription: undefined })) }}
                  trackColor={{ true: C.error, false: C.border }}
                  accessibilityLabel={t('cdmgDamageFoundToggle', language)}
                />
              </View>
              {damageFound && (
                <>
                  <TextInput
                    style={[styles.textArea, errors.damageDescription && styles.inputError]}
                    placeholder={t('cdmgDescribeDamageDetail', language)}
                    value={damageNotes}
                    onChangeText={v => { setDamageNotes(v); setErrors(prev => ({ ...prev, damageDescription: undefined })) }}
                    multiline
                    numberOfLines={4}
                    placeholderTextColor={C.textTertiary}
                    accessibilityLabel={t('cdmgDamageDescriptionA11y', language)}
                  />
                  <FieldError message={errors.damageDescription} />
                </>
              )}
            </Card>

            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>{t('cdmgGeneralNotes', language)}</Text>
              <TextInput
                style={styles.textArea}
                placeholder={t('cdmgAnyOtherNotes', language)}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholderTextColor={C.textTertiary}
              />
            </Card>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.stepHint}>{t('cdmgBothPartiesSignHint', language)}</Text>
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>{t('cdmgSignaturesTitle', language)}</Text>
              <Text style={styles.sigSubtitle}>{t('cdmgBothPartiesMustSign', language)}</Text>
              <SignatureCanvas
                label={t('cdmgOperatorSignature', language)}
                onSave={v => { setOperatorSig(v); setErrors(prev => ({ ...prev, operatorSignature: undefined })) }}
                saved={!!operatorSig}
              />
              <FieldError message={errors.operatorSignature} />
              <SignatureCanvas
                label={t('cdmgRenterSignature', language)}
                onSave={v => { setConsumerSig(v); setErrors(prev => ({ ...prev, consumerSignature: undefined })) }}
                saved={!!consumerSig}
              />
              <FieldError message={errors.consumerSignature} />
              <Text style={styles.sigConfirm}>
                {t('cdmgSignConfirmPickup', language)}
              </Text>
            </Card>
          </>
        )}

        <Button
          title={nextLabel}
          onPress={handleNext}
          loading={submitting}
          fullWidth
          disabled={step === 1 && filledPhotoCount < 6}
          style={{ marginTop: Spacing.md, marginHorizontal: Spacing.base }}
        />
        <View style={{ height: 40 }} />
      </ScrollView>

      <ConfirmSheet
        visible={showConfirm}
        title={t('cdmgSubmitInspectionTitle', language)}
        message={t('cdmgBothPartiesSigned', language)}
        confirmLabel={t('cdmgSubmitReport', language)}
        onConfirm={() => void handleSubmit()}
        onCancel={() => setShowConfirm(false)}
      />
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingBottom: Spacing.xxxl },
  stepHint: {
    fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary,
    paddingHorizontal: Spacing.base, marginBottom: Spacing.base, lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13, fontFamily: Fonts.bold, color: C.text,
    marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  mileageInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: Radius.lg,
    padding: Spacing.md, fontFamily: Fonts.regular, fontSize: 15, color: C.text, marginBottom: Spacing.sm,
  },
  inputError: { borderColor: C.error },
  fuelRow: { flexDirection: 'row', gap: Spacing.xs },
  fuelBtn: {
    flex: 1, padding: Spacing.sm, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  fuelBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  fuelText: { fontSize: 12, color: C.textSecondary, fontFamily: Fonts.semibold },
  fuelTextActive: { color: C.textInverse },
  damageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  damageLabel: { fontSize: 15, color: C.text, fontFamily: Fonts.medium },
  textArea: {
    borderWidth: 1, borderColor: C.border, borderRadius: Radius.lg,
    padding: Spacing.md, fontFamily: Fonts.regular, fontSize: 14, color: C.text, minHeight: 80,
    textAlignVertical: 'top',
  },
  sigSubtitle: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, marginBottom: Spacing.md },
  sigConfirm: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, textAlign: 'center', lineHeight: 18 },
  })
}
