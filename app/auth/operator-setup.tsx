import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Spacing } from '@/constants/colors'
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
  const { session, setOperator } = useAuthStore()

  const handleCreate = async () => {
    if (!name.trim() || !city.trim()) {
      Alert.alert('Please fill in all required fields')
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
      Alert.alert('Error', String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Set up your business</Text>
        <Text style={styles.subtitle}>Tell us about your rental business to get started.</Text>

        <Input label="Business name *" value={name} onChangeText={setName} placeholder="e.g. CostaSol Car Rent" />
        <Input label="City *" value={city} onChangeText={setCity} placeholder="e.g. Marbella" />
        <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+34 600 000 000" keyboardType="phone-pad" />

        <Button title="Get started →" onPress={handleCreate} loading={loading} fullWidth style={{ marginTop: Spacing.xl }} />
      </View>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { flex: 1, padding: Spacing.xl, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: C.text, marginBottom: Spacing.sm },
  subtitle: { fontSize: 15, color: C.textSecondary, marginBottom: Spacing.xl },
  })
}
