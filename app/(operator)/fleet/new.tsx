import React, { useState, useMemo } from 'react'
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
import { WhatNextScreen } from '@/components/ui/WhatNextScreen'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CategoryPill } from '@/components/ui/CategoryPill'
import { CATEGORIES } from '@/constants/categories'
import { createListing } from '@/lib/api/listings'
import { uploadListingPhotos } from '@/lib/storage'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useCamera } from '@/lib/hooks/useCamera'
import { useToastStore } from '@/lib/store/useToastStore'
import { getError } from '@/lib/errors'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import type { RentalCategory } from '@/types'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'

const FEATURE_OPTIONS = ['AC', 'GPS', 'Bluetooth', 'USB', 'Leather seats', 'Sunroof', 'Convertible', '4WD', 'Child seat']

export default function NewListingScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { operator, language } = useAuthStore()
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
  const [strNumber, setStrNumber] = useState('')
  const [published, setPublished] = useState(false)

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
        setPublished(true)
        return
      }
      // The picker's `file://` URIs are meaningless off this device. They used
      // to be written straight into the listing, so every photo was broken for
      // every renter while still rendering for the operator who uploaded it.
      const photoUrls = await uploadListingPhotos(opId, photos)

      await createListing({
        operator_id: opId,
        title,
        description: description || null,
        category,
        subcategory: null,
        price_per_day: Math.round(parseFloat(pricePerDay)),
        price_per_week: null,
        deposit_amount: Math.round(parseFloat(deposit || '0')),
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
        images: photoUrls,
        cover_image_url: photoUrls[0] ?? null,
        pickup_address: null,
        latitude: null,
        longitude: null,
        str_registration_number: strNumber.trim() || null,
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setPublished(true)
    } catch {
      showToast({ message: getError('server_error'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (published) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: Spacing.xl }}>
          <View style={styles.publishedCircle}>
            <Text style={styles.publishedCheck}>✓</Text>
          </View>
          <Text style={styles.publishedTitle}>{t('opFleetVehicleLive', language)}</Text>
          <Text style={styles.publishedSub}>{t('opFleetVehicleLiveSub', language)}</Text>
          <WhatNextScreen
            steps={[
              { icon: 'notifications-outline', text: t('opFleetNextStep1', language) },
              { icon: 'checkmark-outline', text: t('opFleetNextStep2', language) },
              { icon: 'cash-outline', text: t('opFleetNextStep3', language) },
              { icon: 'sync-outline', text: t('opFleetNextStep4', language) },
            ]}
            primaryAction={{
              label: t('opFleetGoToFleet', language),
              onPress: () => router.replace('/(operator)/fleet'),
            }}
            secondaryAction={{
              label: t('opFleetViewBookings', language),
              onPress: () => router.replace('/(operator)/bookings'),
            }}
          />
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={t('addVehicle', language)}
        onBack={() => step > 1 ? setStep(s => s - 1) : router.back()}
      />
      <StepIndicator
        totalSteps={4}
        currentStep={step}
        labels={[
          t('opFleetStepInfo', language),
          t('opFleetStepPrice', language),
          t('opFleetPhotos', language),
          t('opFleetStepDetails', language),
        ]}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>{t('opFleetStepBasicInfo', language)}</Text>
            <Text style={styles.fieldLabel}>{t('opFleetCategory', language)}</Text>
            <View style={styles.categories}>
              {CATEGORIES.map(c => (
                <CategoryPill
                  key={c.key}
                  label={c.label}
                  icon={c.icon}
                  active={category === c.key}
                  onPress={() => setCategory(c.key)}
                  style={{ marginBottom: Spacing.sm }}
                />
              ))}
            </View>
            <Input label={t('opFleetTitleLabel', language)} value={title} onChangeText={setTitle} placeholder={t('opFleetTitlePlaceholder', language)} />
            <Input label={t('opFleetMake', language)} value={make} onChangeText={setMake} placeholder={t('opFleetMakePlaceholder', language)} />
            <Input label={t('opFleetModel', language)} value={model} onChangeText={setModel} placeholder={t('opFleetModelPlaceholder', language)} />
            <Input label={t('opFleetYear', language)} value={year} onChangeText={setYear} placeholder={t('opFleetYearPlaceholder', language)} keyboardType="numeric" />
            <Button
              title={t('opFleetContinue', language)}
              onPress={() => {
                if (!title.trim()) { showToast({ message: t('opFleetToastEnterTitle', language), type: 'error' }); return }
                setStep(2)
              }}
              fullWidth
              style={{ marginTop: Spacing.md }}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>{t('opFleetStepPricing', language)}</Text>
            <Input label={t('opFleetPricePerDayReq', language)} value={pricePerDay} onChangeText={setPricePerDay} placeholder="85" keyboardType="decimal-pad" />
            <Input label={t('opFleetDepositLabel', language)} value={deposit} onChangeText={setDeposit} placeholder="500" keyboardType="decimal-pad" />
            <Button
              title={t('opFleetContinue', language)}
              onPress={() => {
                if (!pricePerDay) { showToast({ message: t('opFleetToastEnterPrice', language), type: 'error' }); return }
                setStep(3)
              }}
              fullWidth
              style={{ marginTop: Spacing.md }}
            />
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.stepTitle}>{t('opFleetPhotos', language)}</Text>
            <Text style={styles.fieldLabel}>{t('opFleetAddPhotos', language)}</Text>
            <View style={styles.photoGrid}>
              {Array.from({ length: 6 }, (_, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.photoSlot}
                  onPress={() => handlePickPhoto(i)}
                  accessibilityRole="button"
                  accessibilityLabel={photos[i] ? `${t('opFleetChangePhoto', language)} ${i + 1}` : `${t('opFleetAddPhoto', language)} ${i + 1}`}
                >
                  {photos[i] ? (
                    <Image source={{ uri: photos[i]! }} style={styles.photoSlotImage} contentFit="cover" />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={24} color={C.textTertiary} />
                      <Text style={styles.photoSlotLabel}>
                        {i === 0 ? t('opFleetPhotoCover', language) : `${t('opFleetPhotoN', language)} ${i + 1}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Button title={t('opFleetContinue', language)} onPress={() => setStep(4)} fullWidth style={{ marginTop: Spacing.md }} />
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.stepTitle}>{t('opFleetDetailsFeatures', language)}</Text>
            <Input label={t('opFleetDescription', language)} value={description} onChangeText={setDescription} placeholder={t('opFleetDescPlaceholder2', language)} multiline numberOfLines={4} />
            {category === 'villa' && (
              <>
                <Text style={styles.fieldLabel}>
                  {t('opFleetStrNumber', language)}
                </Text>
                <Text style={styles.strHint}>
                  {t('opFleetStrHint', language)}
                </Text>
                <Input
                  label=""
                  value={strNumber}
                  onChangeText={setStrNumber}
                  placeholder="HU-12345-678"
                  accessibilityLabel={t('opFleetStrNumber', language)}
                />
              </>
            )}
            <Text style={styles.fieldLabel}>{t('opFleetFeatures', language)}</Text>
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
            <Button title={t('opFleetPublish', language)} onPress={handlePublish} loading={saving} fullWidth style={{ marginTop: Spacing.xl }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  stepTitle: { fontSize: 22, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.xl },
  fieldLabel: { fontSize: 12, fontFamily: Fonts.bold, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  categories: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.base },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  strHint: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary, marginBottom: Spacing.sm, lineHeight: 18 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  photoSlot: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 4,
  },
  photoSlotImage: { width: '100%', height: '100%' },
  photoSlotLabel: { fontSize: 10, color: C.textTertiary, fontFamily: Fonts.semibold },
  publishedCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 3,
    borderColor: C.success,
  },
  publishedCheck: { fontFamily: Fonts.regular, fontSize: 48, color: C.success },
  publishedTitle: {
    fontSize: 26,
    fontFamily: Fonts.extrabold,
    color: C.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  publishedSub: {
    fontFamily: Fonts.regular, fontSize: 15,
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  })
}
