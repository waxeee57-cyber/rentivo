import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Spacing, Radius } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'

// Wrapper to allow pending cpr keys before i18n.ts is updated
const cprT = (key: string, lang: 'en' | 'es' | 'hu'): string =>
  t(key as unknown as TranslationKey, lang)

interface NotificationPrefs {
  booking_confirmed: boolean
  booking_cancelled: boolean
  booking_reminder: boolean
  new_message: boolean
  payment_received: boolean
  review_received: boolean
  promotions: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  booking_confirmed: true,
  booking_cancelled: true,
  booking_reminder: true,
  new_message: true,
  payment_received: true,
  review_received: true,
  promotions: false,
}

interface SectionDef {
  titleKey: string
  items: Array<{ key: keyof NotificationPrefs; labelKey: string; descKey: string }>
}

const SECTIONS: SectionDef[] = [
  {
    titleKey: 'cprSectionBookings',
    items: [
      { key: 'booking_confirmed', labelKey: 'cprNtfBookingConfirmed', descKey: 'cprNtfBookingConfirmedDesc' },
      { key: 'booking_cancelled', labelKey: 'cprNtfBookingCancelled', descKey: 'cprNtfBookingCancelledDesc' },
      { key: 'booking_reminder', labelKey: 'cprNtfBookingReminder', descKey: 'cprNtfBookingReminderDesc' },
    ],
  },
  {
    titleKey: 'cprSectionCommunication',
    items: [
      { key: 'new_message', labelKey: 'cprNtfNewMessage', descKey: 'cprNtfNewMessageDesc' },
      { key: 'review_received', labelKey: 'cprNtfNewReview', descKey: 'cprNtfNewReviewDesc' },
    ],
  },
  {
    titleKey: 'cprSectionPayments',
    items: [
      { key: 'payment_received', labelKey: 'cprNtfPaymentReceived', descKey: 'cprNtfPaymentReceivedDesc' },
    ],
  },
  {
    titleKey: 'cprSectionMarketing',
    items: [
      { key: 'promotions', labelKey: 'cprNtfPromotions', descKey: 'cprNtfPromotionsDesc' },
    ],
  },
]

export default function NotificationsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language } = useAuthStore()
  const insets = useSafeAreaInsets()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)

  const loadPrefs = useCallback(async () => {
    if (Config.useMock) {
      setLoading(false)
      return
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoading(false); return }

      const { data } = await supabase
        .from('rentivo_notification_prefs')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (data) {
        setPrefs({
          booking_confirmed: data.booking_confirmed ?? true,
          booking_cancelled: data.booking_cancelled ?? true,
          booking_reminder: data.booking_reminder ?? true,
          new_message: data.new_message ?? true,
          payment_received: data.payment_received ?? true,
          review_received: data.review_received ?? true,
          promotions: data.promotions ?? false,
        })
      }
    } catch {
      // silent — table may not exist yet, use defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPrefs()
  }, [loadPrefs])

  const updatePref = async (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs(prev => ({ ...prev, [key]: value }))
    if (Config.useMock) return

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      await supabase
        .from('rentivo_notification_prefs')
        .upsert(
          { user_id: session.user.id, [key]: value },
          { onConflict: 'user_id' },
        )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Alert.alert(t('opFleet2Error', language), msg)
      // revert optimistic update
      setPrefs(prev => ({ ...prev, [key]: !value }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + Spacing.base }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back header */}
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
          <Text style={styles.title}>{cprT('cprNotificationSettings', language)}</Text>
          <Text style={styles.subtitle}>{cprT('cprNotificationSettingsSubtitle', language)}</Text>

          {saving && (
            <View style={styles.savingBadge}>
              <ActivityIndicator color={C.primary} size="small" />
              <Text style={styles.savingText}>{t('opFleet2Saving', language)}</Text>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={C.primary} size="large" />
            </View>
          ) : (
            SECTIONS.map(section => (
              <View key={section.titleKey} style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {cprT(section.titleKey, language)}
                </Text>

                {section.items.map((item, idx) => (
                  <React.Fragment key={item.key}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.switchRow}>
                      <View style={styles.switchContent}>
                        <Text style={styles.switchTitle}>
                          {cprT(item.labelKey, language)}
                        </Text>
                        <Text style={styles.switchDesc}>
                          {cprT(item.descKey, language)}
                        </Text>
                      </View>
                      <Switch
                        value={prefs[item.key]}
                        onValueChange={(value) => void updatePref(item.key, value)}
                        trackColor={{ false: C.border, true: C.primary }}
                        thumbColor={C.white}
                        accessibilityLabel={cprT(item.labelKey, language)}
                      />
                    </View>
                  </React.Fragment>
                ))}
              </View>
            ))
          )}

          <Text style={styles.footer}>{cprT('cprNotificationFooter', language)}</Text>
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
  backText: { fontSize: 16, color: C.primary, fontWeight: '600' },
  content: { padding: Spacing.base },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: C.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
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
  loadingContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
  },
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
    minHeight: 44,
    paddingVertical: Spacing.xs,
  },
  switchContent: { flex: 1, marginRight: Spacing.md },
  switchTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  switchDesc: { fontSize: 12, color: C.textTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: Spacing.sm },
  footer: {
    fontSize: 12,
    color: C.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  })
}
