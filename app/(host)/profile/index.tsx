import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { Href } from 'expo-router'
import { Spacing, Radius } from '@/constants/colors'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { MOCK_HOST } from '@/lib/mockData'
import { Config } from '@/constants/config'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { t } from '@/constants/i18n'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/hooks/useColors'

export default function HostProfileScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { host, signOut, setRole, language, setLanguage } = useAuthStore()
  const hostData = Config.useMock ? MOCK_HOST : host

  const name = hostData?.name ?? 'Host'
  const city = hostData?.city ?? ''
  const rating = hostData?.rating ?? 0
  const reviewCount = hostData?.review_count ?? 0
  const totalRentals = hostData?.total_rentals ?? 0
  const responseRate = hostData?.response_rate ?? 100
  const memberSince = hostData?.member_since
    ? new Date(hostData.member_since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : '—'

  const [totalEarned, setTotalEarned] = useState(Config.useMock ? 63000 : 0)

  useEffect(() => {
    if (Config.useMock || !host?.id) return
    supabase
      .from('rentivo_bookings')
      .select('total_amount')
      .eq('host_id', host.id)
      .in('status', ['completed', 'active'])
      .eq('payment_status', 'paid')
      .then(({ data }) => {
        const sum = (data ?? []).reduce((acc, b) => acc + ((b.total_amount as number) ?? 0), 0)
        setTotalEarned(Math.round(sum))
      })
  }, [host?.id])

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
        <Text style={styles.title}>Profile</Text>

        {/* Profile section */}
        <View style={styles.profileSection}>
          <Avatar name={name} size={80} />
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.location}>📍 {city}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingText}>★ {rating.toFixed(1)}</Text>
            <Text style={styles.ratingDot}>·</Text>
            <Text style={styles.reviewCount}>{reviewCount} reviews</Text>
          </View>
          <Text style={styles.memberSince}>Member since {memberSince}</Text>
          {hostData?.verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ {t('verifiedHost', language)}</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{totalRentals}</Text>
            <Text style={styles.statLabel}>{t('statRentals', language)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{formatEURDecimal(totalEarned)}</Text>
            <Text style={styles.statLabel}>{t('statEarned', language)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{responseRate}%</Text>
            <Text style={styles.statLabel}>{t('statResponse', language)}</Text>
          </View>
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('listings', language)}</Text>
          <MenuItem label={`🚗 ${t('myVehicles', language)}`} onPress={() => router.push('/(host)/listings')} />
          <Divider />
          <MenuItem label={`➕ ${t('listSomethingNew', language)}`} onPress={() => router.push('/(host)/listings/new')} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('sectionAccount', language)}</Text>
          <MenuItem label={`🔗 ${t('connectedPlatforms', language)}`} onPress={() => router.push('/(consumer)/profile/connected-platforms' as Parameters<typeof router.push>[0])} />
          <Divider />
          <MenuItem label="🪪 Identity verification" onPress={() => router.push('/(consumer)/profile/verify' as Parameters<typeof router.push>[0])} />
          <Divider />
          <MenuItem
            label={`💳 ${t('payoutSettings', language)}`}
            onPress={() => Alert.alert('Payout Setup', 'Configure your bank account for payouts at dashboard.rentivo.app → Payouts', [{ text: 'OK' }])}
          />
          <Divider />
          <MenuItem label="🔔 Notification preferences" onPress={() => router.push('/(consumer)/profile/privacy-settings' as Parameters<typeof router.push>[0])} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('sectionSwitchRole', language)}</Text>
          <TouchableOpacity
            style={styles.switchRoleBtn}
            onPress={() => { setRole('consumer'); router.replace('/(consumer)/explore') }}
            accessibilityLabel="Switch to consumer view"
            accessibilityRole="button"
          >
            <Text style={styles.switchRoleIcon}>🔍</Text>
            <Text style={styles.switchRoleText}>{t('roleConsumer', language)}</Text>
            <Text style={styles.switchRoleChevron}>›</Text>
          </TouchableOpacity>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('sectionLanguage', language)}</Text>
          <View style={styles.langRow}>
            {(['en', 'es', 'hu'] as const).map(lang => (
              <TouchableOpacity
                key={lang}
                style={[styles.langBtn, language === lang && styles.langBtnActive]}
                onPress={() => setLanguage(lang)}
              >
                <Text style={[styles.langText, language === lang && styles.langTextActive]}>
                  {lang === 'en' ? '🇬🇧 EN' : lang === 'es' ? '🇪🇸 ES' : '🇭🇺 HU'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('sectionLegal', language)}</Text>
          <MenuItem label={`📄 ${t('termsOfService', language)}`} onPress={() => void Linking.openURL('https://rentivo.domrol.com/legal/terms')} />
          <Divider />
          <MenuItem label={`🔒 ${t('privacyPolicy', language)}`} onPress={() => void Linking.openURL('https://rentivo.domrol.com/legal/privacy')} />
          <Divider />
          <MenuItem label={`❓ ${t('helpSupport', language)}`} onPress={() => void Linking.openURL('mailto:support@rentivo.app')} />
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
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  profileSection: { alignItems: 'center', paddingBottom: Spacing.xl },
  name: { fontSize: 22, fontWeight: '700', color: C.text, marginTop: Spacing.md },
  location: { fontSize: 14, color: C.textSecondary, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  ratingText: { fontSize: 15, fontWeight: '700', color: C.primary },
  ratingDot: { fontSize: 15, color: C.textTertiary },
  reviewCount: { fontSize: 14, color: C.textSecondary },
  memberSince: { fontSize: 13, color: C.textTertiary, marginTop: 4 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: C.successSurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: C.success,
  },
  verifiedText: { fontSize: 13, fontWeight: '700', color: C.success },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 2 },
  statLabel: { fontSize: 11, color: C.textTertiary, fontWeight: '600', textTransform: 'uppercase' },
  statDivider: { width: 1, height: 32, backgroundColor: C.border },

  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, minHeight: 44 },
  menuLabel: { fontSize: 15, color: C.text },
  menuChevron: { fontSize: 20, color: C.textTertiary },

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
  switchRoleIcon: { fontSize: 18 },
  switchRoleText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '600' },
  switchRoleChevron: { fontSize: 20, color: C.textTertiary },

  langRow: { flexDirection: 'row', gap: Spacing.sm },
  langBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  langBtnActive: { backgroundColor: C.primarySurface, borderColor: C.primary },
  langText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  langTextActive: { color: C.primary },

  signOutBtn: { marginHorizontal: Spacing.base, marginTop: Spacing.base, padding: Spacing.base, alignItems: 'center', minHeight: 44 },
  signOutText: { fontSize: 16, color: C.error, fontWeight: '600' },
  appVersion: { textAlign: 'center', fontSize: 12, color: C.textTertiary, marginTop: Spacing.base, marginBottom: Spacing.md },
  })
}
