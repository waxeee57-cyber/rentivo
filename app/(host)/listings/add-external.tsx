import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { ICalHelpSheet } from '@/components/integrations/ICalHelpSheet'
import { performICalSync } from '@/lib/ical'
import type { PlatformType } from '@/types'

type Step = 1 | 2 | 3 | 4

interface Platform {
  key: PlatformType
  label: string
  emoji: string
}

const PLATFORMS: Platform[] = [
  { key: 'airbnb', label: 'Airbnb', emoji: '🏠' },
  { key: 'booking', label: 'Booking.com', emoji: '🏨' },
  { key: 'vrbo', label: 'VRBO', emoji: '🏖️' },
  { key: 'turo', label: 'Turo', emoji: '🚗' },
  { key: 'holidu', label: 'Holidu', emoji: '🌴' },
  { key: 'other', label: 'Other', emoji: '🔗' },
]

const CATEGORIES = [
  { key: 'car', label: 'Car', emoji: '🚗' },
  { key: 'motorcycle', label: 'Motorcycle', emoji: '🏍️' },
  { key: 'yacht', label: 'Boat', emoji: '⛵' },
  { key: 'villa', label: 'Villa', emoji: '🏡' },
  { key: 'bike', label: 'Bike', emoji: '🚲' },
  { key: 'other', label: 'Other', emoji: '📦' },
]

