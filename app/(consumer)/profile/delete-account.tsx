import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'

export default function DeleteAccountScreen() {
  const { language, signOut } = useAuthStore()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)

  const isHu = language === 'hu'

  const handleDelete = () => {
    Alert.alert(
      isHu ? 'Fiók végleges törlése' : 'Permanently delete account',
      isHu
        ? 'Ez a művelet visszafordíthatatlan. Minden adatod törlésre kerül. Biztosan folytatod?'
        : 'This action is irreversible. All your data will be deleted. Are you sure?',
      [
        {
          text: isHu ? 'Mégse' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isHu ? 'Törlés' : 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ],
    )
  }

  const confirmDelete = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        Alert.alert(
          isHu ? 'Hiba' : 'Error',
          isHu ? 'Nincs aktív munkamenet. Kérjük jelentkezz be újra.' : 'No active session. Please log in again.',
        )
        return
      }

      const url = `${Config.supabaseUrl}/functions/v1/delete-account`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const body = await response.json() as { error?: string }
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }

      await signOut()
      router.replace('/')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      Alert.alert(isHu ? 'Hiba' : 'Error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + Spacing.base }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.back, { paddingTop: insets.top + Spacing.sm }]}
          onPress={() => router.back()}
          accessibilityLabel={isHu ? 'Vissza' : 'Go back'}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>← {isHu ? 'Vissza' : 'Back'}</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.icon}>🗑️</Text>
          <Text style={styles.title}>
            {isHu ? 'Fiók törlése' : 'Delete Account'}
          </Text>
          <Text style={styles.subtitle}>
            {isHu
              ? 'A GDPR 17. cikke alapján jogod van kérni adataid törlését.'
              : 'Under GDPR Article 17, you have the right to request erasure of your data.'}
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>
              {isHu ? 'Mi történik a törléskor?' : 'What happens when you delete?'}
            </Text>
            <Text style={styles.infoItem}>
              {isHu ? '• Profilod és személyes adataid törlődnek' : '• Your profile and personal data are deleted'}
            </Text>
            <Text style={styles.infoItem}>
              {isHu ? '• Foglalásaid névtelenítve megmaradnak (pénzügyi kötelezettség)' : '• Bookings are anonymized and retained (financial obligation)'}
            </Text>
            <Text style={styles.infoItem}>
              {isHu ? '• Értékeléseid névtelenítve megmaradnak' : '• Reviews are anonymized and kept'}
            </Text>
            <Text style={styles.infoItem}>
              {isHu ? '• Mentett hirdetéseid törlődnek' : '• Your saved listings are deleted'}
            </Text>
            <Text style={styles.infoItem}>
              {isHu ? '• Ez a művelet visszafordíthatatlan' : '• This action is irreversible'}
            </Text>
          </View>

          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              ⚠️ {isHu
                ? 'Ha aktív foglalásod van, törlés előtt kérd azok lemondását.'
                : 'If you have active bookings, please cancel them before deleting.'}
            </Text>
          </View>

          <Button
            title={isHu ? 'Fiók végleges törlése' : 'Permanently delete account'}
            onPress={handleDelete}
            variant="danger"
            loading={loading}
            fullWidth
            style={styles.deleteBtn}
          />

          <TouchableOpacity
            style={styles.cancelLink}
            onPress={() => router.back()}
            accessibilityLabel={isHu ? 'Mégse' : 'Cancel'}
            accessibilityRole="button"
          >
            <Text style={styles.cancelLinkText}>
              {isHu ? 'Mégse, megtartom a fiókot' : 'Cancel, keep my account'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1 },
  back: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  backText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  content: { flex: 1, padding: Spacing.base },
  icon: { fontSize: 48, marginBottom: Spacing.base },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  subtitle: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  infoItem: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  warningCard: {
    backgroundColor: Colors.errorSurface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.error,
    marginBottom: Spacing.xl,
  },
  warningText: { fontSize: 13, color: Colors.error, lineHeight: 20 },
  deleteBtn: { marginBottom: Spacing.md },
  cancelLink: { alignItems: 'center', padding: Spacing.md, minHeight: 44, justifyContent: 'center' },
  cancelLinkText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
})
