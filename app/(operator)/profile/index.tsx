import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { Href } from 'expo-router'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import { useColors } from '@/lib/hooks/useColors'

export default function OperatorProfileScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { operator, setRole, signOut, language, setLanguage } = useAuthStore()
  const op = Config.useMock ? MOCK_OPERATOR : operator

  const handleSignOut = () => {
    Alert.alert(t('signOut', language), 'Are you sure?', [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: t('signOut', language),
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/auth' as Href)
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('profileTitle', language)}</Text>

        <View style={styles.profileSection}>
          <Avatar name={op?.name || 'Operator'} imageUrl={op?.logo_url} size={72} />
          <Text style={styles.name}>{op?.name || t('roleOperator', language)}</Text>
          {/* Only render the location line when there is real data — otherwise
              it paints a stray ", " under the avatar */}
          {op?.city ? (
            <Text style={styles.city}>{op.city}{op.country ? `, ${op.country}` : ''}</Text>
          ) : null}
          {op?.verified && <Text style={styles.verified}>✓ Verified operator</Text>}
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('sectionLanguage', language)}</Text>
          <View style={styles.langRow}>
            {(['en', 'es', 'hu'] as const).map(lang => (
              <TouchableOpacity
                key={lang}
                style={[styles.langBtn, language === lang && styles.langBtnActive]}
                onPress={() => setLanguage(lang)}
                accessibilityLabel={lang === 'en' ? 'English' : lang === 'es' ? 'Español' : 'Magyar'}
                accessibilityRole="button"
              >
                <Text style={[styles.langText, language === lang && styles.langTextActive]}>
                  {lang === 'en' ? 'EN' : lang === 'es' ? 'ES' : 'HU'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('sectionSwitchRole', language)}</Text>
          <TouchableOpacity
            style={styles.switchRoleBtn}
            onPress={() => { setRole('consumer'); router.replace('/(consumer)/explore') }}
            accessibilityLabel="Switch to consumer view"
            accessibilityRole="button"
          >
            <Ionicons name="search-outline" size={18} color={C.textSecondary} importantForAccessibility="no" />
            <Text style={styles.switchRoleText}>{t('roleConsumer', language)}</Text>
            <Text style={styles.switchRoleChevron}>›</Text>
          </TouchableOpacity>
        </Card>

        <Card style={styles.card}>
          <MenuItem
            label="Analytics"
            onPress={() => router.push('/(operator)/analytics' as Parameters<typeof router.push>[0])}
          />
          <Divider />
          <MenuItem label={`${t('connectedPlatforms', language)}`} onPress={() => router.push('/(consumer)/profile/connected-platforms' as Parameters<typeof router.push>[0])} />
          <Divider />
          <MenuItem label="Delivery Settings" onPress={() => router.push('/(operator)/settings/delivery' as Parameters<typeof router.push>[0])} />
          <Divider />
          <MenuItem label="API & Webhooks" onPress={() => router.push('/(operator)/settings/api' as Parameters<typeof router.push>[0])} />
          <Divider />
          <MenuItem label={t('businessSettings', language)} onPress={() => void Linking.openURL('https://dashboard.rentivo.app')} />
          <Divider />
          <MenuItem label={t('payoutSettings', language)} onPress={() => void Linking.openURL('https://dashboard.rentivo.app/payouts')} />
          <Divider />
          <MenuItem label={t('helpSupport', language)} onPress={() => void Linking.openURL('mailto:support@rentivo.app')} />
        </Card>

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          accessibilityLabel={t('signOut', language)}
          accessibilityRole="button"
        >
          <Text style={styles.signOutText}>{t('signOut', language)}</Text>
        </TouchableOpacity>

        <Text style={styles.appVersion}>Rentivo v1.0.0</Text>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuChevron}>›</Text>
    </TouchableOpacity>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  title: { fontFamily: 'Manrope_800ExtraBold', fontSize: 26, letterSpacing: -0.6, color: C.text, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, marginBottom: Spacing.lg },
  profileSection: { alignItems: 'center', marginBottom: Spacing.xl },
  name: { fontSize: 20, fontFamily: Fonts.bold, color: C.text, marginTop: Spacing.md },
  city: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, marginTop: 4 },
  verified: { fontSize: 13, color: C.success, fontFamily: Fonts.semibold, marginTop: 4 },
  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 12, fontFamily: Fonts.bold, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  langRow: { flexDirection: 'row', gap: Spacing.sm },
  langBtn: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  langBtnActive: { backgroundColor: C.text, borderColor: C.text },
  langText: { fontSize: 13, color: C.textSecondary, fontFamily: Fonts.semibold },
  langTextActive: { color: C.background },
  switchRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    minHeight: 44,
  },
  switchRoleText: { flex: 1, fontSize: 15, color: C.text, fontFamily: Fonts.semibold },
  switchRoleChevron: { fontFamily: Fonts.regular, fontSize: 20, color: C.textTertiary },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  menuLabel: { fontFamily: Fonts.regular, fontSize: 15, color: C.text },
  menuChevron: { fontFamily: Fonts.regular, fontSize: 20, color: C.textTertiary },
  signOutBtn: { marginHorizontal: Spacing.base, marginTop: Spacing.base, padding: Spacing.base, alignItems: 'center', minHeight: 44 },
  signOutText: { fontSize: 16, color: C.error, fontFamily: Fonts.semibold },
  appVersion: { textAlign: 'center', fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, marginTop: Spacing.base, marginBottom: Spacing.md },
  })
}
