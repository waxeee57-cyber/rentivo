import React, { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { ICalHelpSheet } from '@/components/integrations/ICalHelpSheet'
import { performICalSync } from '@/lib/ical'
import { createListing } from '@/lib/api/listings'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { useToastStore } from '@/lib/store/useToastStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { PlatformType, Listing } from '@/types'

type Step = 1 | 2 | 3 | 4

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

interface Platform {
  key: PlatformType
  label: string
  /** Neutral glyph for the platform *type* — the text label carries the brand. */
  icon: IoniconName
}

const PLATFORMS: Platform[] = [
  { key: 'airbnb', label: 'Airbnb', icon: 'home-outline' },
  { key: 'booking', label: 'Booking.com', icon: 'business-outline' },
  { key: 'vrbo', label: 'VRBO', icon: 'home-outline' },
  { key: 'turo', label: 'Turo', icon: 'car-sport-outline' },
  { key: 'holidu', label: 'Holidu', icon: 'home-outline' },
  { key: 'other', label: 'Other', icon: 'link-outline' },
]

const CATEGORIES: { key: string; label: string; icon: IoniconName }[] = [
  { key: 'car', label: 'Car', icon: 'car-sport-outline' },
  { key: 'motorcycle', label: 'Motorcycle', icon: 'bicycle-outline' },
  { key: 'yacht', label: 'Boat', icon: 'boat-outline' },
  { key: 'villa', label: 'Villa', icon: 'home-outline' },
  { key: 'bike', label: 'Bike', icon: 'bicycle-outline' },
  { key: 'other', label: 'Other', icon: 'cube-outline' },
]

export default function AddExternalListingScreen() {
  const C = useColors()
  const { language } = useAuthStore()
  const { showToast } = useToastStore()
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
    try {
      // The old body was an ungated `setTimeout(800)` followed by an unconditional
      // jump to the step-4 "Listing published!" screen — in a shipped build the host
      // finished the whole wizard and every field was thrown away.
      if (Config.useMock) {
        await new Promise<void>(resolve => setTimeout(resolve, 800))
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setStep(4)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not signed in')

      const { data: hostRecord, error: hostError } = await supabase
        .from('rentivo_hosts')
        .select('id')
        .eq('auth_id', session.user.id)
        .maybeSingle()
      if (hostError) throw hostError
      if (!hostRecord?.id) throw new Error(t('hostLHostNotFound', language))

      const listing = await createListing({
        operator_id: '',
        host_id: hostRecord.id,
        owner_type: 'host',
        title: title.trim(),
        description: null,
        category: (category || 'other') as Listing['category'],
        subcategory: null,
        price_per_day: parseFloat(price) || 0,
        price_per_week: null,
        deposit_amount: 0,
        currency: 'EUR',
        available: true,
        min_rental_days: 1,
        max_rental_days: null,
        capacity: null,
        year: null,
        make: null,
        model: null,
        color: null,
        license_plate: null,
        features: [],
        rules: null,
        images: [],
        cover_image_url: null,
        pickup_address: city.trim() || null,
        latitude: null,
        longitude: null,
        instant_book: false,
      })

      // The platform link lives on its own table: rentivo_listings has no
      // external_url / platform column (see supabase/migrations/14_connected_platforms.sql).
      const { error: connError } = await supabase.from('rentivo_connected_platforms').insert({
        owner_id: session.user.id,
        listing_id: listing.id,
        platform: selectedPlatform,
        external_url: listingUrl.trim(),
        ical_url: wantsIcal === true && icalUrl.trim() ? icalUrl.trim() : null,
        active: true,
      })
      if (connError) throw connError

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // Only advance to the success screen once the rows actually exist.
      setStep(4)
    } catch (e) {
      // Surface the real reason and stay on step 3 so the host can retry — matching
      // the toast pattern the sibling wizard (listings/new.tsx) already uses.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      showToast({ message: e instanceof Error ? e.message : String(e), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const next = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setStep(s => (s + 1) as Step)
  }

  const styles = useMemo(() => makeStyles(C), [C])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={t('importListing', language)}
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
            <Text style={styles.stepTitle}>{t('whichPlatform', language)}</Text>
            <Text style={styles.stepSubtitle}>{t('addingOwnListing', language)}</Text>
            <View style={styles.platformGrid}>
              {PLATFORMS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.platformCard, selectedPlatform === p.key && styles.platformCardActive]}
                  onPress={() => setSelectedPlatform(p.key)}
                  accessibilityRole="button"
                  accessibilityLabel={p.label}
                >
                  <Ionicons
                    name={p.icon}
                    size={28}
                    color={selectedPlatform === p.key ? C.primary : C.textSecondary}
                    style={styles.platformEmoji}
                    importantForAccessibility="no"
                  />
                  <Text
                    style={[styles.platformLabel, selectedPlatform === p.key && styles.platformLabelActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
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
            <Text style={styles.stepTitle}>{t('hostLListingDetails', language)}</Text>
            <Text style={styles.stepSubtitle}>
              You fill these in — Rentivo does not scrape data from {platformLabel}.
            </Text>

            <Text style={styles.fieldLabel}>Listing URL ({platformLabel}) *</Text>
            <TextInput
              style={styles.input}
              value={listingUrl}
              onChangeText={setListingUrl}
              placeholder="https://www.airbnb.com/rooms/..."
              placeholderTextColor={C.textTertiary}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.fieldLabel}>{t('hostLListingNameLabel', language)}</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t('hostLListingNamePlaceholder', language)}
              placeholderTextColor={C.textTertiary}
            />

            <Text style={styles.fieldLabel}>{t('opFleetCategory', language)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              <View style={styles.categoryRow}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.categoryPill, category === c.key && styles.categoryPillActive]}
                    onPress={() => setCategory(c.key)}
                    accessibilityRole="button"
                    accessibilityLabel={c.label}
                  >
                    <Ionicons
                      name={c.icon}
                      size={14}
                      color={category === c.key ? C.textInverse : C.textSecondary}
                      importantForAccessibility="no"
                    />
                    <Text style={[styles.categoryPillText, category === c.key && styles.categoryPillTextActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>{t('hostLPricePerDayOptional', language)}</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder={t('hostLPricePlaceholder', language)}
              placeholderTextColor={C.textTertiary}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>{t('hostLCityReq', language)}</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder={t('hostLCityMarbella', language)}
              placeholderTextColor={C.textTertiary}
            />
          </View>
        )}

        {/* STEP 3 — iCal szinkronizáció */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>{t('hostLAvailabilitySync', language)}</Text>
            <Text style={styles.stepSubtitle}>
              Optional: provide your iCal URL and Rentivo will automatically sync
              blocked dates from your {platformLabel} calendar.
            </Text>

            <TouchableOpacity
              style={[styles.optionCard, wantsIcal === true && styles.optionCardActive]}
              onPress={() => setWantsIcal(true)}
              accessibilityRole="button"
              accessibilityLabel={t('hostLSyncYes', language)}
            >
              <Ionicons name="sync-outline" size={24} color={C.textSecondary} style={styles.optionEmoji} importantForAccessibility="no" />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{t('hostLSyncYes', language)}</Text>
                <Text style={styles.optionDesc}>{t('hostLSyncYesDesc', language)}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, wantsIcal === false && styles.optionCardActive]}
              onPress={() => setWantsIcal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('opFleetWizardSkip', language)}
            >
              <Ionicons name="play-skip-forward-outline" size={24} color={C.textSecondary} style={styles.optionEmoji} importantForAccessibility="no" />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{t('opFleetWizardSkip', language)}</Text>
                <Text style={styles.optionDesc}>{t('hostLSkipForNowDesc', language)}</Text>
              </View>
            </TouchableOpacity>

            {wantsIcal === true && (
              <View style={styles.icalSection}>
                <View style={styles.icalLabelRow}>
                  <Text style={styles.fieldLabel}>iCal URL</Text>
                  <TouchableOpacity
                    onPress={() => setShowIcalHelp(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('hostLICalHowToFind', language)}
                  >
                    <Text style={styles.helpLink}>{t('hostLICalHowToFind', language)}</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={icalUrl}
                  onChangeText={v => { setIcalUrl(v); setIcalResult(null) }}
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  placeholderTextColor={C.textTertiary}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <TouchableOpacity
                  style={[styles.testBtn, (!icalUrl.trim() || icalTesting) && styles.testBtnDisabled]}
                  onPress={() => { void handleTestIcal() }}
                  disabled={!icalUrl.trim() || icalTesting}
                  accessibilityRole="button"
                  accessibilityLabel={t('hostLTestConnection', language)}
                >
                  {icalTesting
                    ? <ActivityIndicator size="small" color={C.textInverse} />
                    : <Text style={styles.testBtnText}>{t('hostLTestConnection', language)}</Text>}
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
            <Ionicons name="checkmark-circle" size={64} color={C.success} style={styles.successEmoji} importantForAccessibility="no" />
            <Text style={styles.successTitle}>{t('hostLListingPublished', language)}</Text>
            <Text style={styles.successSubtitle}>
              Your listing is now visible on Rentivo's explore page.
              When guests book, they'll be directed to {platformLabel}.
            </Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>{t('hostLWhatToExpect', language)}</Text>
              <View style={styles.infoItemRow}>
                <Ionicons name="checkmark-circle" size={14} color={C.success} importantForAccessibility="no" />
                <Text style={styles.infoItem}>Listing shows a "{platformLabel} via Rentivo" badge</Text>
              </View>
              <View style={styles.infoItemRow}>
                <Ionicons name="checkmark-circle" size={14} color={C.success} importantForAccessibility="no" />
                <Text style={styles.infoItem}>The "Book" button links to your {platformLabel} listing</Text>
              </View>
              <View style={styles.infoItemRow}>
                <Ionicons name="checkmark-circle" size={14} color={C.success} importantForAccessibility="no" />
                <Text style={styles.infoItem}>Rentivo does not handle the booking — {platformLabel} does</Text>
              </View>
              {wantsIcal && icalResult?.error === null && (
                <View style={styles.infoItemRow}>
                  <Ionicons name="checkmark-circle" size={14} color={C.success} importantForAccessibility="no" />
                  <Text style={styles.infoItem}>{t('hostLICalSyncActive', language)}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => router.replace('/(host)/listings' as Parameters<typeof router.replace>[0])}
              accessibilityRole="button"
              accessibilityLabel={t('hostLBackToListings', language)}
            >
              <Text style={styles.doneBtnText}>{t('hostLBackToListings', language)}</Text>
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
              accessibilityRole="button"
              accessibilityLabel={t('nextStep', language)}
            >
              <Text style={styles.nextBtnText}>{t('nextStep', language)}</Text>
            </TouchableOpacity>
          )}
          {step === 2 && (
            <TouchableOpacity
              style={[styles.nextBtn, !canProceedStep2 && styles.nextBtnDisabled]}
              disabled={!canProceedStep2}
              onPress={next}
              accessibilityRole="button"
              accessibilityLabel={t('nextStep', language)}
            >
              <Text style={styles.nextBtnText}>{t('nextStep', language)}</Text>
            </TouchableOpacity>
          )}
          {step === 3 && (
            <View>
              <Text style={styles.gdprText}>{t('hostLConfirmOwnership', language)}</Text>
              <TouchableOpacity
                style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
                disabled={saving}
                onPress={() => { void handleSave() }}
                accessibilityRole="button"
                accessibilityLabel={t('hostLSaveAndPublish', language)}
              >
                {saving
                  ? <ActivityIndicator size="small" color={C.textInverse} />
                  : <Text style={styles.nextBtnText}>{t('hostLSaveAndPublish', language)}</Text>}
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

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  stepTitle: { fontSize: 22, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.sm },
  stepSubtitle: {
    fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, lineHeight: 20, marginBottom: Spacing.xl,
  },

  platformGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm,
  },
  platformCard: {
    flex: 1,
    minWidth: 95,
    maxWidth: 120,
    height: 100,
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1.5,
    borderColor: C.border,
    gap: Spacing.xs,
  },
  platformCardActive: { borderColor: C.primary, borderWidth: 2, backgroundColor: C.primarySubtle },
  platformEmoji: { marginBottom: 2 },
  platformLabel: { fontSize: 13, fontFamily: Fonts.semibold, color: C.textSecondary, textAlign: 'center' },
  platformLabelActive: { color: C.primary },

  fieldLabel: {
    fontSize: 13, fontFamily: Fonts.semibold, color: C.textSecondary,
    marginBottom: Spacing.sm, marginTop: Spacing.base,
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    fontFamily: Fonts.regular, fontSize: 14,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },

  categoryScroll: { marginBottom: Spacing.sm },
  categoryRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.xs },
  categoryPill: {
    backgroundColor: C.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryPillActive: { backgroundColor: C.primary, borderColor: C.primary },
  categoryPillText: { fontSize: 13, fontFamily: Fonts.semibold, color: C.text },
  categoryPillTextActive: { color: C.textInverse },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  optionCardActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
  optionEmoji: { width: 28, textAlign: 'center' },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontFamily: Fonts.bold, color: C.text, marginBottom: 2 },
  optionDesc: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary },

  icalSection: { marginTop: Spacing.base },
  icalLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  helpLink: { fontSize: 12, color: C.primary, fontFamily: Fonts.semibold },
  testBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  testBtnDisabled: { opacity: 0.5 },
  testBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: C.textInverse },
  icalResult: {
    borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md,
  },
  icalResultSuccess: { backgroundColor: C.successSurface, borderWidth: 1, borderColor: C.success },
  icalResultError: { backgroundColor: C.errorSurface, borderWidth: 1, borderColor: C.error },
  icalResultText: { fontFamily: Fonts.regular, fontSize: 13 },
  icalResultTextSuccess: { color: C.success },
  icalResultTextError: { color: C.error },

  successContainer: { alignItems: 'center', paddingTop: Spacing.xxl },
  successEmoji: { marginBottom: Spacing.md },
  successTitle: { fontSize: 26, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.sm },
  successSubtitle: {
    fontFamily: Fonts.regular, fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22,
    marginBottom: Spacing.xl, paddingHorizontal: Spacing.md,
  },
  infoBox: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  infoTitle: { fontSize: 14, fontFamily: Fonts.bold, color: C.text, marginBottom: Spacing.xs },
  infoItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  infoItem: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary },
  doneBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.xxl,
  },
  doneBtnText: { fontSize: 15, fontFamily: Fonts.extrabold, color: C.textInverse },

  footer: {
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.background,
  },
  gdprText: {
    fontFamily: Fonts.regular, fontSize: 11, color: C.textTertiary, textAlign: 'center',
    marginBottom: Spacing.sm, lineHeight: 16,
  },
  nextBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { fontSize: 16, fontFamily: Fonts.extrabold, color: C.textInverse },
  })
}
