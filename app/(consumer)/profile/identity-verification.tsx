import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'

type VerificationStatus =
  | 'loading'
  | 'unverified'
  | 'pending'
  | 'in_progress'
  | 'approved'
  | 'declined'
  | 'expired'

interface StatusConfig {
  icon: string
  title: string
  desc: string
  cta: string
  color: string
}

export default function IdentityVerificationScreen() {
  const { language, user } = useAuthStore()
  const isHu = language === 'hu'
  const [status, setStatus] = useState<VerificationStatus>('loading')
  const [loading, setLoading] = useState(false)

  const loadStatus = useCallback(async () => {
    if (Config.useMock) {
      setStatus('unverified')
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setStatus('unverified'); return }
    const { data } = await supabase
      .from('rentivo_identity_verifications')
      .select('status')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setStatus((data?.status as VerificationStatus) ?? 'unverified')
  }, [])

  useEffect(() => { void loadStatus() }, [loadStatus])

  const startVerification = async () => {
    setLoading(true)
    try {
      if (Config.useMock) {
        setStatus('in_progress')
        setLoading(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/didit-create-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        },
      )
      const data = await response.json() as { session_url?: string; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Failed to start verification')

      if (data.session_url) {
        await Linking.openURL(data.session_url)
      }
      setStatus('in_progress')
    } catch (err) {
      Alert.alert(
        isHu ? 'Hiba' : 'Error',
        err instanceof Error ? err.message : 'Something went wrong',
      )
    } finally {
      setLoading(false)
    }
  }

  // Suppress unused variable warning — user may be needed for future gating
  void user

  const STATUS_CONFIGS: Record<VerificationStatus, StatusConfig> = {
    loading: {
      icon: '⏳',
      title: isHu ? 'Betöltés...' : 'Loading...',
      desc: '',
      cta: '',
      color: Colors.textSecondary,
    },
    unverified: {
      icon: '📋',
      title: isHu ? 'Azonosítás szükséges' : 'Identity verification required',
      desc: isHu
        ? 'Egyes bérlések előtt igazolnod kell a személyazonosságodat. Ez 2 percet vesz igénybe.'
        : 'Some rentals require identity verification before booking. This takes about 2 minutes.',
      cta: isHu ? 'Azonosítás megkezdése' : 'Start verification',
      color: Colors.primary,
    },
    pending: {
      icon: '⏳',
      title: isHu ? 'Feldolgozás alatt' : 'Verification pending',
      desc: isHu ? 'Az azonosítás feldolgozás alatt van.' : 'Your verification is being processed.',
      cta: isHu ? 'Frissítés' : 'Refresh',
      color: Colors.warning,
    },
    in_progress: {
      icon: '🔄',
      title: isHu ? 'Folyamatban' : 'In progress',
      desc: isHu
        ? 'Fejezd be az azonosítást a megnyílt oldalon, majd térj vissza és frissíts.'
        : 'Complete verification on the opened page, then return and refresh.',
      cta: isHu ? 'Frissítés' : 'Refresh status',
      color: Colors.warning,
    },
    approved: {
      icon: '✅',
      title: isHu ? 'Azonosítva' : 'Identity verified',
      desc: isHu
        ? 'A személyazonosságod sikeresen ellenőrizve. Minden bérlés elérhető számodra.'
        : 'Your identity has been successfully verified. All rentals are available to you.',
      cta: '',
      color: Colors.success,
    },
    declined: {
      icon: '❌',
      title: isHu ? 'Sikertelen' : 'Verification failed',
      desc: isHu
        ? 'Az azonosítás sikertelen volt. Próbáld újra érvényes dokumentummal.'
        : 'Verification failed. Please try again with a valid document.',
      cta: isHu ? 'Újrapróbálás' : 'Try again',
      color: Colors.error,
    },
    expired: {
      icon: '⌛',
      title: isHu ? 'Lejárt' : 'Session expired',
      desc: isHu
        ? 'Az azonosítási munkamenet lejárt. Kérjük, indíts újat.'
        : 'The verification session expired. Please start a new one.',
      cta: isHu ? 'Újraindítás' : 'Start again',
      color: Colors.warning,
    },
  }

  const config = STATUS_CONFIGS[status]
  const isRefreshAction = status === 'in_progress' || status === 'pending'

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel={isHu ? 'Vissza' : 'Go back'}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {isHu ? 'Személyazonosság igazolás' : 'Identity Verification'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {status === 'loading' ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
        ) : (
          <>
            <View style={styles.statusCard}>
              <Text style={styles.statusIcon}>{config.icon}</Text>
              <Text style={[styles.statusTitle, { color: config.color }]}>{config.title}</Text>
              {config.desc ? (
                <Text style={styles.statusDesc}>{config.desc}</Text>
              ) : null}
              {config.cta ? (
                <TouchableOpacity
                  style={[styles.ctaButton, { backgroundColor: config.color }]}
                  onPress={isRefreshAction ? loadStatus : startVerification}
                  disabled={loading}
                  accessibilityLabel={config.cta}
                >
                  {loading
                    ? <ActivityIndicator color={Colors.background} />
                    : <Text style={styles.ctaText}>{config.cta}</Text>}
                </TouchableOpacity>
              ) : null}
            </View>

            {(status === 'unverified' || status === 'declined' || status === 'expired') && (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>
                  {isHu ? 'Mit ellenőrzünk' : 'What we verify'}
                </Text>
                {[
                  isHu ? '📄 Jogosítvány vagy személyi igazolvány' : '📄 Driver license or ID card',
                  isHu ? '🤳 Selfie az okmánnyal' : '🤳 Selfie with your document',
                  isHu ? '⏱ Kb. 2 perc' : '⏱ Takes about 2 minutes',
                  isHu ? '🔒 GDPR kompatibilis, adataid védve vannak' : '🔒 GDPR compliant, data protected',
                ].map((item, i) => (
                  <Text key={i} style={styles.infoItem}>{item}</Text>
                ))}
                <View style={styles.poweredByRow}>
                  <Text style={styles.poweredBy}>Powered by </Text>
                  <Text style={[styles.poweredBy, { color: Colors.primary }]}>Didit</Text>
                  <Text style={styles.poweredBy}> — EU eIDAS identity verification</Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backText: { color: Colors.text, fontSize: 22 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700', flex: 1 },
  content: { padding: Spacing.base, paddingBottom: 80, gap: 16 },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: { fontSize: 52 },
  statusTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  statusDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaButton: {
    marginTop: 4,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: Radius.md,
    minHeight: 52,
    alignItems: 'center',
    width: '100%',
  },
  ctaText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: 8,
  },
  infoTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  infoItem: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
  poweredByRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  poweredBy: { color: Colors.textTertiary, fontSize: 12 },
})
