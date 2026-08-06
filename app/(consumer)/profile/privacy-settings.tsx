import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { exportMyData } from '@/lib/api/gdpr'

function PrivacySettingsSkeleton() {
  const C = useColors()
  const skeletonStyles = useMemo(() => makeSkeletonStyles(C), [C])
  const opacity = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ]),
    ).start()
  }, [])
  return (
    <View style={skeletonStyles.container}>
      <Animated.View style={[skeletonStyles.row, skeletonStyles.titleRow, { opacity }]} />
      <Animated.View style={[skeletonStyles.row, skeletonStyles.subtitleRow, { opacity }]} />
      <Animated.View style={[skeletonStyles.section, { opacity }]} />
      <Animated.View style={[skeletonStyles.section, { opacity }]} />
      <Animated.View style={[skeletonStyles.section, { opacity }]} />
    </View>
  )
}

function makeSkeletonStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  container: {
    flex: 1, backgroundColor: C.background,
    padding: Spacing.base, paddingTop: Spacing.xxxl,
  },
  row: { backgroundColor: C.surface, borderRadius: 8 },
  titleRow: { height: 32, width: '60%', marginBottom: Spacing.sm },
  subtitleRow: { height: 16, width: '90%', marginBottom: Spacing.xl },
  section: {
    height: 120, backgroundColor: C.surface,
    borderRadius: Radius.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: C.border,
  },
}) }

interface ConsentRecord {
  marketing_email: boolean
  marketing_push: boolean
  analytics: boolean
}

