import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { Config } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/hooks/useColors'

type StepStatus = 'done' | 'pending' | 'active'

const STEPS: { label: string; status: StepStatus }[] = [
  { label: 'Account created', status: 'done' },
  { label: 'Connect bank account', status: 'pending' },
  { label: 'Verify identity', status: 'pending' },
  { label: 'Start accepting payments', status: 'pending' },
]

function StepRow({ label, status }: { label: string; status: StepStatus }) {
  const C = useColors()
  const stepStyles = useMemo(() => makeStepStyles(C), [C])
  return (
    <View style={stepStyles.row}>
      <View style={[stepStyles.dot,
        status === 'done' && stepStyles.dotDone,
        status === 'active' && stepStyles.dotActive,
      ]}>
        <Text style={stepStyles.dotText}>
          {status === 'done' ? '✓' : '⏳'}
        </Text>
      </View>
      <Text style={[stepStyles.label, status === 'done' && stepStyles.labelDone]}>
        {label}
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
  dotActive: { backgroundColor: C.primary },
  dotText: { fontSize: 12, color: C.textInverse, fontWeight: '700' },
  label: { fontSize: 15, color: C.textSecondary },
  labelDone: { color: C.text, fontWeight: '600' },
}) }

export default function OperatorStripeScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
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
      const msg = e instanceof Error ? e.message : 'Could not start Stripe onboarding'
      Alert.alert('Connection error', msg)
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
          <Text style={styles.icon}>💳</Text>
        </View>

        <Text style={styles.title}>Set up payouts</Text>
        <Text style={styles.subtitle}>
          Get paid directly to your bank account when guests book your vehicles.
        </Text>

        <View style={styles.stepsCard}>
          {STEPS.map(step => (
            <StepRow key={step.label} label={step.label} status={step.status} />
          ))}
        </View>

        <View style={styles.stripeNote}>
          <Text style={styles.stripeNoteText}>
            🔒  Your payouts are processed securely by Stripe. Rentivo never holds your money.
          </Text>
        </View>

        <Button
          title={connecting ? 'Connecting...' : 'Connect with Stripe'}
          onPress={handleConnect}
          fullWidth
          style={styles.connectBtn}
        />

        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Set up later →</Text>
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
  icon: { fontSize: 36 },
  title: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: Spacing.md, textAlign: 'center' },
  subtitle: { fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
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
  },
  stripeNoteText: { fontSize: 13, color: C.info, lineHeight: 20 },
  connectBtn: { marginBottom: Spacing.md },
  skipBtn: { paddingVertical: Spacing.md },
  skipText: { fontSize: 14, color: C.textTertiary },
  })
}
