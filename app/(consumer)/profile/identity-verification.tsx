import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Spacing, Radius } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'

// Wrapper to allow pending cpr keys before i18n.ts is updated
const cprT = (key: string, lang: 'en' | 'es' | 'hu'): string =>
  t(key as unknown as TranslationKey, lang)

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
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language, user } = useAuthStore()
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
        t('opFleet2Error', language),
        err instanceof Error ? err.message : cprT('cprSomethingWentWrong', language),
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
      title: t('opFleet2Loading', language),
      desc: '',
      cta: '',
      color: C.textSecondary,
    },
    unverified: {
      icon: '📋',
      title: cprT('cprVerificationRequired', language),
      desc: cprT('cprVerificationRequiredDesc', language),
      cta: cprT('cprStartVerification', language),
      color: C.primary,
    },
    pending: {
      icon: '⏳',
      title: cprT('cprVerificationPending', language),
      desc: cprT('cprVerificationPendingDesc', language),
      cta: cprT('cprRefresh', language),
      color: C.warning,
    },
    in_progress: {
      icon: '🔄',
      title: cprT('cprInProgress', language),
      desc: cprT('cprInProgressDesc', language),
      cta: cprT('cprRefreshStatus', language),
      color: C.warning,
    },
    approved: {
      icon: '✅',
      title: cprT('cprIdentityVerified', language),
      desc: cprT('cprIdentityVerifiedDesc', language),
      cta: '',
      color: C.success,
    },
    declined: {
      icon: '❌',
      title: cprT('cprVerificationFailed', language),
      desc: cprT('cprVerificationFailedDesc', language),
      cta: cprT('cprTryAgain', language),
      color: C.error,
    },
    expired: {
      icon: '⌛',
      title: cprT('cprSessionExpired', language),
      desc: cprT('cprSessionExpiredDesc', language),
      cta: cprT('cprStartAgain', language),
      color: C.warning,
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
          accessibilityLabel={t('opFleet2GoBack', language)}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('identityVerification', language)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {status === 'loading' ? (
          <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 60 }} />
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
                  accessibilityRole="button"
                >
                  {loading
                    ? <ActivityIndicator color={C.background} />
                    : <Text style={styles.ctaText}>{config.cta}</Text>}
                </TouchableOpacity>
              ) : null}
            </View>

            {(status === 'unverified' || status === 'declined' || status === 'expired') && (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>{cprT('cprWhatWeVerify', language)}</Text>
                {[
                  cprT('cprVerifyDoc', language),
                  cprT('cprVerifySelfie', language),
                  cprT('cprVerifyTime', language),
                  cprT('cprVerifyGdpr', language),
                ].map((item, i) => (
                  <Text key={i} style={styles.infoItem}>{item}</Text>
                ))}
                <View style={styles.poweredByRow}>
                  <Text style={styles.poweredBy}>Powered by </Text>
                  <Text style={[styles.poweredBy, { color: C.primary }]}>Didit</Text>
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

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backButton: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backText: { color: C.text, fontSize: 22 },
  title: { color: C.text, fontSize: 18, fontWeight: '700', flex: 1 },
  content: { padding: Spacing.base, paddingBottom: 80, gap: 16 },
  statusCard: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: { fontSize: 52 },
  statusTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  statusDesc: {
    color: C.textSecondary,
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
  ctaText: { color: C.background, fontSize: 16, fontWeight: '700' },
  infoCard: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.base,
    gap: 8,
  },
  infoTitle: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  infoItem: { color: C.textSecondary, fontSize: 14, lineHeight: 22 },
  poweredByRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  poweredBy: { color: C.textTertiary, fontSize: 12 },
  })
}
