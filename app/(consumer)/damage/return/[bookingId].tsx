import React, { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, Switch, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { DamagePhotoGrid } from '@/components/damage/DamagePhotoGrid'
import { SignatureCanvas } from '@/components/booking/SignatureCanvas'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { Card } from '@/components/ui/Card'
import { createDamageReport, fetchDamageReport } from '@/lib/api/damage'
import { uploadDamagePhoto } from '@/lib/storage'
import { useToastStore } from '@/lib/store/useToastStore'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import type { PhotoSlot } from '@/components/damage/DamagePhotoGrid'
import type { FuelLevel } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

const REQUIRED_SLOTS: PhotoSlot[] = ['front', 'back', 'left', 'right', 'interior', 'extra']

const FUEL_LEVELS: { key: FuelLevel; label: string }[] = [
  { key: 'empty', label: 'Empty' },
  { key: 'quarter', label: '¼' },
  { key: 'half', label: '½' },
  { key: 'three_quarters', label: '¾' },
  { key: 'full', label: 'Full' },
]

export default function ReturnDamageScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const bkId = Config.useMock ? 'bk-003' : (bookingId ?? '')

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
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<{ has_damage: boolean; analysis: string } | null>(null)
  const { showToast } = useToastStore()

  const handlePhoto = (slot: PhotoSlot, uri: string) => {
    setPhotos(prev => ({ ...prev, [slot]: uri }))
  }

  const runAIDamageCheck = async (beforeUrl: string, afterUrl: string) => {
    setAiAnalyzing(true)
    try {
      const { data, error } = await supabase.functions.invoke('damage-detector', {
        body: { before_image_url: beforeUrl, after_image_url: afterUrl },
      })
      if (!error && data) {
        setAiResult({ has_damage: data.has_damage as boolean, analysis: data.analysis as string })
      }
    } finally {
      setAiAnalyzing(false)
    }
  }

  const handleSubmitPress = () => {
    const missing = REQUIRED_SLOTS.filter(s => !photos[s])
    if (missing.length > 0) {
      showToast({ message: `Please take all 6 photos (${missing.length} remaining)`, type: 'error' })
      return
    }
    if (!operatorSig || !consumerSig) {
      showToast({ message: 'Both signatures required before submitting.', type: 'error' })
      return
    }
    setShowConfirm(true)
  }

  const handleSubmit = async () => {
    setShowConfirm(false)
    setSubmitting(true)
    try {
      if (Config.useMock) {
        await new Promise(r => setTimeout(r, 1000))
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        showToast({ message: 'Return inspection complete! ✓', type: 'success' })
        router.back()
        return
      }

      const uploadedPhotos: Partial<Record<PhotoSlot, string>> = {}
      for (const [slot, uri] of Object.entries(photos)) {
        if (uri) {
          const url = await uploadDamagePhoto(bkId, 'return', slot, uri)
          if (url) uploadedPhotos[slot as PhotoSlot] = url
        }
      }

      await createDamageReport({
        booking_id: bkId,
        listing_id: '',
        operator_id: '',
        type: 'return',
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

      // Run AI damage comparison if both before and after front photos are available
      const pickupReport = await fetchDamageReport(bkId, 'pickup')
      const beforeUrl = pickupReport?.photo_front ?? null
      const afterUrl = uploadedPhotos.front ?? null
      if (beforeUrl && afterUrl) {
        void runAIDamageCheck(beforeUrl, afterUrl)
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: 'Return inspection complete! ✓', type: 'success' })
      router.back()
    } catch {
      showToast({ message: 'Something went wrong. Please try again.', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Return Inspection" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Document the vehicle condition at return.</Text>

        <Text style={styles.sectionTitle}>Photos (6 required)</Text>
        <DamagePhotoGrid photos={photos} onPhoto={handlePhoto} />

        {aiAnalyzing && (
          <View style={styles.aiLoadingContainer}>
            <ActivityIndicator color={C.primary} />
            <Text style={styles.aiLoadingText}>AI analyzing photos...</Text>
          </View>
        )}
        {aiResult && (
          <View style={[
            styles.aiResultContainer,
            { backgroundColor: aiResult.has_damage ? C.errorSurface : C.successSurface },
          ]}>
            <Text style={[
              styles.aiResultTitle,
              { color: aiResult.has_damage ? C.error : C.success },
            ]}>
              {aiResult.has_damage ? 'Damage Detected' : 'No New Damage'}
            </Text>
            <Text style={styles.aiResultText}>{aiResult.analysis}</Text>
          </View>
        )}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Mileage & Fuel</Text>
          <TextInput
            style={styles.mileageInput}
            placeholder="Enter current mileage (km)"
            value={mileage}
            onChangeText={setMileage}
            keyboardType="numeric"
            placeholderTextColor={C.textTertiary}
          />
          <View style={styles.fuelRow}>
            {FUEL_LEVELS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.fuelBtn, fuelLevel === f.key && styles.fuelBtnActive]}
                onPress={() => setFuelLevel(f.key)}
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
              onValueChange={setDamageFound}
              trackColor={{ true: C.error, false: C.border }}
            />
          </View>
          {damageFound && (
            <TextInput
              style={styles.textArea}
              placeholder="Describe the damage..."
              value={damageNotes}
              onChangeText={setDamageNotes}
              multiline
              numberOfLines={4}
              placeholderTextColor={C.textTertiary}
            />
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

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Signatures</Text>
          <Text style={styles.sigSubtitle}>Both parties must sign to confirm the vehicle condition.</Text>
          <SignatureCanvas
            label="Operator Signature"
            onSave={setOperatorSig}
            saved={!!operatorSig}
          />
          <SignatureCanvas
            label="Renter Signature"
            onSave={setConsumerSig}
            saved={!!consumerSig}
          />
          <Text style={styles.sigConfirm}>
            I confirm this accurately reflects the vehicle condition at return.
          </Text>
        </Card>

        <Button
          title="Complete Return Inspection"
          onPress={handleSubmitPress}
          loading={submitting}
          fullWidth
          style={{ marginTop: Spacing.md }}
        />
        <View style={{ height: 40 }} />
      </ScrollView>

      <ConfirmSheet
        visible={showConfirm}
        title="Submit return inspection?"
        message="Both parties have signed. This cannot be changed after submission."
        confirmLabel="Submit report"
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirm(false)}
      />
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingBottom: Spacing.xxxl },
  subtitle: { fontSize: 14, color: C.textSecondary, paddingHorizontal: Spacing.base, marginBottom: Spacing.base },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  mileageInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: Radius.lg,
    padding: Spacing.md, fontSize: 15, color: C.text, marginBottom: Spacing.md,
  },
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
  aiLoadingContainer: { padding: Spacing.base, alignItems: 'center' as const },
  aiLoadingText: { color: C.textSecondary, marginTop: Spacing.sm, fontSize: 14 },
  aiResultContainer: { borderRadius: Radius.lg, padding: Spacing.base, marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  aiResultTitle: { fontSize: 16, fontWeight: '700' as const, marginBottom: Spacing.xs },
  aiResultText: { color: C.text, fontSize: 14, lineHeight: 20 },
  })
}
