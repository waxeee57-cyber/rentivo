import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useToastStore } from '@/lib/store/useToastStore'
import { supabase } from '@/lib/supabase'
import { captureException } from '@/lib/sentry'
import { MOCK_HOST } from '@/lib/mockData'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'
import type { Host } from '@/types'

const CATEGORY_CHIPS: { key: string; icon: React.ComponentProps<typeof Ionicons>['name']; labelKey: string }[] = [
  { key: 'car', icon: 'car-sport-outline', labelKey: 'auth2CatCar' },
  { key: 'boat', icon: 'boat-outline', labelKey: 'auth2CatBoat' },
  { key: 'villa', icon: 'home-outline', labelKey: 'auth2CatVilla' },
  { key: 'motorcycle', icon: 'bicycle-outline', labelKey: 'auth2CatMotorcycle' },
  { key: 'bike', icon: 'bicycle-outline', labelKey: 'auth2CatBike' },
  { key: 'other', icon: 'cube-outline', labelKey: 'catOther' },
]

type Step = 1 | 2 | 3

export default function HostSetupScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { setHost, setRole, language } = useAuthStore()
  const showToast = useToastStore(s => s.showToast)
  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [onboarding, setOnboarding] = useState(false)
  const fadeAnim = React.useRef(new Animated.Value(1)).current

  const goToStep = (next: Step) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
    setStep(next)
  }

  const toggleCategory = (key: string) => {
    setSelectedCategories(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleVerify = () => {
    if (Config.useMock) {
      setVerifying(true)
      setTimeout(() => {
        setVerifying(false)
        setVerified(true)
      }, 1500)
    } else {
      router.push('/(consumer)/profile/verify')
    }
  }

  /**
   * Create the host record.
   *
   * This used to be a 1000ms setTimeout that set mock state and navigated. In
   * production it wrote NOTHING: no rentivo_hosts row was created anywhere in
   * the app, so the name, city, bio and categories collected over three steps
   * were discarded on the way to the dashboard. Every host screen then failed
   * its `.eq('auth_id', user.id)` lookup and showed "host not found" — the host
   * half of the marketplace could not be entered at all.
   *
   * Mirrors app/auth/operator-setup.tsx, which does this correctly.
   */
  const handleComplete = async () => {
    setOnboarding(true)
    try {
      if (Config.useMock) {
        await new Promise(r => setTimeout(r, 600))
        setHost(MOCK_HOST)
        setRole('host')
        router.replace('/(host)/dashboard')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      const authId = session?.user?.id
      if (!authId) {
        showToast({ message: t('authError', language), type: 'error' })
        router.replace('/auth/login')
        return
      }

      // Re-entering setup must not create a second host record for the same
      // account, so this is an upsert on auth_id rather than a plain insert.
      const { data, error } = await supabase
        .from('rentivo_hosts')
        .upsert({
          auth_id: authId,
          name: name.trim(),
          city: city.trim(),
          bio: bio.trim() || null,
          email: session.user.email ?? null,
          country: 'ES',
          active: true,
          identity_verified: verified,
        }, { onConflict: 'auth_id' })
        .select()
        .single()

      if (error) throw error

      setHost(data as Host)
      setRole('host')
      router.replace('/(host)/dashboard')
    } catch (e) {
      captureException(e, { screen: 'auth/host-setup' })
      showToast({ message: t('authError', language), type: 'error' })
    } finally {
      setOnboarding(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress */}
        <View style={styles.progressBar}>
          {[1, 2, 3].map(s => (
            <View
              key={s}
              style={[styles.progressDot, step >= s && styles.progressDotActive]}
            />
          ))}
        </View>

        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 && (
              <View>
                <Text style={styles.stepLabel}>{t('auth2Step1of3', language)}</Text>
                <Text style={styles.title}>{t('auth2HostAboutYou', language)}</Text>
                <Text style={styles.subtitle}>{t('auth2HostAboutSubtitle', language)}</Text>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth2HostYourName', language)}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('auth2HostFullNamePlaceholder', language)}
                    placeholderTextColor={C.textTertiary}
                    value={name}
                    onChangeText={setName}
                    accessibilityLabel={t('auth2HostYourName', language)}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('hostLCity', language)}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('auth2HostCityPlaceholder', language)}
                    placeholderTextColor={C.textTertiary}
                    value={city}
                    onChangeText={setCity}
                    accessibilityLabel={t('hostLCity', language)}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth2HostBioLabel', language)}</Text>
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    placeholder={t('auth2HostBioPlaceholder', language)}
                    placeholderTextColor={C.textTertiary}
                    value={bio}
                    onChangeText={setBio}
                    multiline
                    numberOfLines={3}
                    accessibilityLabel={t('auth2HostBioLabel', language)}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth2HostWhatCanYouRent', language)}</Text>
                  <View style={styles.chips}>
                    {CATEGORY_CHIPS.map(chip => (
                      <TouchableOpacity
                        key={chip.key}
                        style={[styles.chip, selectedCategories.includes(chip.key) && styles.chipActive]}
                        onPress={() => toggleCategory(chip.key)}
                        accessibilityRole="button"
                        accessibilityLabel={t(chip.labelKey as TranslationKey, language)}
                        accessibilityState={{ selected: selectedCategories.includes(chip.key) }}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      >
                        <Ionicons
                          name={chip.icon}
                          size={16}
                          color={selectedCategories.includes(chip.key) ? C.primaryDark : C.textSecondary}
                          importantForAccessibility="no"
                        />
                        <Text style={[styles.chipLabel, selectedCategories.includes(chip.key) && styles.chipLabelActive]}>
                          {t(chip.labelKey as TranslationKey, language)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, (!name || !city) && styles.primaryBtnDisabled]}
                  onPress={() => goToStep(2)}
                  disabled={!name || !city}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth2ContinueArrow', language)}
                >
                  <Text style={styles.primaryBtnText}>{t('auth2ContinueArrow', language)}</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={styles.stepLabel}>{t('auth2Step2of3', language)}</Text>
                <Text style={styles.title}>{t('auth2VerifyYourIdentity', language)}</Text>
                <Text style={styles.subtitle}>{t('auth2VerifySubtitle', language)}</Text>

                <View style={styles.verifyBox}>
                  <Ionicons name="card-outline" size={40} color={C.info} style={styles.verifyIcon} importantForAccessibility="no" />
                  <Text style={styles.verifyTitle}>{t('auth2DriverLicenseRequired', language)}</Text>
                  <Text style={styles.verifyText}>
                    {t('auth2DriverLicenseText', language)}
                  </Text>
                </View>

                {verified ? (
                  <View style={styles.verifiedBanner}>
                    <Ionicons name="checkmark-circle" size={24} color={C.success} importantForAccessibility="no" />
                    <Text style={styles.verifiedText}>{t('auth2IdentityVerified', language)}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryBtn, verifying && styles.primaryBtnDisabled]}
                    onPress={handleVerify}
                    disabled={verifying}
                    accessibilityRole="button"
                    accessibilityLabel={verifying
                      ? t('auth2Verifying', language)
                      : t('auth2StartVerification', language)}
                  >
                    <Text style={styles.primaryBtnText}>
                      {verifying
                        ? t('auth2Verifying', language)
                        : t('auth2StartVerification', language)}
                    </Text>
                  </TouchableOpacity>
                )}

                {verified && (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { marginTop: Spacing.base }]}
                    onPress={() => goToStep(3)}
                    accessibilityRole="button"
                    accessibilityLabel={t('auth2ContinueArrow', language)}
                  >
                    <Text style={styles.primaryBtnText}>{t('auth2ContinueArrow', language)}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.skipBtn}
                  onPress={() => goToStep(3)}
                  accessibilityRole="button"
                  accessibilityLabel={t('opFleetWizardSkip', language)}
                >
                  <Text style={styles.skipText}>{t('opFleetWizardSkip', language)}</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 3 && (
              <View>
                <Text style={styles.stepLabel}>{t('auth2Step3of3', language)}</Text>
                <Text style={styles.title}>{t('auth2SetupPayouts', language)}</Text>
                <Text style={styles.subtitle}>{t('auth2HostPayoutsSubtitle', language)}</Text>

                <View style={styles.stripeBox}>
                  <Ionicons name="card-outline" size={36} color={C.text} importantForAccessibility="no" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stripeTitle}>{t('auth2RentivoUsesStripe', language)}</Text>
                    <Text style={styles.stripeText}>
                      {t('auth2StripeText', language)}
                    </Text>
                  </View>
                </View>

                <View style={styles.feeNote}>
                  <Ionicons name="bulb-outline" size={14} color={C.primaryDark} importantForAccessibility="no" />
                  <Text style={styles.feeNoteText}>
                    {t('auth2FeeNote', language)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, onboarding && styles.primaryBtnDisabled]}
                  onPress={handleComplete}
                  disabled={onboarding}
                  accessibilityRole="button"
                  accessibilityLabel={onboarding
                    ? t('auth2SettingUp', language)
                    : t('auth2CompleteSetup', language)}
                >
                  <Text style={styles.primaryBtnText}>
                    {onboarding
                      ? t('auth2SettingUp', language)
                      : t('auth2CompleteSetup', language)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipBtn}
                  onPress={handleComplete}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth2SkipPayouts', language)}
                >
                  <Text style={styles.skipText}>{t('auth2SkipPayouts', language)}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.base,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
  },
  // Step indicator: ink for done/active, C.border for the rest. Not a CTA.
  progressDotActive: { backgroundColor: C.text, width: 24 },

  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },

  stepLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    // "Step 1 of 3" is a status label, not an action → muted ink (matches
    // the same label in (consumer)/profile/verify.tsx).
    color: C.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.extrabold,
    color: C.text,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: Fonts.regular, fontSize: 15,
    color: C.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },

  field: { marginBottom: Spacing.lg },
  label: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: C.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.regular, fontSize: 15,
    color: C.text,
  },
  inputMulti: {
    height: 88,
    textAlignVertical: 'top',
    paddingTop: Spacing.md,
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: C.surfaceWarm,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
  },
  chipActive: {
    backgroundColor: C.primarySurface,
    borderColor: C.primary,
  },
  chipLabel: { fontSize: 13, fontFamily: Fonts.semibold, color: C.textSecondary },
  chipLabelActive: { color: C.primaryDark },

  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    marginTop: Spacing.sm,
    minHeight: 44,
  },
  primaryBtnDisabled: {
    backgroundColor: C.textTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: Fonts.extrabold,
    color: C.textInverse,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.base,
    marginTop: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: Fonts.medium,
  },

  verifyBox: {
    backgroundColor: C.infoSurface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: C.info,
  },
  verifyIcon: { marginBottom: Spacing.md },
  verifyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: C.text, marginBottom: Spacing.sm },
  verifyText: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },

  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: C.successSurface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  verifiedText: { fontSize: 15, fontFamily: Fonts.bold, color: C.success },

  stripeBox: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
  },
  stripeTitle: { fontSize: 15, fontFamily: Fonts.bold, color: C.text, marginBottom: 4 },
  stripeText: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, lineHeight: 20 },

  feeNote: {
    backgroundColor: C.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: C.primary,
  },
  feeNoteText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: C.primaryDark, lineHeight: 20 },
  })
}
