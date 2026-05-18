import React, { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, Switch, TextInput, StyleSheet, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { DamagePhotoGrid } from '@/components/damage/DamagePhotoGrid'
import { SignatureCanvas } from '@/components/booking/SignatureCanvas'
import { Card } from '@/components/ui/Card'
import { createDamageReport } from '@/lib/api/damage'
import { uploadDamagePhoto } from '@/lib/storage'
import { useToastStore } from '@/lib/store/useToastStore'
import { getError } from '@/lib/errors'
import { Config } from '@/constants/config'
import type { PhotoSlot } from '@/components/damage/DamagePhotoGrid'
import type { FuelLevel } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

const FUEL_LEVELS: { key: FuelLevel; label: string }[] = [
  { key: 'empty', label: 'Empty' },
  { key: 'quarter', label: '¼' },
  { key: 'half', label: '½' },
  { key: 'three_quarters', label: '¾' },
  { key: 'full', label: 'Full' },
]

const REQUIRED_SLOTS: PhotoSlot[] = ['front', 'back', 'left', 'right', 'interior', 'extra']
const STEP_LABELS = ['Photos', 'Details', 'Signatures']

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
  return <Text style={{ fontSize: 12, color: C.error, fontWeight: '600', marginTop: 4, marginBottom: 4 }}>⚠ {message}</Text>
}

export default function PickupDamageScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const bkId = Config.useMock ? 'bk-003' : (bookingId ?? '')
  const { showToast } = useToastStore()

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
        errs.mileage = 'Enter current mileage'
      }
      if (damageFound && damageNotes.trim().length < 10) {
        errs.damageDescription = 'Describe the damage (min 10 characters)'
      }
    }
    if (s === 3) {
      if (!operatorSig) errs.operatorSignature = 'Operator signature required'
      if (!consumerSig) errs.consumerSignature = 'Your signature required'
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
        showToast({ message: 'Inspection complete! Both parties have signed.', type: 'success' })
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

      await createDamageReport({
        booking_id: bkId,
        listing_id: '',
        operator_id: '',
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
      showToast({ message: 'Pickup inspection completed! ✓', type: 'success' })
      router.back()
    } catch {
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
        : 'Next: Details →'
    }
    if (step === 2) return 'Next: Signatures →'
    if (!operatorSig || !consumerSig) return 'Sign first'
    return 'Submit inspection'
  })()

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title="Pickup Inspection"
        onBack={() => step > 1 ? setStep(s => s - 1) : router.back()}
        rightAction={
          <HelpTooltip
            title="Vehicle inspection"
            description={'Take photos before you drive away. This protects both you and the operator.'}
            faqs={[
              { q: 'Do I have to take all 6 photos?', a: 'Yes — front, back, both sides, interior, and one extra.' },
              { q: 'What if I find damage?', a: 'Toggle "Damage found" and describe it. Both parties sign.' },
            ]}
          />
        }
      />

      <StepIndicator totalSteps={3} currentStep={step} labels={STEP_LABELS} />

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 && (
          <>
            <Text style={styles.stepHint}>Take 6 photos of the vehicle from all angles</Text>
            <DamagePhotoGrid photos={photos} onPhoto={handlePhoto} />
            <FieldError message={errors.photos} />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.stepHint}>Record the vehicle condition details</Text>
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>Mileage & Fuel</Text>
              <TextInput
                style={[styles.mileageInput, errors.mileage && styles.inputError]}
                placeholder="Enter current mileage (km)"
                value={mileage}
                onChangeText={v => { setMileage(v); setErrors(prev => ({ ...prev, mileage: undefined })) }}
                keyboardType="numeric"
                placeholderTextColor={C.textTertiary}
                accessibilityLabel="Current mileage"
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
                <Text style={styles.damageLabel}>Any damage found?</Text>
                <Switch
                  value={damageFound}
                  onValueChange={v => { setDamageFound(v); setErrors(prev => ({ ...prev, damageDescription: undefined })) }}
                  trackColor={{ true: C.error, false: C.border }}
                  accessibilityLabel="Damage found toggle"
                />
              </View>
              {damageFound && (
                <>
                  <TextInput
                    style={[styles.textArea, errors.damageDescription && styles.inputError]}
                    placeholder="Describe the damage in detail..."
                    value={damageNotes}
                    onChangeText={v => { setDamageNotes(v); setErrors(prev => ({ ...prev, damageDescription: undefined })) }}
                    multiline
                    numberOfLines={4}
                    placeholderTextColor={C.textTertiary}
                    accessibilityLabel="Damage description"
                  />
                  <FieldError message={errors.damageDescription} />
                </>
              )}
            </Card>

            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>General Notes</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Any other notes..."
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
            <Text style={styles.stepHint}>Both parties sign to confirm the vehicle condition</Text>
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>Signatures</Text>
              <Text style={styles.sigSubtitle}>Both parties must sign to confirm the vehicle condition.</Text>
              <SignatureCanvas
                label="Operator Signature"
                onSave={v => { setOperatorSig(v); setErrors(prev => ({ ...prev, operatorSignature: undefined })) }}
                saved={!!operatorSig}
              />
              <FieldError message={errors.operatorSignature} />
              <SignatureCanvas
                label="Renter Signature"
                onSave={v => { setConsumerSig(v); setErrors(prev => ({ ...prev, consumerSignature: undefined })) }}
                saved={!!consumerSig}
              />
              <FieldError message={errors.consumerSignature} />
              <Text style={styles.sigConfirm}>
                I confirm this accurately reflects the vehicle condition at pickup.
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
        title="Submit inspection report?"
        message="Both parties have signed. This cannot be changed after submission."
        confirmLabel="Submit report"
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
    fontSize: 14, color: C.textSecondary,
    paddingHorizontal: Spacing.base, marginBottom: Spacing.base, lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: C.text,
    marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  mileageInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: Radius.lg,
    padding: Spacing.md, fontSize: 15, color: C.text, marginBottom: Spacing.sm,
  },
  inputError: { borderColor: C.error },
  fuelRow: { flexDirection: 'row', gap: Spacing.xs },
  fuelBtn: {
    flex: 1, padding: Spacing.sm, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  fuelBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  fuelText: { fontSize: 12, color: C.textSecondary, fontWeight: '600' },
  fuelTextActive: { color: C.textInverse },
  damageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  damageLabel: { fontSize: 15, color: C.text, fontWeight: '500' },
  textArea: {
    borderWidth: 1, borderColor: C.border, borderRadius: Radius.lg,
    padding: Spacing.md, fontSize: 14, color: C.text, minHeight: 80,
    textAlignVertical: 'top',
  },
  sigSubtitle: { fontSize: 13, color: C.textSecondary, marginBottom: Spacing.md },
  sigConfirm: { fontSize: 12, color: C.textTertiary, textAlign: 'center', lineHeight: 18 },
  })
}
