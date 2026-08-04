import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'

// Wrapper to allow pending cpr keys before i18n.ts is updated
const cprT = (key: string, lang: 'en' | 'es' | 'hu'): string =>
  t(key as unknown as TranslationKey, lang)

export default function DeleteAccountScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language, signOut } = useAuthStore()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)

  const handleDelete = () => {
    Alert.alert(
      cprT('cprPermanentlyDelete', language),
      cprT('cprDeleteAccountConfirmBody', language),
      [
        {
          text: t('cancel', language),
          style: 'cancel',
        },
        {
          text: t('opFleetDelete', language),
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
          t('opFleet2Error', language),
          cprT('cprNoActiveSession', language),
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
      Alert.alert(t('opFleet2Error', language), msg)
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
          accessibilityLabel={t('opFleet2GoBack', language)}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>← {t('opBkBack', language)}</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Ionicons name="trash-outline" size={48} color={C.error} style={styles.icon} importantForAccessibility="no" />
          <Text style={styles.title}>{cprT('cprDeleteAccount', language)}</Text>
          <Text style={styles.subtitle}>{cprT('cprDeleteAccountSubtitle', language)}</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{cprT('cprDeleteAccountInfoTitle', language)}</Text>
            <Text style={styles.infoItem}>{cprT('cprDeleteItem1', language)}</Text>
            <Text style={styles.infoItem}>{cprT('cprDeleteItem2', language)}</Text>
            <Text style={styles.infoItem}>{cprT('cprDeleteItem3', language)}</Text>
            <Text style={styles.infoItem}>{cprT('cprDeleteItem4', language)}</Text>
            <Text style={styles.infoItem}>{cprT('cprDeleteItem5', language)}</Text>
          </View>

          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={16} color={C.error} style={styles.warningIcon} importantForAccessibility="no" />
            <Text style={styles.warningText}>
              {cprT('cprDeleteWarning', language)}
            </Text>
          </View>

          <Button
            title={cprT('cprPermanentlyDelete', language)}
            onPress={handleDelete}
            variant="danger"
            loading={loading}
            fullWidth
            style={styles.deleteBtn}
          />

          <TouchableOpacity
            style={styles.cancelLink}
            onPress={() => router.back()}
            accessibilityLabel={t('cancel', language)}
            accessibilityRole="button"
          >
            <Text style={styles.cancelLinkText}>
              {cprT('cprCancelKeepAccount', language)}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { flexGrow: 1 },
  back: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  // Navigation, not a primary action → muted ink (5.67:1 light, 8.61:1 dark).
  backText: { fontSize: 16, color: C.textSecondary, fontFamily: Fonts.semibold },
  content: { flex: 1, padding: Spacing.base },
  icon: { marginBottom: Spacing.base },
  title: { fontSize: 26, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: C.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  infoCard: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  infoTitle: { fontSize: 14, fontFamily: Fonts.bold, color: C.text, marginBottom: Spacing.sm },
  infoItem: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.errorSurface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.error,
    marginBottom: Spacing.xl,
  },
  warningIcon: { marginRight: Spacing.sm, marginTop: 2 },
  warningText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: C.error, lineHeight: 20 },
  deleteBtn: { marginBottom: Spacing.md },
  cancelLink: { alignItems: 'center', padding: Spacing.md, minHeight: 44, justifyContent: 'center' },
  cancelLinkText: { fontSize: 15, color: C.textSecondary, fontFamily: Fonts.medium },
  })
}
