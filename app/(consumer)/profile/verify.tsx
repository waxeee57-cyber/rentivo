import React, { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import * as ImagePicker from 'expo-image-picker'
import { Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { Config } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/hooks/useColors'

type Step = 1 | 2 | 3

const STEP_LABELS: Record<Step, { title: string; subtitle: string; icon: string }> = {
  1: { title: "Driver's License (Front)", subtitle: 'Take a clear photo of the FRONT of your license', icon: '🪪' },
  2: { title: "Driver's License (Back)", subtitle: 'Take a clear photo of the BACK of your license', icon: '🪪' },
  3: { title: 'Selfie with License', subtitle: 'Take a selfie holding your driver\'s license clearly visible', icon: '🤳' },
}

export default function VerifyScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [step, setStep] = useState<Step>(1)
  const [photos, setPhotos] = useState<Record<Step, string | null>>({ 1: null, 2: null, 3: null })
  const [submitted, setSubmitted] = useState(false)

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
      Alert.alert('Photo required', 'Please take a photo before continuing')
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
        Alert.alert('Error', 'Please log in to verify your identity')
        return
      }
      const userId = session.user.id
      const uploadedUrls: string[] = []

      for (const [stepKey, uri] of Object.entries(photos)) {
        if (!uri) continue
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
        uploadedUrls.push(publicUrl)
      }

      await supabase
        .from('rentivo_users')
        .update({
          verification_status: 'pending',
          verification_docs: uploadedUrls,
        })
        .eq('auth_id', userId)

      setSubmitted(true)
    } catch {
      Alert.alert('Error', 'Could not submit documents. Please try again.')
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>
            {Config.useMock ? 'Verified!' : 'Submitted for Review'}
          </Text>
          <Text style={styles.successSubtitle}>
            {Config.useMock
              ? 'Your identity has been verified (demo mode)'
              : 'Your documents are under review — usually takes 2 hours'}
          </Text>
          <Button
            title="Back to Profile"
            onPress={() => router.back()}
            fullWidth
            style={{ marginTop: Spacing.xl }}
          />
        </View>
      </SafeAreaView>
    )
  }

  const stepInfo = STEP_LABELS[step]
  const currentPhoto = photos[step]

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Identity Verification" />

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
        <Text style={styles.stepLabel}>Step {step} of 3</Text>

        {/* Step header */}
        <View style={styles.stepHeader}>
          <Text style={styles.stepIcon}>{stepInfo.icon}</Text>
          <Text style={styles.stepTitle}>{stepInfo.title}</Text>
          <Text style={styles.stepSubtitle}>{stepInfo.subtitle}</Text>
        </View>

        {/* Photo area */}
        {currentPhoto ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: currentPhoto }} style={styles.photoImage} />
            <TouchableOpacity style={styles.retakeBtn} onPress={() => setPhotos(prev => ({ ...prev, [step]: null }))}>
              <Text style={styles.retakeText}>↺ Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderIcon}>📷</Text>
            <Text style={styles.photoPlaceholderText}>No photo taken</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
            <Text style={styles.galleryBtnText}>📁 Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cameraBtn} onPress={pickPhoto}>
            <Text style={styles.cameraBtnText}>📷 Camera</Text>
          </TouchableOpacity>
        </View>

        <Button
          title={step < 3 ? 'Next →' : 'Submit for Verification'}
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
  progressDotActive: { backgroundColor: C.primary },
  progressDotText: { fontSize: 13, fontWeight: '700', color: C.textTertiary },
  progressDotTextActive: { color: C.textInverse },
  progressLine: { width: 40, height: 2, backgroundColor: C.border, marginHorizontal: 4 },
  progressLineActive: { backgroundColor: C.primary },
  stepLabel: { fontSize: 12, color: C.textTertiary, textAlign: 'center', marginBottom: Spacing.xl },
  stepHeader: { alignItems: 'center', marginBottom: Spacing.xl },
  stepIcon: { fontSize: 48, marginBottom: Spacing.md },
  stepTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: Spacing.sm },
  stepSubtitle: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
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
  photoPlaceholderIcon: { fontSize: 40, marginBottom: Spacing.sm },
  photoPlaceholderText: { fontSize: 14, color: C.textTertiary },
  photoPreview: { marginBottom: Spacing.base },
  photoImage: { width: '100%', height: 200, borderRadius: Radius.xl, resizeMode: 'cover' },
  retakeBtn: { marginTop: Spacing.sm, alignSelf: 'center' },
  retakeText: { fontSize: 14, color: C.primary, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: Spacing.md },
  galleryBtn: {
    flex: 1,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  galleryBtnText: { fontSize: 14, color: C.textSecondary, fontWeight: '600' },
  cameraBtn: {
    flex: 1,
    backgroundColor: C.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.primary,
  },
  cameraBtnText: { fontSize: 14, color: C.primaryDark, fontWeight: '600' },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  successIcon: { fontSize: 72, marginBottom: Spacing.xl },
  successTitle: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: Spacing.md },
  successSubtitle: { fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22 },
  })
}