export default function PrivacySettingsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language } = useAuthStore()
  const insets = useSafeAreaInsets()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [marketingEmail, setMarketingEmail] = useState(false)
  const [marketingPush, setMarketingPush] = useState(false)
  const [analytics, setAnalytics] = useState(false)

  const loadConsent = useCallback(async () => {
    if (Config.useMock) {
      setLoading(false)
      return
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoading(false); return }

      const { data } = await supabase
        .from('rentivo_consent')
        .select('marketing_email, marketing_push, analytics')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (data) {
        const record = data as ConsentRecord
        setMarketingEmail(record.marketing_email ?? false)
        setMarketingPush(record.marketing_push ?? false)
        setAnalytics(record.analytics ?? false)
      }
    } catch {
      // silent — user may not have a consent record yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConsent()
  }, [loadConsent])

  const updateConsent = async (field: keyof ConsentRecord, value: boolean) => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const now = new Date().toISOString()
      const updateData: Record<string, boolean | string | null> = {
        [field]: value,
        [`${field}_at`]: value ? now : null,
      }

      // The result was discarded. supabase-js RESOLVES on a PostgREST failure
      // rather than rejecting, so the surrounding try/catch could not see it:
      // a rejected consent write showed as an applied toggle, and the switch
      // had already been flipped optimistically by the caller. Withdrawing
      // consent is exactly the operation that must not silently fail.
      const { error: consentError } = await supabase.from('rentivo_consent').upsert(
        { user_id: session.user.id, ...updateData },
        { onConflict: 'user_id' },
      )
      if (consentError) throw consentError

      // Push consent withdrawn → null the token on both tables (auth_id FK)
      if (field === 'marketing_push' && !value) {
        await supabase.from('rentivo_users').update({ push_token: null }).eq('auth_id', session.user.id)
        await supabase.from('rentivo_operators').update({ push_token: null }).eq('auth_id', session.user.id)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Alert.alert(t('opFleet2Error', language), msg)
    } finally {
      setSaving(false)
    }
  }

  const handleMarketingEmail = (value: boolean) => {
    setMarketingEmail(value)
    void updateConsent('marketing_email', value)
  }

  const handleMarketingPush = (value: boolean) => {
    setMarketingPush(value)
    void updateConsent('marketing_push', value)
  }

  const handleAnalytics = (value: boolean) => {
    setAnalytics(value)
    void updateConsent('analytics', value)
  }

  // GDPR Art. 20. This used to raise an Alert promising the data by email within
  // 30 days and then do nothing whatsoever — no job, no mail, no file. The export
  // is now produced on the spot and handed to the share sheet.
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(async () => {
    if (exporting) return
    setExporting(true)
    try {
      const result = await exportMyData()
      if (!result.ok) {
        Alert.alert(t('opFleet2Error', language), result.error ?? 'export-failed')
        return
      }
      // Body is the file name, not prose: the share sheet has already opened and
      // the only thing left to tell the user is what the file is called.
      Alert.alert(t('cprDataExportTitle', language), result.fileName ?? '')
    } finally {
      setExporting(false)
    }
  }, [exporting, language])

  if (loading) {
    return <PrivacySettingsSkeleton />
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
          <Text style={styles.title}>{t('cprPrivacySettings', language)}</Text>
          <Text style={styles.subtitle}>{t('cprPrivacySettingsSubtitle', language)}</Text>

          {saving && (
            <View style={styles.savingBadge}>
              <ActivityIndicator color={C.primary} size="small" />
              <Text style={styles.savingText}>{t('opFleet2Saving', language)}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('cprSectionMarketing', language)}</Text>

            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <Text style={styles.switchTitle}>{t('cprMarketingEmails', language)}</Text>
                <Text style={styles.switchMeta}>{t('cprMarketingEmailsDesc', language)}</Text>
              </View>
              <Switch
                value={marketingEmail}
                onValueChange={handleMarketingEmail}
                trackColor={{ false: C.border, true: C.primary }}
                thumbColor={C.white}
                accessibilityLabel={t('cprMarketingEmailsToggle', language)}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <Text style={styles.switchTitle}>{t('cprPushNotifications', language)}</Text>
                <Text style={styles.switchMeta}>{t('cprPushNotificationsDesc', language)}</Text>
              </View>
              <Switch
                value={marketingPush}
                onValueChange={handleMarketingPush}
                trackColor={{ false: C.border, true: C.primary }}
                thumbColor={C.white}
                accessibilityLabel={t('cprPushNotificationsToggle', language)}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('cprSectionAnalytics', language)}</Text>

            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <Text style={styles.switchTitle}>{t('cprAnalytics', language)}</Text>
                <Text style={styles.switchMeta}>{t('cprAnalyticsDesc', language)}</Text>
              </View>
              <Switch
                value={analytics}
                onValueChange={handleAnalytics}
                trackColor={{ false: C.border, true: C.primary }}
                thumbColor={C.white}
                accessibilityLabel={t('cprAnalyticsToggle', language)}
              />
            </View>
          </View>

          {/* Data portability */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('cprSectionData', language)}</Text>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => void handleExport()}
              disabled={exporting}
              accessibilityLabel={t('cprExportMyData', language)}
              accessibilityRole="button"
              accessibilityState={{ disabled: exporting, busy: exporting }}
            >
              <View style={styles.actionLabelRow}>
                <Ionicons name="download-outline" size={16} color={C.text} importantForAccessibility="no" />
                <Text style={styles.actionText}>{t('cprExportMyData', language)}</Text>
              </View>
              {exporting
                ? <ActivityIndicator color={C.primary} size="small" />
                : <Text style={styles.chevron}>›</Text>}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/(consumer)/profile/delete-account' as Href)}
              accessibilityLabel={t('cprDeleteAccount', language)}
              accessibilityRole="button"
            >
              <View style={styles.actionLabelRow}>
                <Ionicons name="trash-outline" size={16} color={C.error} importantForAccessibility="no" />
                <Text style={[styles.actionText, styles.dangerText]}>{t('cprDeleteAccount', language)}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.gdprNote}>{t('cprGdprNote', language)}</Text>
        </View>
      </ScrollView>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1 },
  back: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  // Navigation, not a primary action → muted ink (5.67:1 light, 8.61:1 dark).
  backText: { fontSize: 16, color: C.textSecondary, fontFamily: Fonts.semibold },
  content: { padding: Spacing.base },
  title: { fontSize: 26, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: C.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: C.primarySurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  savingText: { fontSize: 12, color: C.primary, fontFamily: Fonts.semibold },
  section: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: C.textTertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  switchContent: { flex: 1, marginRight: Spacing.md },
  switchTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: C.text },
  switchMeta: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: Spacing.sm },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  actionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  actionText: { fontFamily: Fonts.regular, fontSize: 15, color: C.text },
  dangerText: { color: C.error },
  chevron: { fontFamily: Fonts.regular, fontSize: 20, color: C.textTertiary },
  gdprNote: {
    fontFamily: Fonts.regular, fontSize: 12,
    color: C.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.base,
  },
  })
}
