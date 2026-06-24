import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useColors } from '@/lib/hooks/useColors'

export default function VerifyScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const inputs = useRef<(TextInput | null)[]>([])
  const { role, setSession, setUser, setOperator } = useAuthStore()

  useEffect(() => {
    AsyncStorage.getItem('pending_otp_phone').then(saved => {
      if (saved) setPhone(saved)
    })
  }, [])

  const handleDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)
    if (digit && index < 5) inputs.current[index + 1]?.focus()
    if (!digit && index > 0) inputs.current[index - 1]?.focus()
  }

  const handleVerify = async () => {
    const otp = code.join('')
    if (otp.length < 6) { Alert.alert('Please enter the full 6-digit code'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      })
      if (error) throw error
      await AsyncStorage.removeItem('pending_otp_phone')
      setSession(data.session as unknown as Record<string, unknown>)
      if (data.session?.user) {
        // Fetch the full rentivo_users profile so the store has name,
        // phone, and role — not just the bare Supabase Auth user object.
        const { data: profile } = await supabase
          .from('rentivo_users')
          .select('*')
          .eq('id', data.session.user.id)
          .maybeSingle()
        if (profile) {
          setUser(profile as unknown as Parameters<typeof setUser>[0])
        } else {
          // Profile row not yet created (first-ever login): store auth user.
          setUser(data.session.user as unknown as Parameters<typeof setUser>[0])
        }
      }
      // Route based on role — new users without role check consent first
      if (role === 'operator') {
        // Operator must have a rentivo_operators row (keyed on auth_id = auth.uid())
        // before the dashboard/payout flow works. Load it if present, else send the
        // user to the setup form that creates it — never drop them on an empty dashboard.
        const { data: op } = await supabase
          .from('rentivo_operators')
          .select('*')
          .eq('auth_id', data.session!.user.id)
          .maybeSingle()
        if (op) {
          setOperator(op as unknown as Parameters<typeof setOperator>[0])
          router.replace('/(operator)/dashboard')
        } else {
          router.replace('/auth/operator-setup')
        }
      } else if (role === 'host') {
        router.replace('/(host)/dashboard')
      } else if (role === 'consumer') {
        router.replace('/(consumer)/explore')
      } else {
        // New user — check if GDPR consent already collected
        const { data: consentRow } = await supabase
          .from('rentivo_consent')
          .select('user_id')
          .eq('user_id', data.session!.user.id)
          .maybeSingle()
        if (consentRow) {
          router.replace('/onboarding')
        } else {
          router.replace('/auth/consent')
        }
      }
    } catch (e) {
      Alert.alert('Invalid code', 'Please check the code and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to your phone</Text>

        <View style={styles.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={r => { inputs.current[i] = r }}
              style={[styles.codeBox, digit && styles.codeBoxFilled]}
              value={digit}
              onChangeText={v => handleDigit(i, v)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              autoFocus={i === 0}
            />
          ))}
        </View>

        <Button
          title="Verify"
          onPress={handleVerify}
          loading={loading}
          fullWidth
          style={{ marginTop: Spacing.xl }}
        />
      </View>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  back: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  backText: { fontSize: 16, color: C.primary, fontWeight: '600' },
  content: { flex: 1, padding: Spacing.xl, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: Spacing.sm },
  subtitle: { fontSize: 15, color: C.textSecondary, marginBottom: Spacing.xl },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  codeBox: {
    width: 46, height: 56, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: C.border,
    textAlign: 'center', fontSize: 22, fontWeight: '700',
    color: C.text, backgroundColor: C.surface,
  },
  codeBoxFilled: { borderColor: C.primary, backgroundColor: C.primarySurface },
  })
}
