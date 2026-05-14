import React, { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CategoryPill } from '@/components/ui/CategoryPill'
import { CATEGORIES } from '@/constants/categories'
import { createListing } from '@/lib/api/listings'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useCamera } from '@/lib/hooks/useCamera'
import { useToastStore } from '@/lib/store/useToastStore'
import { getError } from '@/lib/errors'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import type { RentalCategory } from '@/types'

const FEATURE_OPTIONS = ['AC', 'GPS', 'Bluetooth', 'USB', 'Leather seats', 'Sunroof', 'Convertible', '4WD', 'Child seat']

export default function NewListingScreen() {
  const { operator } = useAuthStore()
  const { showPhotoOptions } = useCamera()
  const { showToast } = useToastStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? '')

  const [step, setStep] = useState(1)
  const [category, setCategory] = useState<RentalCategory>('car')
  const [title, setTitle] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [pricePerDay, setPricePerDay] = useState('')
  const [deposit, setDeposit] = useState('')
  const [description, setDescription] = useState('')
  const [features, setFeatures] = useState<string[]>([])
  const [photos, setPhotos] = useState<(string | null)[]>(Array(6).fill(null))
  const [saving, setSaving] = useState(false)

  const toggleFeature = (f: string) => {
    setFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  const handlePickPhoto = async (index: number) => {
    const uri = await showPhotoOptions()
    if (uri) {
      setPhotos(prev => {
        const next = [...prev]
        next[index] = uri
        return next
      })
    }
  }

  const handlePublish = async () => {
    if (!title.trim()) {
      showToast({ message: getError('name_required'), type: 'error' })
      return
    }
    if (!pricePerDay) {
      showToast({ message: getError('required_field'), type: 'error' })
      return
    }
    setSaving(true)
    try {
      if (Config.useMock) {
        await new Promise(r => setTimeout(r, 800))
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        showToast({ message: 'Your vehicle is now live! 🎉', type: 'success' })
        router.back()
        return
      }
      await createListing({
        operator_id: opId,
        title,
        description: description || null,
        category,
        subcategory: null,
        price_per_day: Math.round(parseFloat(pricePerDay) * 100),
        price_per_week: null,
        deposit_amount: Math.round(parseFloat(deposit || '0') * 100),
        currency: 'EUR',
        available: true,
        min_rental_days: 1,
        max_rental_days: null,
        capacity: null,
        year: year ? parseInt(year) : null,
        make: make || null,
        model: model || null,
        color: null,
        license_plate: null,
        features,
        rules: null,
        images: photos.filter(Boolean) as string[],
        cover_image_url: photos.find(Boolean) ?? null,
        pickup_address: null,
        latitude: null,
        longitude: null,
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: 'Your vehicle is now live! 🎉', type: 'success' })
      router.back()
    } catch {
      showToast({ message: getError('server_error'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title="Add Vehicle"
        onBack={() => step > 1 ? setStep(s => s - 1) : router.back()}
      />
      <StepIndicator
        totalSteps={4}
        currentStep={step}
        labels={['Info', 'Price', 'Photos', 'Details']}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Basic Info</Text>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categories}>
              {CATEGORIES.map(c => (
                <CategoryPill
                  key={c.key}
                  label={c.label}
                  emoji={c.emoji}
                  active={category === c.key}
                  onPress={() => setCategory(c.key)}
                  style={{ marginBottom: Spacing.sm }}
                />
              ))}
            </View>
            <Input label="Title *" value={title} onChangeText={setTitle} placeholder="e.g. BMW 3 Series 2023" />
            <Input label="Make" value={make} onChangeText={setMake} placeholder="e.g. BMW" />
            <Input label="Model" value={model} onChangeText={setModel} placeholder="e.g. 3 Series" />
            <Input label="Year" value={year} onChangeText={setYear} placeholder="e.g. 2023" keyboardType="numeric" />
            <Button
              title="Continue →"
              onPress={() => {
                if (!title.trim()) { showToast({ message: 'Please enter a title for your vehicle.', type: 'error' }); return }
                setStep(2)
              }}
              fullWidth
              style={{ marginTop: Spacing.md }}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>Pricing</Text>
            <Input label="Price per day (€) *" value={pricePerDay} onChangeText={setPricePerDay} placeholder="85" keyboardType="decimal-pad" />
            <Input label="Security deposit (€)" value={deposit} onChangeText={setDeposit} placeholder="500" keyboardType="decimal-pad" />
            <Button
              title="Continue →"
              onPress={() => {
                if (!pricePerDay) { showToast({ message: 'Please enter a price per day.', type: 'error' }); return }
                setStep(3)
              }}
              fullWidth
              style={{ marginTop: Spacing.md }}
            />
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.stepTitle}>Photos</Text>
            <Text style={styles.fieldLabel}>Add vehicle photos</Text>
            <View style={styles.photoGrid}>
              {Array.from({ length: 6 }, (_, i) => (
                <TouchableOpacity key={i} style={styles.photoSlot} onPress={() => handlePickPhoto(i)}>
                  {photos[i] ? (
                    <Image source={{ uri: photos[i]! }} style={styles.photoSlotImage} contentFit="cover" />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={24} color={Colors.textTertiary} />
                      <Text style={styles.photoSlotLabel}>{i === 0 ? 'Cover' : `Photo ${i + 1}`}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Continue →" onPress={() => setStep(4)} fullWidth style={{ marginTop: Spacing.md }} />
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.stepTitle}>Details & Features</Text>
            <Input label="Description" value={description} onChangeText={setDescription} placeholder="Tell renters about this vehicle..." multiline numberOfLines={4} />
            <Text style={styles.fieldLabel}>Features</Text>
            <View style={styles.featureGrid}>
              {FEATURE_OPTIONS.map(f => (
                <CategoryPill
                  key={f}
                  label={f}
                  active={features.includes(f)}
                  onPress={() => toggleFeature(f)}
                  style={{ marginBottom: Spacing.sm }}
                />
              ))}
            </View>
            <Button title="Publish listing" onPress={handlePublish} loading={saving} fullWidth style={{ marginTop: Spacing.xl }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  stepTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: Spacing.xl },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  categories: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.base },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  photoSlot: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 4,
  },
  photoSlotImage: { width: '100%', height: '100%' },
  photoSlotLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600' },
})
