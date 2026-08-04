import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Spacing, Fonts } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useColors } from '@/lib/hooks/useColors'

export default function OperatorSetupScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const { session, setOperator, language } = useAuthStore()

  const handleCreate = async () => {
    if (!name.trim() || !city.trim()) {
      Alert.alert(t('authSetupRequired', language))
      return
    }
    setLoading(true)
    try {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const { data, error } = await supabase
        .from('rentivo_operators')
        .insert({
          name,
          slug: `${slug}-${Date.now()}`,
          city,
          country: 'ES',
          phone: phone || null,
          latitude: 36.5101,
          longitude: -4.8824,
          auth_id: (session as Record<string, unknown> & { user?: { id: string } })?.user?.id,
        })
        .select()
        .single()

      if (error) throw error
      setOperator(data)
      router.replace('/(operator)/dashboard')
    } catch (e) {
      Alert.alert(t('authError', language), String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('authSetupTitle', language)}</Text>
        <Text style={styles.subtitle}>{t('authSetupSubtitle', language)}</Text>

        <Input label={t('authSetupBusinessName', language)} value={name} onChangeText={setName} placeholder={t('authSetupBusinessNamePlaceholder', language)} />
        <Input label={t('hostLCityReq', language)} value={city} onChangeText={setCity} placeholder={t('hostLCityMarbella', language)} />
        <Input label={t('authSetupPhone', language)} value={phone} onChangeText={setPhone} placeholder={t('authPhonePlaceholder', language)} keyboardType="phone-pad" />

        <Button title={t('authSetupGetStarted', language)} onPress={handleCreate} loading={loading} fullWidth style={{ marginTop: Spacing.xl }} />
      </View>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { flex: 1, padding: Spacing.xl, justifyContent: 'center' },
  title: { fontSize: 28, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: C.textSecondary, marginBottom: Spacing.xl },
  })
}
