import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useCamera } from '@/lib/hooks/useCamera'

const CATEGORIES = [
  { key: 'car', emoji: '🚗', label: 'Car' },
  { key: 'motorcycle', emoji: '🏍️', label: 'Motorcycle' },
  { key: 'boat', emoji: '⛵', label: 'Boat' },
  { key: 'villa', emoji: '🏠', label: 'Villa' },
  { key: 'bike', emoji: '🚲', label: 'Bike' },
  { key: 'other', emoji: '📦', label: 'Other' },
]

const FEATURE_CHIPS = ['AC', 'GPS', 'Bluetooth', 'USB', 'Leather seats', 'Sunroof', 'Baby seat', '4WD', 'Convertible', 'Automatic']

const POLICIES = [
  { key: 'flexible', label: 'Flexible', desc: 'Full refund 1 day prior to arrival' },
  { key: 'moderate', label: 'Moderate', desc: 'Full refund 5 days prior to arrival' },
  { key: 'strict', label: 'Strict', desc: 'Full refund 14 days prior to arrival' },
]

type Step = 1 | 2 | 3 | 4 | 5

export default function NewHostListingScreen() {
  const { showPhotoOptions } = useCamera()
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
    else handlePublish()
  }

  const handlePublish = () => {
    router.replace('/(host)/listings')
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
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Step {step} of 5</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Progress */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step / 5) * 100}%` }]} />
        </View>

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
                    <Text style={styles.catEmoji}>{cat.emoji}</Text>
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
                        placeholderTextColor={Colors.textTertiary}
                        value={make}
                        onChangeText={setMake}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Model</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. RAV4"
                        placeholderTextColor={Colors.textTertiary}
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
                        placeholderTextColor={Colors.textTertiary}
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
                        placeholderTextColor={Colors.textTertiary}
                        value={color}
                        onChangeText={setColor}
                      />
                    </View>
                  </View>
                </>
              )}
              <Text style={styles.label}>Short description</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="What makes your rental special?"
                placeholderTextColor={Colors.textTertiary}
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
                        <Ionicons name="camera-outline" size={28} color={Colors.textTertiary} />
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
                  placeholderTextColor={Colors.textTertiary}
                  value={pricePerDay}
                  onChangeText={setPricePerDay}
                  keyboardType="numeric"
                />
                <Text style={styles.priceUnit}>/day</Text>
              </View>
              <Text style={styles.priceSuggestion}>
                💡 Suggested: €35–€65/day based on similar listings in your area
              </Text>

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
                placeholderTextColor={Colors.textTertiary}
                value={city}
                onChangeText={setCity}
              />

              <Text style={styles.label}>Pickup address</Text>
              <TextInput
                style={styles.input}
                placeholder="Street address or area"
                placeholderTextColor={Colors.textTertiary}
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
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={nextStep}
            disabled={!canProceed()}
          >
            <Text style={styles.nextBtnText}>
              {step === 5 ? '🚀 Publish listing' : 'Continue →'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
    borderRadius: 2,
    marginBottom: Spacing.base,
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: Spacing.xl,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  catCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  catEmoji: { fontSize: 32 },
  catLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  catLabelActive: { color: Colors.primaryDark },

  row: { flexDirection: 'row', gap: Spacing.sm },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    marginTop: Spacing.base,
  },
  input: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.text,
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
    backgroundColor: Colors.surfaceWarm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureChipActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  featureChipText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  featureChipTextActive: { color: Colors.primaryDark },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
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
    gap: 4,
  },
  photoSlotLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600' },
  photoSlotImage: { width: '100%', height: '100%', borderRadius: Radius.lg },
  photoTip: {
    fontSize: 13,
    color: Colors.textSecondary,
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    lineHeight: 20,
  },

  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  currencySymbol: { fontSize: 28, fontWeight: '700', color: Colors.primary, marginRight: Spacing.sm },
  priceInput: { flex: 1, fontSize: 48, fontWeight: '900', color: Colors.text, paddingVertical: Spacing.xl },
  priceUnit: { fontSize: 18, color: Colors.textSecondary, fontWeight: '600' },
  priceSuggestion: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },

  policyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  policyCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  policyRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  policyLabel: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  policyDesc: { fontSize: 12, color: Colors.textSecondary },

  instantBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginTop: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  instantBookTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  instantBookDesc: { fontSize: 13, color: Colors.textSecondary },
  toggleBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceWarm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtnActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  toggleBtnText: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary },
  toggleBtnTextActive: { color: Colors.primaryDark },

  publishNote: {
    backgroundColor: Colors.successSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  publishNoteText: { fontSize: 13, color: Colors.success, lineHeight: 20 },

  footer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  nextBtnDisabled: {
    backgroundColor: Colors.textTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: Colors.textInverse },
})