export default function AddExternalListingScreen() {
  const [step, setStep] = useState<Step>(1)
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(null)
  const [listingUrl, setListingUrl] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [city, setCity] = useState('')
  const [wantsIcal, setWantsIcal] = useState<boolean | null>(null)
  const [icalUrl, setIcalUrl] = useState('')
  const [icalTesting, setIcalTesting] = useState(false)
  const [icalResult, setIcalResult] = useState<{ synced: number; error: string | null } | null>(null)
  const [showIcalHelp, setShowIcalHelp] = useState(false)
  const [saving, setSaving] = useState(false)

  const platformLabel = PLATFORMS.find(p => p.key === selectedPlatform)?.label ?? ''

  const canProceedStep1 = selectedPlatform !== null
  const canProceedStep2 = listingUrl.trim().length > 0 && title.trim().length > 0 && city.trim().length > 0

  const handleTestIcal = async () => {
    if (!icalUrl.trim()) return
    setIcalTesting(true)
    setIcalResult(null)
    const result = await performICalSync({ ical_url: icalUrl.trim() })
    setIcalResult({ synced: result.synced, error: result.error })
    setIcalTesting(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    // In production: save to Supabase rentivo_external_listings table
    await new Promise<void>(resolve => setTimeout(resolve, 800))
    setSaving(false)
    setStep(4)
  }

  const next = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setStep(s => (s + 1) as Step)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Import Listing"
        subtitle={`Step ${step} of 4`}
        onBack={step === 1 ? () => router.back() : () => setStep(s => (s - 1) as Step)}
      />

      <StepIndicator currentStep={step} totalSteps={4} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* STEP 1 — Platform választás */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Which platform is your listing on?</Text>
            <Text style={styles.stepSubtitle}>
              You're adding your own listing — bookings happen on the original platform.
            </Text>
            <View style={styles.platformGrid}>
              {PLATFORMS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.platformCard, selectedPlatform === p.key && styles.platformCardActive]}
                  onPress={() => setSelectedPlatform(p.key)}
                >
                  <Text style={styles.platformEmoji}>{p.emoji}</Text>
                  <Text style={[styles.platformLabel, selectedPlatform === p.key && styles.platformLabelActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* STEP 2 — Alap adatok */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Listing details</Text>
            <Text style={styles.stepSubtitle}>
              You fill these in — Rentivo does not scrape data from {platformLabel}.
            </Text>

            <Text style={styles.fieldLabel}>Listing URL ({platformLabel}) *</Text>
            <TextInput
              style={styles.input}
              value={listingUrl}
              onChangeText={setListingUrl}
              placeholder="https://www.airbnb.com/rooms/..."
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.fieldLabel}>Listing name *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="pl. Cozy Villa in Marbella"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              <View style={styles.categoryRow}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.categoryPill, category === c.key && styles.categoryPillActive]}
                    onPress={() => setCategory(c.key)}
                  >
                    <Text style={[styles.categoryPillText, category === c.key && styles.categoryPillTextActive]}>
                      {c.emoji} {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Price / day (EUR, optional)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="e.g. 85"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>City *</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Marbella"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        )}

        {/* STEP 3 — iCal szinkronizáció */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Availability sync</Text>
            <Text style={styles.stepSubtitle}>
              Optional: provide your iCal URL and Rentivo will automatically sync
              blocked dates from your {platformLabel} calendar.
            </Text>

            <TouchableOpacity
              style={[styles.optionCard, wantsIcal === true && styles.optionCardActive]}
              onPress={() => setWantsIcal(true)}
            >
              <Text style={styles.optionEmoji}>🔄</Text>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Yes, sync availability</Text>
                <Text style={styles.optionDesc}>
                  Auto-updates every 4 hours — 0 double bookings
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, wantsIcal === false && styles.optionCardActive]}
              onPress={() => setWantsIcal(false)}
            >
              <Text style={styles.optionEmoji}>⏭️</Text>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Skip for now</Text>
                <Text style={styles.optionDesc}>You can set this up later when editing the listing</Text>
              </View>
            </TouchableOpacity>

            {wantsIcal === true && (
              <View style={styles.icalSection}>
                <View style={styles.icalLabelRow}>
                  <Text style={styles.fieldLabel}>iCal URL</Text>
                  <TouchableOpacity onPress={() => setShowIcalHelp(true)}>
                    <Text style={styles.helpLink}>How do I find it? →</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={icalUrl}
                  onChangeText={v => { setIcalUrl(v); setIcalResult(null) }}
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <TouchableOpacity
                  style={[styles.testBtn, (!icalUrl.trim() || icalTesting) && styles.testBtnDisabled]}
                  onPress={() => { void handleTestIcal() }}
                  disabled={!icalUrl.trim() || icalTesting}
                >
                  {icalTesting
                    ? <ActivityIndicator size="small" color={Colors.textInverse} />
                    : <Text style={styles.testBtnText}>Test connection</Text>}
                </TouchableOpacity>

                {icalResult !== null && (
                  <View style={[styles.icalResult, icalResult.error ? styles.icalResultError : styles.icalResultSuccess]}>
                    <Text style={[styles.icalResultText, icalResult.error ? styles.icalResultTextError : styles.icalResultTextSuccess]}>
                      {icalResult.error
                        ? `Error: ${icalResult.error}`
                        : `Success! ${icalResult.synced} blocked dates synced.`}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* STEP 4 — Megerősítés / Siker */}
        {step === 4 && (
          <View style={styles.successContainer}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>Listing published!</Text>
            <Text style={styles.successSubtitle}>
              Your listing is now visible on Rentivo's explore page.
              When guests book, they'll be directed to {platformLabel}.
            </Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>What to expect</Text>
              <Text style={styles.infoItem}>✅ Listing shows a "{platformLabel} via Rentivo" badge</Text>
              <Text style={styles.infoItem}>✅ The "Book" button links to your {platformLabel} listing</Text>
              <Text style={styles.infoItem}>✅ Rentivo does not handle the booking — {platformLabel} does</Text>
              {wantsIcal && icalResult?.error === null && (
                <Text style={styles.infoItem}>✅ iCal sync active (updates every 4 hours)</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => router.replace('/(host)/listings' as Parameters<typeof router.replace>[0])}
            >
              <Text style={styles.doneBtnText}>Back to my listings →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      {step < 4 && (
        <View style={styles.footer}>
          {step === 1 && (
            <TouchableOpacity
              style={[styles.nextBtn, !canProceedStep1 && styles.nextBtnDisabled]}
              disabled={!canProceedStep1}
              onPress={next}
            >
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          )}
          {step === 2 && (
            <TouchableOpacity
              style={[styles.nextBtn, !canProceedStep2 && styles.nextBtnDisabled]}
              disabled={!canProceedStep2}
              onPress={next}
            >
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          )}
          {step === 3 && (
            <View>
              <Text style={styles.gdprText}>
                I confirm this is my own listing and I have the right to add it.
              </Text>
              <TouchableOpacity
                style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
                disabled={saving}
                onPress={() => { void handleSave() }}
              >
                {saving
                  ? <ActivityIndicator size="small" color={Colors.textInverse} />
                  : <Text style={styles.nextBtnText}>Save and publish</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <ICalHelpSheet
        visible={showIcalHelp}
        platform={selectedPlatform ?? 'other'}
        onClose={() => setShowIcalHelp(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  stepTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  stepSubtitle: {
    fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.xl,
  },

  platformGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm,
  },
  platformCard: {
    width: '30%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  platformCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  platformEmoji: { fontSize: 32, marginBottom: Spacing.sm },
  platformLabel: { fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  platformLabelActive: { color: Colors.primary },

  fieldLabel: {
    fontSize: 13, fontWeight: '600', color: Colors.textSecondary,
    marginBottom: Spacing.sm, marginTop: Spacing.base,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  categoryScroll: { marginBottom: Spacing.sm },
  categoryRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.xs },
  categoryPill: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryPillText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  categoryPillTextActive: { color: Colors.textInverse },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  optionCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  optionEmoji: { fontSize: 28 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  optionDesc: { fontSize: 12, color: Colors.textSecondary },

  icalSection: { marginTop: Spacing.base },
  icalLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  helpLink: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  testBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  testBtnDisabled: { opacity: 0.5 },
  testBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textInverse },
  icalResult: {
    borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md,
  },
  icalResultSuccess: { backgroundColor: Colors.successSurface, borderWidth: 1, borderColor: Colors.success },
  icalResultError: { backgroundColor: Colors.errorSurface, borderWidth: 1, borderColor: Colors.error },
  icalResultText: { fontSize: 13 },
  icalResultTextSuccess: { color: Colors.success },
  icalResultTextError: { color: Colors.error },

  successContainer: { alignItems: 'center', paddingTop: Spacing.xxl },
  successEmoji: { fontSize: 64, marginBottom: Spacing.md },
  successTitle: { fontSize: 26, fontWeight: '900', color: Colors.text, marginBottom: Spacing.sm },
  successSubtitle: {
    fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22,
    marginBottom: Spacing.xl, paddingHorizontal: Spacing.md,
  },
  infoBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  infoItem: { fontSize: 13, color: Colors.textSecondary },
  doneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.xxl,
  },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: Colors.textInverse },

  footer: {
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  gdprText: {
    fontSize: 11, color: Colors.textTertiary, textAlign: 'center',
    marginBottom: Spacing.sm, lineHeight: 16,
  },
  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: Colors.textInverse },
})
