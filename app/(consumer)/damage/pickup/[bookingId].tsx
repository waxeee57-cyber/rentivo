import React, { useState } from 'react'
import {
  View, Text, ScrollView, Switch, TextInput, StyleSheet, Alert, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { DamagePhotoGrid } from '@/components/damage/DamagePhotoGrid'
import { SignatureCanvas } from '@/components/booking/SignatureCanvas'
import { Card } from '@/components/ui/Card'
import { createDamageReport } from '@/lib/api/damage'
import { uploadDamagePhoto } from '@/lib/storage'
import { Config } from '@/constants/config'
import type { PhotoSlot } from '@/components/damage/DamagePhotoGrid'
import type { FuelLevel } from '@/types'

const FUEL_LEVELS: { key: FuelLevel; label: string }[] = [
  { key: 'empty', label: 'Empty' },
  { key: 'quarter', label: '¼' },
  { key: 'half', label: '½' },
  { key: 'three_quarters', label: '¾' },
  { key: 'full', label: 'Full' },
]

export default function PickupDamageScreen() {
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

  const handlePhoto = (slot: PhotoSlot, uri: string) => {
    setPhotos(prev => ({ ...prev, [slot]: uri }))
  }

  const handleSubmit = async () => {
    if (!consumerSig) {
      Alert.alert('Signature required', 'Please add your signature to confirm.')
      return
    }
    setSubmitting(true)
    try {
      if (Config.useMock) {
        await new Promise(r => setTimeout(r, 1000))
        Alert.alert('Success', 'Pickup inspection completed!', [
          { text: 'OK', onPress: () => router.back() },
        ])
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

      Alert.alert('Success', 'Pickup inspection completed!', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e) {
      Alert.alert('Error', String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Pickup Inspection</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Document the vehicle condition before handover.</Text>

        <Text style={styles.sectionTitle}>Photos (6 required)</Text>
        <DamagePhotoGrid photos={photos} onPhoto={handlePhoto} />

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Mileage & Fuel</Text>
          <TextInput
            style={styles.mileageInput}
            placeholder="Enter current mileage (km)"
            value={mileage}
            onChangeText={setMileage}
            keyboardType="numeric"
            placeholderTextColor={Colors.textTertiary}
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
              trackColor={{ true: Colors.error, false: Colors.border }}
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
              placeholderTextColor={Colors.textTertiary}
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
            placeholderTextColor={Colors.textTertiary}
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
            I confirm this accurately reflects the vehicle condition at pickup.
          </Text>
        </Card>

        <Button
          title="Complete Pickup Inspection"
          onPress={handleSubmit}
          loading={submitting}
          fullWidth
          style={{ marginTop: Spacing.md }}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  back: { fontSize: 16, color: Colors.primary, fontWeight: '600', width: 50 },
  header: { fontSize: 18, fontWeight: '700', color: Colors.text },
  content: { paddingBottom: Spacing.xxxl },
  subtitle: { fontSize: 14, color: Colors.textSecondary, paddingHorizontal: Spacing.base, marginBottom: Spacing.base },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  mileageInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    padding: Spacing.md, fontSize: 15, color: Colors.text, marginBottom: Spacing.md,
  },
  fuelRow: { flexDirection: 'row', gap: Spacing.xs },
  fuelBtn: {
    flex: 1, padding: Spacing.sm, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  fuelBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  fuelText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  fuelTextActive: { color: Colors.textInverse },
  damageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  damageLabel: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  textArea: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    padding: Spacing.md, fontSize: 14, color: Colors.text, minHeight: 80,
    textAlignVertical: 'top',
  },
  sigSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.md },
  sigConfirm: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', lineHeight: 18 },
})
