import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useColors } from '@/lib/hooks/useColors'

const TERMS_URL = 'https://rentivo.domrol.com/legal/terms'
const PRIVACY_URL = 'https://rentivo.domrol.com/legal/privacy'
const TERMS_VERSION = '1.0'
const PRIVACY_VERSION = '1.0'

export default function ConsentScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language } = useAuthStore()
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [marketingEmail, setMarketingEmail] = useState(false)
  const [marketingPush, setMarketingPush] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [loading, setLoading] = useState(false)

  const canContinue = termsAccepted && privacyAccepted

  const handleConfirm = async () => {
    if (!canContinue) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        Alert.alert('Error', 'No active session. Please log in again.')
        setLoading(false)
        return
      }

      const now = new Date().toISOString()
      const { error } = await supabase.from('rentivo_consent').upsert({
        user_id: session.user.id,
        terms_accepted: true,
        terms_accepted_at: now,
        terms_version: TERMS_VERSION,
        privacy_accepted: true,
        privacy_accepted_at: now,
        privacy_version: PRIVACY_VERSION,
        marketing_email: marketingEmail,
        marketing_email_at: marketingEmail ? now : null,
        marketing_push: marketingPush,
        marketing_push_at: marketingPush ? now : null,
        analytics,
        analytics_at: analytics ? now : null,
        platform: 'mobile',
      }, { onConflict: 'user_id' })

      if (error) throw error

      // Push consent declined → null the push token (auth_id is the FK on rentivo_users)
      if (!marketingPush) {
        await supabase.from('rentivo_users').update({ push_token: null }).eq('auth_id', session.user.id)
      }

      // Route to onboarding — avoids infinite loop with root layout consent check
      router.replace('/onboarding')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  const isHu = language === 'hu'

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          {isHu ? 'Adatvédelmi hozzájárulás' : 'Privacy & Consent'}
        </Text>
        <Text style={styles.subtitle}>
          {isHu
            ? 'A folytatáshoz kérjük fogadd el az alábbi feltételeket.'
            : 'To continue, please accept the required terms below.'}
        </Text>

        {/* Required section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {isHu ? 'KÖTELEZŐ' : 'REQUIRED'}
          </Text>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}
              onPress={() => setTermsAccepted(v => !v)}
              accessibilityLabel={isHu ? 'Általános Szerződési Feltételek elfogadása' : 'Accept Terms of Service'}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
            >
              {termsAccepted && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
            <View style={styles.rowContent}>
              <Text style={styles.rowText}>
                {isHu ? 'Elfogadom az ' : 'I accept the '}
                <Text
                  style={styles.link}
                  onPress={() => Linking.openURL(TERMS_URL)}
                  accessibilityLabel={isHu ? 'Általános Szerződési Feltételek megnyitása' : 'Open Terms of Service'}
                  accessibilityRole="link"
                >
                  {isHu ? 'Általános Szerződési Feltételeket' : 'Terms of Service'}
                </Text>
              </Text>
              <Text style={styles.rowMeta}>
                {isHu ? 'Kötelező a szolgáltatás használatához' : 'Required to use the service'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.checkbox, privacyAccepted && styles.checkboxChecked]}
              onPress={() => setPrivacyAccepted(v => !v)}
              accessibilityLabel={isHu ? 'Adatvédelmi Szabályzat elfogadása' : 'Accept Privacy Policy'}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: privacyAccepted }}
            >
              {privacyAccepted && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
            <View style={styles.rowContent}>
              <Text style={styles.rowText}>
                {isHu ? 'Elfogadom az ' : 'I accept the '}
                <Text
                  style={styles.link}
                  onPress={() => Linking.openURL(PRIVACY_URL)}
                  accessibilityLabel={isHu ? 'Adatvédelmi Szabályzat megnyitása' : 'Open Privacy Policy'}
                  accessibilityRole="link"
                >
                  {isHu ? 'Adatvédelmi Szabályzatot' : 'Privacy Policy'}
                </Text>
              </Text>
              <Text style={styles.rowMeta}>
                {isHu ? 'Kötelező — GDPR 7. cikk' : 'Required — GDPR Article 7'}
              </Text>
            </View>
          </View>
        </View>

        {/* Optional section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {isHu ? 'OPCIONÁLIS' : 'OPTIONAL'}
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
              onValueChange={setMarketingEmail}
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
              onValueChange={setMarketingPush}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor={C.white}
              accessibilityLabel={isHu ? 'Push értesítések kapcsoló' : 'Push notifications toggle'}
            />
          </View>

          <View style={styles.divider} />

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
              onValueChange={setAnalytics}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor={C.white}
              accessibilityLabel={isHu ? 'Analitika kapcsoló' : 'Analytics toggle'}
            />
          </View>
        </View>

        <Button
          title={isHu ? 'Elfogadom és folytatom' : 'Accept & Continue'}
          onPress={handleConfirm}
          loading={loading}
          disabled={!canContinue}
          fullWidth
          style={styles.confirmBtn}
        />

        <Text style={styles.gdprNote}>
          {isHu
            ? 'Hozzájárulásodat bármikor visszavonhatod a Profil → Adatvédelmi beállítások menüben.'
            : 'You can withdraw your consent at any time in Profile → Privacy settings.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  title: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: Spacing.sm },
  subtitle: { fontSize: 15, color: C.textSecondary, marginBottom: Spacing.xl, lineHeight: 22 },
  section: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textTertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm },
  rowContent: { flex: 1 },
  rowText: { fontSize: 14, color: C.text, lineHeight: 20 },
  rowMeta: { fontSize: 12, color: C.textTertiary, marginTop: 2 },
  link: { color: C.primary, fontWeight: '600' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: C.primary, borderColor: C.primary },
  checkMark: { fontSize: 14, fontWeight: '800', color: C.textInverse },
  divider: { height: 1, backgroundColor: C.border, marginVertical: Spacing.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  switchContent: { flex: 1, marginRight: Spacing.md },
  switchTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  switchMeta: { fontSize: 12, color: C.textTertiary, marginTop: 2 },
  confirmBtn: { marginTop: Spacing.lg },
  gdprNote: {
    fontSize: 12,
    color: C.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.base,
    lineHeight: 18,
  },
  })
}
