import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Spacing, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { WhatNextScreen } from '@/components/ui/WhatNextScreen'
import { useCamera } from '@/lib/hooks/useCamera'
import { supabase } from '@/lib/supabase'
import { createListing } from '@/lib/api/listings'
import { useToastStore } from '@/lib/store/useToastStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import type { Listing } from '@/types'

const CATEGORIES: { key: string; icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
  { key: 'car', icon: 'car-outline', label: 'Car' },
  { key: 'motorcycle', icon: 'speedometer-outline', label: 'Motorcycle' },
  { key: 'boat', icon: 'boat-outline', label: 'Boat' },
  { key: 'villa', icon: 'home-outline', label: 'Villa' },
  { key: 'bike', icon: 'bicycle-outline', label: 'Bike' },
  { key: 'other', icon: 'cube-outline', label: 'Other' },
]

const FEATURE_CHIPS = ['AC', 'GPS', 'Bluetooth', 'USB', 'Leather seats', 'Sunroof', 'Baby seat', '4WD', 'Convertible', 'Automatic']

const POLICIES = [
  { key: 'flexible', label: 'Flexible', desc: 'Full refund 1 day prior to arrival' },
  { key: 'moderate', label: 'Moderate', desc: 'Full refund 5 days prior to arrival' },
  { key: 'strict', label: 'Strict', desc: 'Full refund 14 days prior to arrival' },
]

type Step = 1 | 2 | 3 | 4 | 5

