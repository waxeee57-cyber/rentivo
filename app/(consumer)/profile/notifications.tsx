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
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { captureException } from '@/lib/sentry'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'

// Wrapper to allow pending cpr keys before i18n.ts is updated
const cprT = (key: string, lang: 'en' | 'es' | 'hu'): string =>
  t(key as unknown as TranslationKey, lang)

/**
 * This screen used to read and upsert `rentivo_notification_prefs`. That table
 * does not exist — to_regclass('public.rentivo_notification_prefs') is NULL — so
 * the select returned nothing and the discarded upsert error left the switch
 * sitting where the user put it, only to revert the next time the screen opened.
 *
 * Marketing preferences DO have a home: rentivo_consent.marketing_push and
 * .marketing_email, the same two columns app/(consumer)/profile/privacy-settings.tsx
 * reads and writes. Those are wired up for real below.
 *
 * The other six rows (booking confirmed / cancelled / reminder, new message, new
 * review, payment received) have been REMOVED rather than given columns of their
 * own. They were briefly rendered as non-interactive "Always on" badges, which
 * was honest but still put six non-controls on a screen whose entire job is
 * controls. Making them real was the tempting alternative and is the wrong call,
 * on evidence:
 *
 *   - No sender would honour them. The ONLY consent-aware sender in the repo is
 *     supabase/functions/broadcast-push, which inner-joins rentivo_consent and
 *     filters `marketing_push = true` — and it sends marketing broadcasts only.
 *     No transactional push or email path reads rentivo_consent at all.
 *   - So adding `ntf_booking_confirmed` &c. would produce a switch that stores a
 *     value nothing ever reads: the user flips it off, the write succeeds, and
 *     the notification arrives anyway. That is precisely the defect this screen
 *     was just fixed for (the rentivo_notification_prefs upsert against a table
 *     that does not exist), rebuilt on a table that does.
 *   - Consent law points the same way: booking and payment notices are performance
 *     of the rental contract, not marketing, so there is no opt-out to offer.
 *
 * If these should ever become real preferences, the sender has to learn to read
 * them FIRST; the column and the switch come after. The SQL is in the report.
 */
interface MarketingPrefs {
  marketing_push: boolean
  marketing_email: boolean
}

type MarketingKey = keyof MarketingPrefs

const DEFAULT_MARKETING: MarketingPrefs = {
  marketing_push: false,
  marketing_email: false,
}

const MARKETING_ITEMS: Array<{
  key: MarketingKey
  labelKey: string
  descKey: string
  a11yKey: string
}> = [
  {
    key: 'marketing_push',
    labelKey: 'cprPushNotifications',
    descKey: 'cprPushNotificationsDesc',
    a11yKey: 'cprPushNotificationsToggle',
  },
  {
    key: 'marketing_email',
    labelKey: 'cprMarketingEmails',
    descKey: 'cprMarketingEmailsDesc',
    a11yKey: 'cprMarketingEmailsToggle',
  },
]

export default function NotificationsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language } = useAuthStore()
  const insets = useSafeAreaInsets()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState<MarketingPrefs>(DEFAULT_MARKETING)

  const loadPrefs = useCallback(async () => {
    if (Config.useMock) {
      setLoading(false)
      return
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoading(false); return }

      const { data, error } = await supabase
        .from('rentivo_consent')
        .select('marketing_email, marketing_push')
        .eq('user_id', session.user.id)
        .maybeSingle()

      // A failed read is not "consent withheld". Leave the switches at their
      // defaults and record the reason, instead of the old blanket catch that
      // made querying a table which does not exist look like an empty result.
      if (error) {
        captureException(error, { scope: 'notifications.loadConsent' })
        return
      }
      if (data) {
        const row = data as { marketing_email: boolean | null; marketing_push: boolean | null }
        setPrefs({
          marketing_push: row.marketing_push ?? false,
          marketing_email: row.marketing_email ?? false,
        })
      }
    } catch (e) {
      captureException(e, { scope: 'notifications.loadConsent' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPrefs()
  }, [loadPrefs])

  const updatePref = async (key: MarketingKey, value: boolean) => {
    setPrefs(prev => ({ ...prev, [key]: value }))
    if (Config.useMock) return

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        throw new Error(cprT('cprNoActiveSession', language))
      }

      // Each consent flag is paired with a timestamp recording when it was
      // given, cleared on withdrawal — the same shape privacy-settings.tsx
      // writes, so the two screens cannot disagree about one user's consent.
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('rentivo_consent')
        .upsert(
          { user_id: session.user.id, [key]: value, [`${key}_at`]: value ? now : null },
          { onConflict: 'user_id' },
        )
      // supabase-js RESOLVES on a PostgREST failure rather than rejecting, so
      // the old try/catch could never see this. Discarding it is what let a
      // rejected write present as an applied setting.
      if (error) throw error
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      captureException(e, { scope: 'notifications.updateConsent', pref: key })
      Alert.alert(t('opFleet2Error', language), msg)
      // The switch was already flipped optimistically. Put it back: a consent
      // control showing a state the server never stored is exactly the bug.
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
            <>
              {/* Marketing consent — the only preferences with a column behind
                  them (rentivo_consent.marketing_push / .marketing_email). */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {cprT('cprSectionMarketing', language)}
                </Text>

                {MARKETING_ITEMS.map((item, idx) => (
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
                        accessibilityLabel={cprT(item.a11yKey, language)}
                      />
                    </View>
                  </React.Fragment>
                ))}
              </View>

              {/* Booking / payment / message notices used to be listed here as
                  six "Always on" rows. They are gone: see the header comment —
                  no sender reads a per-user flag for them, so neither a switch
                  nor a badge belongs on a settings screen. */}
            </>
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
  // Navigation, not a primary action → muted ink (5.67:1 light, 8.61:1 dark).
  backText: { fontSize: 16, color: C.textSecondary, fontFamily: Fonts.semibold },
  content: { padding: Spacing.base },
  title: {
    fontSize: 26,
    fontFamily: Fonts.extrabold,
    color: C.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: Fonts.regular, fontSize: 15,
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
  savingText: { fontSize: 12, color: C.primary, fontFamily: Fonts.semibold },
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
    fontFamily: Fonts.bold,
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
  switchTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: C.text },
  switchDesc: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: Spacing.sm },
  footer: {
    fontFamily: Fonts.regular, fontSize: 12,
    color: C.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  })
}
