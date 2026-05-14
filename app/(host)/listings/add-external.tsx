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
  { key: 'other', label: 'Egyéb', emoji: '🔗' },
]

const CATEGORIES = [
  { key: 'car', label: 'Autó', emoji: '🚗' },
  { key: 'motorcycle', label: 'Motor', emoji: '🏍️' },
  { key: 'yacht', label: 'Csónak', emoji: '⛵' },
  { key: 'villa', label: 'Villa', emoji: '🏡' },
  { key: 'bike', label: 'Bringa', emoji: '🚲' },
  { key: 'other', label: 'Egyéb', emoji: '📦' },
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
        title="Listing importálása"
        subtitle={`${step}. lépés / 4`}
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
            <Text style={styles.stepTitle}>Melyik platformon van a listinged?</Text>
            <Text style={styles.stepSubtitle}>
              Saját listingedet adod hozzá — a foglalás az eredeti platformon történik.
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
            <Text style={styles.stepTitle}>Listing adatai</Text>
            <Text style={styles.stepSubtitle}>
              Ezeket te töltöd ki — Rentivo nem gyűjt adatot a {platformLabel} oldaláról.
            </Text>

            <Text style={styles.fieldLabel}>Listing URL ({platformLabel})*</Text>
            <TextInput
              style={styles.input}
              value={listingUrl}
              onChangeText={setListingUrl}
              placeholder="https://www.airbnb.com/rooms/..."
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.fieldLabel}>Listing neve*</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="pl. Cozy Villa in Marbella"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.fieldLabel}>Kategória</Text>
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

            <Text style={styles.fieldLabel}>Ár/nap (EUR, opcionális)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="pl. 85"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Város*</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="pl. Marbella"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        )}

        {/* STEP 3 — iCal szinkronizáció */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Elérhetőség szinkronizálás</Text>
            <Text style={styles.stepSubtitle}>
              Opcionális: ha megadod az iCal URL-t, a Rentivo automatikusan szinkronizálja
              a foglalt napokat a {platformLabel} naptáradból.
            </Text>

            <TouchableOpacity
              style={[styles.optionCard, wantsIcal === true && styles.optionCardActive]}
              onPress={() => setWantsIcal(true)}
            >
              <Text style={styles.optionEmoji}>🔄</Text>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Igen, szinkronizálom</Text>
                <Text style={styles.optionDesc}>
                  Automatikus frissítés 4 óránként — 0 dupla foglalás
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, wantsIcal === false && styles.optionCardActive]}
              onPress={() => setWantsIcal(false)}
            >
              <Text style={styles.optionEmoji}>⏭️</Text>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Kihagyom most</Text>
                <Text style={styles.optionDesc}>Később beállíthatod a listing szerkesztésekor</Text>
              </View>
            </TouchableOpacity>

            {wantsIcal === true && (
              <View style={styles.icalSection}>
                <View style={styles.icalLabelRow}>
                  <Text style={styles.fieldLabel}>iCal URL</Text>
                  <TouchableOpacity onPress={() => setShowIcalHelp(true)}>
                    <Text style={styles.helpLink}>Hogyan találom meg? →</Text>
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
                    : <Text style={styles.testBtnText}>Tesztelés</Text>}
                </TouchableOpacity>

                {icalResult !== null && (
                  <View style={[styles.icalResult, icalResult.error ? styles.icalResultError : styles.icalResultSuccess]}>
                    <Text style={[styles.icalResultText, icalResult.error ? styles.icalResultTextError : styles.icalResultTextSuccess]}>
                      {icalResult.error
                        ? `Hiba: ${icalResult.error}`
                        : `Sikeres! ${icalResult.synced} foglalt időszak szinkronizálva.`}
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
            <Text style={styles.successTitle}>Listing közzétéve!</Text>
            <Text style={styles.successSubtitle}>
              A listinged megjelenik a Rentivo explore oldalán.
              Foglaláskor a vendéget a {platformLabel}-ra küldjük.
            </Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Fontos tudnivalók</Text>
              <Text style={styles.infoItem}>✅ A listing "{platformLabel} via Rentivo" badge-et kap</Text>
              <Text style={styles.infoItem}>✅ A "Book" gomb a {platformLabel} oldalra vezet</Text>
              <Text style={styles.infoItem}>✅ Rentivo nem kezeli a foglalást — te és a {platformLabel}</Text>
              {wantsIcal && icalResult?.error === null && (
                <Text style={styles.infoItem}>✅ iCal szinkronizáció aktív (4 óránként)</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => router.replace('/(host)/listings' as Parameters<typeof router.replace>[0])}
            >
              <Text style={styles.doneBtnText}>Visszatérés a listingjeihez →</Text>
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
              <Text style={styles.nextBtnText}>Tovább →</Text>
            </TouchableOpacity>
          )}
          {step === 2 && (
            <TouchableOpacity
              style={[styles.nextBtn, !canProceedStep2 && styles.nextBtnDisabled]}
              disabled={!canProceedStep2}
              onPress={next}
            >
              <Text style={styles.nextBtnText}>Tovább →</Text>
            </TouchableOpacity>
          )}
          {step === 3 && (
            <View>
              <Text style={styles.gdprText}>
                Megerősítem, hogy saját listingemet adom hozzá, amelyhez jogom van.
              </Text>
              <TouchableOpacity
                style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
                disabled={saving}
                onPress={() => { void handleSave() }}
              >
                {saving
                  ? <ActivityIndicator size="small" color={Colors.textInverse} />
                  : <Text style={styles.nextBtnText}>Mentés és közzétevés</Text>}
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
