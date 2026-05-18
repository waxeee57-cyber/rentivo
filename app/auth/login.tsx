import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors, Spacing } from '@/constants/colors'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'

export default function LoginScreen() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const { role } = useAuthStore()

  const handleSendCode = async () => {
    if (!phone.trim()) { Alert.alert('Please enter your phone number'); return }
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
      Alert.alert('Error', String(e))
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
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
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
          <Text style={styles.title}>Welcome to Rentivo</Text>
          <Text style={styles.subtitle}>Enter your phone number to continue</Text>

          <Button
            title="Continue without account (demo)"
            onPress={handleMockLogin}
            variant="ghost"
            fullWidth
            style={{ marginBottom: Spacing.xl }}
          />

          <Input
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+34 600 000 000"
            keyboardType="phone-pad"
            autoFocus={false}
          />

          <Button
            title="Send verification code"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  back: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  backText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  content: { flexGrow: 1, padding: Spacing.xl, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: Spacing.xl },
})
