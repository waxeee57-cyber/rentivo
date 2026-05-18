import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { Href } from 'expo-router'
import { Spacing, Radius } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'

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
  const isHu = language === 'hu'

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

      await supabase.from('rentivo_consent').upsert(
        { user_id: session.user.id, ...updateData },
        { onConflict: 'user_id' },
      )

      // Push consent withdrawn → null the token on both tables (auth_id FK)
      if (field === 'marketing_push' && !value) {
        await supabase.from('rentivo_users').update({ push_token: null }).eq('auth_id', session.user.id)
        await supabase.from('rentivo_operators').update({ push_token: null }).eq('auth_id', session.user.id)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Alert.alert(isHu ? 'Hiba' : 'Error', msg)
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

  const handleExport = () => {
    Alert.alert(
      isHu ? 'Adatexport' : 'Data Export',
      isHu
        ? 'Adataidat elküldjük az email-címedre 30 napon belül. GDPR 20. cikk — adathordozhatóság.'
        : 'We will send your data to your email within 30 days. GDPR Article 20 — data portability.',
      [{ text: 'OK' }],
    )
  }

  if (loading) {
    return <PrivacySettingsSkeleton />
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
          <Text style={styles.title}>
            {isHu ? 'Adatvédelmi beállítások' : 'Privacy Settings'}
          </Text>
          <Text style={styles.subtitle}>
            {isHu
              ? 'A GDPR alapján bármikor módosíthatod hozzájárulásaidat.'
              : 'Under GDPR, you can modify your consent preferences at any time.'}
          </Text>

          {saving && (
            <View style={styles.savingBadge}>
              <ActivityIndicator color={C.primary} size="small" />
              <Text style={styles.savingText}>{isHu ? 'Mentés...' : 'Saving...'}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {isHu ? 'MARKETING' : 'MARKETING'}
            </Text>

            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <Text style={styles.switchTitle}>
                  {isHu ? 'Marketing e-mailek' : 'Marketing emails'}
                </Text>
                <Text style={styles.switchMeta}>
                  {isHu
                    ? 'Ajánlatok, hírek és tippek emailben'
                    : 'Offers, news and tips by email'}
                </Text>
              </View>
              <Switch
                value={marketingEmail}
                onValueChange={handleMarketingEmail}
                trackColor={{ false: C.border, true: C.primary }}
                thumbColor={C.white}
                accessibilityLabel={isHu ? 'Marketing e-mailek kapcsoló' : 'Marketing emails toggle'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <Text style={styles.switchTitle}>
                  {isHu ? 'Push értesítések' : 'Push notifications'}
                </Text>
                <Text style={styles.switchMeta}>
                  {isHu
                    ? 'Ajánlatok és frissítések push értesítésben'
                    : 'Offers and updates via push'}
                </Text>
              </View>
              <Switch
                value={marketingPush}
                onValueChange={handleMarketingPush}
                trackColor={{ false: C.border, true: C.primary }}
                thumbColor={C.white}
                accessibilityLabel={isHu ? 'Push értesítések kapcsoló' : 'Push notifications toggle'}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {isHu ? 'ANALITIKA' : 'ANALYTICS'}
            </Text>

            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <Text style={styles.switchTitle}>
                  {isHu ? 'Analitika' : 'Analytics'}
                </Text>
                <Text style={styles.switchMeta}>
                  {isHu
                    ? 'Segíts javítani a Rentivo-t névtelen adatokkal'
                    : 'Help improve Rentivo with anonymous data'}
                </Text>
              </View>
              <Switch
                value={analytics}
                onValueChange={handleAnalytics}
                trackColor={{ false: C.border, true: C.primary }}
                thumbColor={C.white}
                accessibilityLabel={isHu ? 'Analitika kapcsoló' : 'Analytics toggle'}
              />
            </View>
          </View>

          {/* Data portability */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {isHu ? 'ADATOK' : 'DATA'}
            </Text>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleExport}
              accessibilityLabel={isHu ? 'Adataim exportálása' : 'Export my data'}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>
                📤 {isHu ? 'Adataim exportálása' : 'Export my data'}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/(consumer)/profile/delete-account' as Href)}
              accessibilityLabel={isHu ? 'Fiók törlése' : 'Delete account'}
              accessibilityRole="button"
            >
              <Text style={[styles.actionText, styles.dangerText]}>
                🗑️ {isHu ? 'Fiók törlése' : 'Delete account'}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.gdprNote}>
            {isHu
              ? 'GDPR jogaid: tájékoztatás, hozzáférés, helyesbítés, törlés, hordozhatóság, tiltakozás. Kérdéssel írj: privacy@rentivo.app'
              : 'Your GDPR rights: information, access, rectification, erasure, portability, objection. Questions: privacy@rentivo.app'}
          </Text>
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
  backText: { fontSize: 16, color: C.primary, fontWeight: '600' },
  content: { padding: Spacing.base },
  title: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: Spacing.sm },
  subtitle: { fontSize: 15, color: C.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
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
  savingText: { fontSize: 12, color: C.primary, fontWeight: '600' },
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
    fontWeight: '700',
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
  switchTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  switchMeta: { fontSize: 12, color: C.textTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: Spacing.sm },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  actionText: { fontSize: 15, color: C.text },
  dangerText: { color: C.error },
  chevron: { fontSize: 20, color: C.textTertiary },
  gdprNote: {
    fontSize: 12,
    color: C.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.base,
  },
  })
}
