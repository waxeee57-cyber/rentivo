import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Spacing, Fonts } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useColors } from '@/lib/hooks/useColors'

export default function LoginScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const { role, language } = useAuthStore()

  const handleSendCode = async () => {
    if (!phone.trim()) { Alert.alert(t('authPhoneRequired', language)); return }
    setLoading(true)
    try {
      const normalizedPhone = phone.trim().replace(/\s/g, '')
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
      })
      if (error) throw error
      await AsyncStorage.setItem('pending_otp_phone', normalizedPhone)
      router.push('/auth/verify')
    } catch (e) {
      Alert.alert(t('authError', language), String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleMockLogin = () => {
    useAuthStore.getState().setSession({ mock: true } as Record<string, unknown>)
    if (role === 'operator') {
      router.replace('/(operator)/dashboard')
    } else {
      router.replace('/(consumer)/explore')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.back}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('authBack', language)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.backText}>{t('authBack', language)}</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{t('authLoginTitle', language)}</Text>
          <Text style={styles.subtitle}>{t('authLoginSubtitle', language)}</Text>

          <Button
            title={t('authDemoButton', language)}
            onPress={handleMockLogin}
            variant="ghost"
            fullWidth
            style={{ marginBottom: Spacing.xl }}
          />

          <Input
            label={t('authPhoneLabel', language)}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('authPhonePlaceholder', language)}
            keyboardType="phone-pad"
            autoFocus={false}
          />

          <Button
            title={t('authSendCode', language)}
            onPress={handleSendCode}
            loading={loading}
            fullWidth
            style={{ marginTop: Spacing.sm }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  flex: { flex: 1 },
  back: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  // Navigation, not a primary action → muted ink (5.67:1 light, 8.61:1 dark).
  backText: { fontSize: 16, color: C.textSecondary, fontFamily: Fonts.semibold },
  content: { flexGrow: 1, padding: Spacing.xl, justifyContent: 'center' },
  title: { fontSize: 28, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: C.textSecondary, marginBottom: Spacing.xl },
  })
}
