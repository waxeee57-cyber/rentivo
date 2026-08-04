import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { Config } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'

type StepStatus = 'done' | 'pending' | 'active'

const STEP_KEYS: { labelKey: string; status: StepStatus }[] = [
  { labelKey: 'auth2StepAccountCreated', status: 'done' },
  { labelKey: 'auth2StepConnectBank', status: 'pending' },
  { labelKey: 'auth2StepVerifyIdentity', status: 'pending' },
  { labelKey: 'auth2StepStartPayments', status: 'pending' },
]

function StepRow({
  labelKey,
  status,
  language,
}: {
  labelKey: string
  status: StepStatus
  language: 'en' | 'es' | 'hu'
}) {
  const C = useColors()
  const stepStyles = useMemo(() => makeStepStyles(C), [C])
  return (
    <View style={stepStyles.row}>
      <View style={[stepStyles.dot,
        status === 'done' && stepStyles.dotDone,
        status === 'active' && stepStyles.dotActive,
      ]}>
        {status === 'done'
          ? <Text style={stepStyles.dotText}>✓</Text>
          : <Ionicons name="time-outline" size={14} color={C.textInverse} importantForAccessibility="no" />}
      </View>
      <Text style={[stepStyles.label, status === 'done' && stepStyles.labelDone]}>
        {t(labelKey as TranslationKey, language)}
      </Text>
    </View>
  )
}

function makeStepStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: C.success },
  // Step indicator: ink for the active step, C.border for the remaining ones.
  // textInverse on C.text = 15:1 in both themes.
  dotActive: { backgroundColor: C.text },
  dotText: { fontSize: 12, color: C.textInverse, fontFamily: Fonts.bold },
  label: { fontFamily: Fonts.regular, fontSize: 15, color: C.textSecondary },
  labelDone: { color: C.text, fontFamily: Fonts.semibold },
}) }

export default function OperatorStripeScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language } = useAuthStore()
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    if (Config.useMock) {
      setConnecting(true)
      setTimeout(() => {
        router.replace('/(operator)/dashboard')
      }, 1000)
      return
    }
    setConnecting(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-account-link')
      if (error) throw error
      if (data?.url) {
        await Linking.openURL(data.url)
      }
      router.replace('/(operator)/dashboard')
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('auth2StripeOnboardingError', language)
      Alert.alert(t('auth2ConnectionError', language), msg)
    } finally {
      setConnecting(false)
    }
  }

  const handleSkip = () => {
    router.replace('/(operator)/dashboard')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="card-outline" size={36} color={C.primary} importantForAccessibility="no" />
        </View>

        <Text style={styles.title}>{t('auth2SetupPayouts', language)}</Text>
        <Text style={styles.subtitle}>
          {t('auth2OperatorPayoutsSubtitle', language)}
        </Text>

        <View style={styles.stepsCard}>
          {STEP_KEYS.map(step => (
            <StepRow key={step.labelKey} labelKey={step.labelKey} status={step.status} language={language} />
          ))}
        </View>

        <View style={styles.stripeNote}>
          <Ionicons name="lock-closed" size={14} color={C.info} importantForAccessibility="no" />
          <Text style={styles.stripeNoteText}>
            {t('auth2StripeSecureNote', language)}
          </Text>
        </View>

        <Button
          title={connecting
            ? t('auth2Connecting', language)
            : t('auth2ConnectStripe', language)}
          onPress={handleConnect}
          fullWidth
          style={styles.connectBtn}
        />

        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipBtn}
          accessibilityRole="button"
          accessibilityLabel={t('auth2SetupLater', language)}
        >
          <Text style={styles.skipText}>{t('auth2SetupLater', language)}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: { fontSize: 26, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.md, textAlign: 'center' },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  stepsCard: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  stripeNote: {
    backgroundColor: C.infoSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  stripeNoteText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: C.info, lineHeight: 20 },
  connectBtn: { marginBottom: Spacing.md },
  skipBtn: { paddingVertical: Spacing.md, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  skipText: { fontFamily: Fonts.regular, fontSize: 14, color: C.textTertiary },
  })
}
