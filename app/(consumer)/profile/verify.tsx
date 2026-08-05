import React, { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { Config } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import { captureException } from '@/lib/sentry'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'

// Wrapper to allow pending cpr keys before i18n.ts is updated
const cprT = (key: string, lang: 'en' | 'es' | 'hu'): string =>
  t(key as unknown as TranslationKey, lang)

type Step = 1 | 2 | 3

/**
 * The three KYC photos map one-to-one onto three real rentivo_users columns.
 * There is no `verification_docs` array column on that table and never was, so
 * the step number has to resolve to a column name before anything is written.
 */
type DocColumn = 'license_front_url' | 'license_back_url' | 'selfie_url'

const DOC_COLUMN_FOR_STEP: Record<Step, DocColumn> = {
  1: 'license_front_url',
  2: 'license_back_url',
  3: 'selfie_url',
}

export default function VerifyScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language } = useAuthStore()
  const [step, setStep] = useState<Step>(1)
  const [photos, setPhotos] = useState<Record<Step, string | null>>({ 1: null, 2: null, 3: null })
  const [submitted, setSubmitted] = useState(false)

  const stepLabels: Record<Step, { title: string; subtitle: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
    1: {
      title: cprT('cprStep1Title', language),
      subtitle: cprT('cprStep1Subtitle', language),
      icon: 'card-outline',
    },
    2: {
      title: cprT('cprStep2Title', language),
      subtitle: cprT('cprStep2Subtitle', language),
      icon: 'card-outline',
    },
    3: {
      title: cprT('cprStep3Title', language),
      subtitle: cprT('cprStep3Subtitle', language),
      icon: 'person-circle-outline',
    },
  }

  const pickPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => ({ ...prev, [step]: result.assets[0].uri }))
    }
  }

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => ({ ...prev, [step]: result.assets[0].uri }))
    }
  }

  const handleNext = () => {
    if (!photos[step]) {
      Alert.alert(
        cprT('cprPhotoRequired', language),
        cprT('cprPhotoRequiredDesc', language),
      )
      return
    }
    if (step < 3) {
      setStep((step + 1) as Step)
    } else {
      void handleSubmit()
    }
  }

  const handleSubmit = async () => {
    if (Config.useMock) {
      setSubmitted(true)
      return
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        Alert.alert(t('opFleet2Error', language), cprT('cprLoginToVerify', language))
        return
      }
      const userId = session.user.id
      const docUrls: Partial<Record<DocColumn, string>> = {}

      for (const [stepKey, uri] of Object.entries(photos)) {
        if (!uri) continue
        const column = DOC_COLUMN_FOR_STEP[Number(stepKey) as Step]
        if (!column) continue
        const ext = uri.split('.').pop() ?? 'jpg'
        const path = `kyc/${userId}/step${stepKey}_${Date.now()}.${ext}`
        const response = await fetch(uri)
        const blob = await response.blob()
        const { error: uploadError } = await supabase.storage
          .from('verification-docs')
          .upload(path, blob, { contentType: `image/${ext}`, upsert: true })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage
          .from('verification-docs')
          .getPublicUrl(path)
        docUrls[column] = publicUrl
      }

      // rentivo_users has no `verification_docs` column — the three documents
      // live in license_front_url / license_back_url / selfie_url. PostgREST
      // rejects a statement that names an unknown column, so the old write
      // failed as a WHOLE: verification_status was never set either, and
      // because the error was not destructured the success screen appeared
      // anyway. The user photographed their licence, the files reached storage,
      // and nothing on the profile recorded that they had ever done it.
      //
      // 'pending' is one of the four values allowed by
      // rentivo_users_verification_status_check (unverified | pending |
      // verified | rejected).
      //
      // Matched on `id`, not `auth_id`, because `id` is what the RLS UPDATE
      // policy checks (auth.uid() = id) and what the FK to auth.users points at.
      const { data: updated, error: updateError } = await supabase
        .from('rentivo_users')
        .update({
          verification_status: 'pending',
          ...docUrls,
        })
        .eq('id', userId)
        .select('id')

      if (updateError) throw updateError
      // supabase-js reports no error for an UPDATE that matched zero rows, so
      // without this check a missing or RLS-invisible profile row would still
      // show "submitted for review" over documents nothing is pointing at.
      if (!updated || updated.length === 0) {
        throw new Error('Verification documents were uploaded but no user row was updated')
      }

      setSubmitted(true)
    } catch (e) {
      // Identity documents are the one thing a user cannot re-check for
      // themselves, so a failure here has to be recorded somewhere other than
      // an alert the user dismisses.
      captureException(e, { scope: 'verify.submitDocuments' })
      Alert.alert(t('opFleet2Error', language), cprT('cprSubmitDocsFailed', language))
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={64} color={C.success} style={styles.successIcon} importantForAccessibility="no" />
          <Text style={styles.successTitle}>
            {Config.useMock
              ? cprT('cprVerified', language)
              : cprT('cprSubmittedForReview', language)}
          </Text>
          <Text style={styles.successSubtitle}>
            {Config.useMock
              ? cprT('cprVerifiedMockDesc', language)
              : cprT('cprSubmittedForReviewDesc', language)}
          </Text>
          <Button
            title={cprT('cprBackToProfile', language)}
            onPress={() => router.back()}
            fullWidth
            style={{ marginTop: Spacing.xl }}
          />
        </View>
      </SafeAreaView>
    )
  }

  const stepInfo = stepLabels[step]
  const currentPhoto = photos[step]

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('identityVerification', language)} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Progress */}
        <View style={styles.progressRow}>
          {([1, 2, 3] as Step[]).map(s => (
            <View key={s} style={styles.progressStep}>
              <View style={[styles.progressDot, step >= s && styles.progressDotActive]}>
                <Text style={[styles.progressDotText, step >= s && styles.progressDotTextActive]}>
                  {s}
                </Text>
              </View>
              {s < 3 && <View style={[styles.progressLine, step > s && styles.progressLineActive]} />}
            </View>
          ))}
        </View>
        {/* "Step X of 3" — dynamic number interpolation, not translated */}
        <Text style={styles.stepLabel}>Step {step} of 3</Text>

        {/* Step header */}
        <View style={styles.stepHeader}>
          <Ionicons name={stepInfo.icon} size={48} color={C.textSecondary} style={styles.stepIcon} importantForAccessibility="no" />
          <Text style={styles.stepTitle}>{stepInfo.title}</Text>
          <Text style={styles.stepSubtitle}>{stepInfo.subtitle}</Text>
        </View>

        {/* Photo area */}
        {currentPhoto ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: currentPhoto }} style={styles.photoImage} />
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => setPhotos(prev => ({ ...prev, [step]: null }))}
              accessibilityRole="button"
              accessibilityLabel={cprT('cprRetake', language)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.retakeText}>{cprT('cprRetake', language)}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={40} color={C.textTertiary} style={styles.photoPlaceholderIcon} importantForAccessibility="no" />
            <Text style={styles.photoPlaceholderText}>{cprT('cprNoPhotoTaken', language)}</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.galleryBtn}
            onPress={pickFromGallery}
            accessibilityRole="button"
            accessibilityLabel={cprT('cprGallery', language)}
          >
            <Ionicons name="images-outline" size={14} color={C.textSecondary} importantForAccessibility="no" />
            <Text style={styles.galleryBtnText}>{cprT('cprGallery', language)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={pickPhoto}
            accessibilityRole="button"
            accessibilityLabel={cprT('cprCamera', language)}
          >
            <Ionicons name="camera-outline" size={14} color={C.primaryDark} importantForAccessibility="no" />
            <Text style={styles.cameraBtnText}>{cprT('cprCamera', language)}</Text>
          </TouchableOpacity>
        </View>

        <Button
          title={step < 3 ? cprT('cprNext', language) : cprT('cprSubmitForVerification', language)}
          onPress={handleNext}
          fullWidth
          style={{ marginTop: Spacing.xl }}
        />

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  progressStep: { flexDirection: 'row', alignItems: 'center' },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Step indicator: ink for done/active, C.border for the rest — not a CTA.
  // textInverse on C.text = 15:1 in both themes.
  progressDotActive: { backgroundColor: C.text },
  progressDotText: { fontSize: 13, fontFamily: Fonts.bold, color: C.textTertiary },
  progressDotTextActive: { color: C.textInverse },
  progressLine: { width: 40, height: 2, backgroundColor: C.border, marginHorizontal: 4 },
  progressLineActive: { backgroundColor: C.text },
  stepLabel: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, textAlign: 'center', marginBottom: Spacing.xl },
  stepHeader: { alignItems: 'center', marginBottom: Spacing.xl },
  stepIcon: { marginBottom: Spacing.md },
  stepTitle: { fontSize: 20, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.sm },
  stepSubtitle: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
  photoPlaceholder: {
    height: 200,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: C.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  photoPlaceholderIcon: { marginBottom: Spacing.sm },
  photoPlaceholderText: { fontFamily: Fonts.regular, fontSize: 14, color: C.textTertiary },
  photoPreview: { marginBottom: Spacing.base },
  photoImage: { width: '100%', height: 200, borderRadius: Radius.xl, resizeMode: 'cover' },
  retakeBtn: { marginTop: Spacing.sm, alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  retakeText: { fontSize: 14, color: C.primary, fontFamily: Fonts.semibold },
  buttonRow: { flexDirection: 'row', gap: Spacing.md },
  galleryBtn: {
    flex: 1,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  galleryBtnText: { fontSize: 14, color: C.textSecondary, fontFamily: Fonts.semibold },
  cameraBtn: {
    flex: 1,
    backgroundColor: C.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.primary,
    minHeight: 44,
    justifyContent: 'center',
  },
  cameraBtnText: { fontSize: 14, color: C.primaryDark, fontFamily: Fonts.semibold },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  successIcon: { marginBottom: Spacing.xl },
  successTitle: { fontSize: 26, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.md },
  successSubtitle: { fontFamily: Fonts.regular, fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22 },
  })
}