export default function NewHostListingScreen() {
  const C = useColors()
  const { showPhotoOptions } = useCamera()
  const { showToast } = useToastStore()
  const { language } = useAuthStore()
  const isHu = language === 'hu'
  const [step, setStep] = useState<Step>(1)
  const [category, setCategory] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [description, setDescription] = useState('')
  const [features, setFeatures] = useState<string[]>([])
  const [photos, setPhotos] = useState<(string | null)[]>(Array(6).fill(null))
  const [pricePerDay, setPricePerDay] = useState('')
  const [policy, setPolicy] = useState('flexible')
  const [instantBook, setInstantBook] = useState(true)
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [strRegistration, setStrRegistration] = useState('')
  const [publishing, setPublishing] = useState(false)

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

  const canProceed = (): boolean => {
    if (step === 1) return category !== ''
    if (step === 2) return description !== ''
    if (step === 3) return photos.filter(Boolean).length >= 1
    if (step === 4) return pricePerDay !== ''
    return true
  }

  const nextStep = () => {
    if (step < 5) setStep((step + 1) as Step)
    else void handlePublish()
  }

  const [published, setPublished] = useState(false)

  const handlePublish = async () => {
    const derivedTitle = [make, model].filter(Boolean).join(' ').trim() || category
    if (!derivedTitle) {
      Alert.alert(
        isHu ? 'Hiba' : 'Error',
        isHu ? 'Kategória megadása kötelező' : 'Category is required',
      )
      return
    }

    setPublishing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      const { data: hostRecord } = await supabase
        .from('rentivo_hosts')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!hostRecord?.id) {
        showToast({ message: isHu ? 'Host profil nem található' : 'Host account not found. Please complete your profile.', type: 'error' })
        setPublishing(false)
        return
      }

      await createListing({
        operator_id: '',
        host_id: hostRecord.id,
        title: derivedTitle,
        description: description.trim() || null,
        category: category as Listing['category'],
        subcategory: null,
        price_per_day: parseFloat(pricePerDay) || 0,
        price_per_week: null,
        deposit_amount: 0,
        currency: 'EUR',
        available: true,
        min_rental_days: 1,
        max_rental_days: null,
        capacity: null,
        year: year ? parseInt(year, 10) : null,
        make: make.trim() || null,
        model: model.trim() || null,
        color: color.trim() || null,
        license_plate: null,
        features,
        rules: null,
        images: photos.filter((p): p is string => p !== null),
        cover_image_url: photos.find((p) => p !== null) ?? null,
        cancellation_policy: policy as Listing['cancellation_policy'],
        pickup_address: address.trim() || null,
        latitude: null,
        longitude: null,
        instant_book: instantBook,
        owner_type: 'host',
      })

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: isHu ? 'Hirdetés létrehozva' : 'Listing created', type: 'success' })
      router.replace('/(host)/listings')
    } catch {
      showToast({ message: isHu ? 'Hiba történt' : 'Something went wrong', type: 'error' })
    } finally {
      setPublishing(false)
    }
  }

  const styles = useMemo(() => makeStyles(C), [C])

  if (published) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <View style={{ paddingHorizontal: Spacing.xl }}>
          <View style={styles.publishedCircle}>
            <Text style={styles.publishedCheck}>✓</Text>
          </View>
          <Text style={styles.publishedTitle}>You're live! 🎉</Text>
          <Text style={styles.publishedSubtitle}>Your listing is now visible to travellers.</Text>
          <WhatNextScreen
            steps={[
              { icon: '🔔', text: "You'll get a notification when someone books" },
              { icon: '✓', text: 'Confirm or decline each booking in your inbox' },
              { icon: '💰', text: 'Your payout arrives 24 hours after pickup' },
              { icon: '🛡️', text: 'Insurance is automatically included' },
            ]}
            primaryAction={{
              label: 'View my listings',
              onPress: () => router.replace('/(host)/listings'),
            }}
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step > 1 ? setStep((step - 1) as Step) : router.back()}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>List your vehicle</Text>
          <View style={{ width: 22 }} />
        </View>

        <StepIndicator
          totalSteps={5}
          currentStep={step}
          labels={['Type', 'Details', 'Photos', 'Price', 'Location']}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Category */}
          {step === 1 && (
            <View>
              <Text style={styles.title}>What are you renting?</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.catCard, category === cat.key && styles.catCardActive]}
                    onPress={() => setCategory(cat.key)}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={32}
                      color={category === cat.key ? C.primaryDark : C.textSecondary}
                    />
                    <Text style={[styles.catLabel, category === cat.key && styles.catLabelActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <View>
              <Text style={styles.title}>Tell us about it</Text>
              {(category === 'car' || category === 'motorcycle') && (
                <>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Make</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Toyota"
                        placeholderTextColor={C.textTertiary}
                        value={make}
                        onChangeText={setMake}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Model</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. RAV4"
                        placeholderTextColor={C.textTertiary}
                        value={model}
                        onChangeText={setModel}
                      />
                    </View>
                  </View>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Year (optional)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="2023"
                        placeholderTextColor={C.textTertiary}
                        value={year}
                        onChangeText={setYear}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Color (optional)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="White"
                        placeholderTextColor={C.textTertiary}
                        value={color}
                        onChangeText={setColor}
                      />
                    </View>
                  </View>
                </>
              )}
              {(category === 'villa') && (
                <View>
                  <Text style={styles.label}>STR Registration Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. VUT/MAD/2024/12345 (required by local law)"
                    placeholderTextColor={C.textTertiary}
                    value={strRegistration}
                    onChangeText={setStrRegistration}
                  />
                  <Text style={{ color: C.textTertiary, fontSize: 11, marginBottom: Spacing.md }}>
                    Many EU cities require a short-term rental licence number on all listings.
                  </Text>
                </View>
              )}
              <Text style={styles.label}>Short description</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="What makes your rental special?"
                placeholderTextColor={C.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
              <Text style={styles.label}>Key features</Text>
              <View style={styles.featureChips}>
                {FEATURE_CHIPS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.featureChip, features.includes(f) && styles.featureChipActive]}
                    onPress={() => setFeatures(prev =>
                      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
                    )}
                  >
                    <Text style={[styles.featureChipText, features.includes(f) && styles.featureChipTextActive]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 3: Photos */}
          {step === 3 && (
            <View>
              <Text style={styles.title}>Add photos</Text>
              <Text style={styles.subtitle}>Add at least 1 photo. Good lighting makes a big difference!</Text>
              <View style={styles.photoGrid}>
                {Array.from({ length: 6 }, (_, i) => (
                  <TouchableOpacity key={i} style={styles.photoSlot} onPress={() => handlePickPhoto(i)}>
                    {photos[i] ? (
                      <Image source={{ uri: photos[i]! }} style={styles.photoSlotImage} contentFit="cover" />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={28} color={C.textTertiary} />
                        {i === 0 && <Text style={styles.photoSlotLabel}>Cover</Text>}
                      </>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.photoTip}>
                💡 Tip: Show the front, back, interior, and any special features
              </Text>
            </View>
          )}

          {/* Step 4: Pricing */}
          {step === 4 && (
            <View>
              <Text style={styles.title}>Set your price</Text>
              <View style={styles.priceInputWrap}>
                <Text style={styles.currencySymbol}>€</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  placeholderTextColor={C.textTertiary}
                  value={pricePerDay}
                  onChangeText={setPricePerDay}
                  keyboardType="numeric"
                />
                <Text style={styles.priceUnit}>/day</Text>
              </View>
              <Text style={styles.priceSuggestion}>
                💡 Suggested: €35–€65/day based on similar listings in your area
              </Text>

              {pricePerDay !== '' && parseFloat(pricePerDay) > 0 && (
                <View style={styles.earningsCard}>
                  <Text style={styles.earningsTitle}>💰 Estimated earnings</Text>
                  <Text style={styles.earningsValue}>
                    ~€{Math.round(parseFloat(pricePerDay) * 8 * 0.975)}/month
                  </Text>
                  <Text style={styles.earningsNote}>8 days/month · after 2.5% platform fee</Text>
                </View>
              )}

              <Text style={styles.label}>Cancellation policy</Text>
              {POLICIES.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.policyCard, policy === p.key && styles.policyCardActive]}
                  onPress={() => setPolicy(p.key)}
                >
                  <View style={styles.policyRadio}>
                    {policy === p.key && <View style={styles.policyRadioDot} />}
                  </View>
                  <View>
                    <Text style={styles.policyLabel}>{p.label}</Text>
                    <Text style={styles.policyDesc}>{p.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Step 5: Location & availability */}
          {step === 5 && (
            <View>
              <Text style={styles.title}>Location & availability</Text>

              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                placeholder="City where your rental is located"
                placeholderTextColor={C.textTertiary}
                value={city}
                onChangeText={setCity}
              />

              <Text style={styles.label}>Pickup address</Text>
              <TextInput
                style={styles.input}
                placeholder="Street address or area"
                placeholderTextColor={C.textTertiary}
                value={address}
                onChangeText={setAddress}
              />

              <View style={styles.instantBookRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.instantBookTitle}>Instant book</Text>
                  <Text style={styles.instantBookDesc}>
                    {instantBook
                      ? 'Bookings confirmed automatically'
                      : 'You confirm each booking manually'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggleBtn, instantBook && styles.toggleBtnActive]}
                  onPress={() => setInstantBook(v => !v)}
                >
                  <Text style={[styles.toggleBtnText, instantBook && styles.toggleBtnTextActive]}>
                    {instantBook ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.publishNote}>
                <Text style={styles.publishNoteText}>
                  🚀 Your listing will go live immediately after publishing. You can pause or edit it at any time.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextBtn, (!canProceed() || publishing) && styles.nextBtnDisabled]}
            onPress={nextStep}
            disabled={!canProceed() || publishing}
          >
            <Text style={styles.nextBtnText}>
              {step === 5 ? (publishing ? '...' : '🚀 Publish listing') : 'Continue →'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: 14, fontWeight: '600', color: C.textSecondary },

  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: C.text,
    marginBottom: Spacing.xl,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: C.textSecondary,
    marginTop: -Spacing.md,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  catCard: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.border,
    gap: Spacing.xs,
  },
  catCardActive: {
    borderColor: C.primary,
    backgroundColor: C.primarySurface,
  },
  catEmoji: { fontSize: 32 },
  catLabel: { fontSize: 12, fontWeight: '600', color: C.textSecondary },
  catLabelActive: { color: C.primaryDark },

  row: { flexDirection: 'row', gap: Spacing.sm },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    marginTop: Spacing.base,
  },
  input: {
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: C.text,
  },
  inputMulti: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: Spacing.md,
  },
  featureChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  featureChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: C.surfaceWarm,
    borderWidth: 1,
    borderColor: C.border,
  },
  featureChipActive: {
    backgroundColor: C.primarySurface,
    borderColor: C.primary,
  },
  featureChipText: { fontSize: 13, fontWeight: '500', color: C.textSecondary },
  featureChipTextActive: { color: C.primaryDark },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
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
    gap: 4,
  },
  photoSlotLabel: { fontSize: 10, color: C.textTertiary, fontWeight: '600' },
  photoSlotImage: { width: '100%', height: '100%', borderRadius: Radius.lg },
  photoTip: {
    fontSize: 13,
    color: C.textSecondary,
    backgroundColor: C.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    lineHeight: 20,
  },

  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: C.primary,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  currencySymbol: { fontSize: 28, fontWeight: '700', color: C.primary, marginRight: Spacing.sm },
  priceInput: { flex: 1, fontSize: 48, fontWeight: '900', color: C.text, paddingVertical: Spacing.xl },
  priceUnit: { fontSize: 18, color: C.textSecondary, fontWeight: '600' },
  priceSuggestion: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },

  policyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  policyCardActive: {
    borderColor: C.primary,
    backgroundColor: C.primarySurface,
  },
  policyRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },
  policyLabel: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  policyDesc: { fontSize: 12, color: C.textSecondary },

  instantBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginTop: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
    gap: Spacing.md,
  },
  instantBookTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  instantBookDesc: { fontSize: 13, color: C.textSecondary },
  toggleBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: C.surfaceWarm,
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleBtnActive: { backgroundColor: C.primarySurface, borderColor: C.primary },
  toggleBtnText: { fontSize: 13, fontWeight: '800', color: C.textSecondary },
  toggleBtnTextActive: { color: C.primaryDark },

  publishNote: {
    backgroundColor: C.successSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: C.success,
  },
  publishNoteText: { fontSize: 13, color: C.success, lineHeight: 20 },

  footer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.background,
  },
  nextBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  nextBtnDisabled: {
    backgroundColor: C.textTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: C.textInverse },
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
  publishedCheck: { fontSize: 48, color: C.success },
  publishedTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: C.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  publishedSubtitle: {
    fontSize: 15,
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  earningsCard: {
    backgroundColor: C.successSurface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: C.success,
    alignItems: 'center',
  },
  earningsTitle: { fontSize: 13, fontWeight: '700', color: C.success, marginBottom: Spacing.xs },
  earningsValue: { fontSize: 32, fontWeight: '900', color: C.success },
  earningsNote: { fontSize: 12, color: C.textSecondary, marginTop: 4 },
  })
}
