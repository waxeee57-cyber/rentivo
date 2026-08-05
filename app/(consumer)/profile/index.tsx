import React, { useEffect, useRef, useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Linking, Animated, Share, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { Href } from 'expo-router'
import { Spacing, Radius, Shadow, Fonts } from '@/constants/colors'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useBookings } from '@/lib/hooks/useBookings'
import { useToastStore } from '@/lib/store/useToastStore'
import { Config } from '@/constants/config'
import { t } from '@/constants/i18n'
import { useLoyalty } from '@/lib/hooks/useLoyalty'
import { getTierColor } from '@/lib/loyalty'
import { supabase } from '@/lib/supabase'
import { useThemeStore } from '@/lib/store/useThemeStore'
import { useColors } from '@/lib/hooks/useColors'

// Loyalty perk labels come from lib/loyalty.ts as canonical EN strings —
// translate them at render time so the perks list follows the app language.
const PERK_LABELS: Record<string, { en: string; es: string; hu: string }> = {
  '2.5% fee discount':  { en: '2.5% fee discount',  es: '2,5% de descuento en tarifas', hu: '2,5% díjkedvezmény' },
  '5% fee discount':    { en: '5% fee discount',    es: '5% de descuento en tarifas',   hu: '5% díjkedvezmény' },
  '7.5% fee discount':  { en: '7.5% fee discount',  es: '7,5% de descuento en tarifas', hu: '7,5% díjkedvezmény' },
  '10% discount':       { en: '10% discount',       es: '10% de descuento',             hu: '10% kedvezmény' },
  'Priority support':   { en: 'Priority support',   es: 'Soporte prioritario',          hu: 'Elsőbbségi ügyfélszolgálat' },
  'Free cancellation':  { en: 'Free cancellation',  es: 'Cancelación gratuita',         hu: 'Ingyenes lemondás' },
  'No deposit':         { en: 'No deposit',         es: 'Sin depósito',                 hu: 'Kaució nélkül' },
  'Dedicated support':  { en: 'Dedicated support',  es: 'Soporte dedicado',             hu: 'Dedikált ügyfélszolgálat' },
}

export default function ProfileScreen() {
  const { user, operator, signOut, language, setLanguage, hasOperatorAccount, hasHostAccount, setRole } = useAuthStore()
  const { showToast } = useToastStore()
  const { isDark, toggleTheme } = useThemeStore()
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [referralCode] = useState(
    Config.useMock ? 'ROLI2026' : `REF${(user?.id ?? 'GUEST').slice(0, 6).toUpperCase()}`,
  )

  const name = Config.useMock
    ? 'Marco Ferreira'
    : (user?.name || operator?.name || (user?.phone ? `···${user.phone.slice(-4)}` : null) || 'New User')
  const email = Config.useMock ? 'marco.ferreira@gmail.com' : (user?.email ?? operator?.email ?? '')
  const avatarUrl = Config.useMock ? null : (user?.avatar_url ?? null)

  const memberSince = Config.useMock
    ? '2024'
    : (user?.created_at
        ? new Date(user.created_at).getFullYear().toString()
        : operator?.created_at
          ? new Date(operator.created_at).getFullYear().toString()
          : null)

  const userId = Config.useMock ? 'usr-001' : (user?.id ?? null)
  const { bookings } = useBookings(userId)
  const tripCount = Config.useMock ? 4 : bookings.filter(b => b.status === 'completed').length
  const [reviewCount, setReviewCount] = useState(Config.useMock ? 2 : 0)
  const [avgRating, setAvgRating] = useState(Config.useMock ? '4.9' : '—')

  useEffect(() => {
    if (Config.useMock || !user?.id) return
    supabase
      .from('rentivo_reviews')
      .select('rating')
      .eq('reviewer_id', user.id)
      .then(({ data }) => {
        const rows = data ?? []
        setReviewCount(rows.length)
        if (rows.length > 0) {
          const avg = rows.reduce((s, r) => s + ((r.rating as number) ?? 0), 0) / rows.length
          setAvgRating(avg.toFixed(1))
        }
      })
  }, [user?.id])

  // Loyalty: sum completed booking totals (EUR) × 100 to get cents
  const totalSpentCents = Config.useMock
    ? 92300  // mock: €923 spent → 923 points → Silver tier
    : bookings
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => sum + Math.round(b.total_amount * 100), 0)

  const loyalty = useLoyalty(totalSpentCents)

  const progressAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: loyalty.progressPercent / 100,
      duration: 800,
      useNativeDriver: false,
    }).start()
  }, [loyalty.progressPercent, progressAnim])

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

  const handleHelpSupport = () => {
    Linking.openURL('mailto:support@rentivo.app').catch(() => {
      Alert.alert(
        t('helpSupport', language),
        'Email us at support@rentivo.app\n\nResponse time: within 24 hours',
        [{ text: 'OK' }],
      )
    })
  }

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://rentivo.domrol.com/legal/privacy').catch(() => {
      router.push('/(consumer)/legal/privacy' as Href)
    })
  }

  const handleTermsOfService = () => {
    Linking.openURL('https://rentivo.domrol.com/legal/terms').catch(() => {
      router.push('/(consumer)/legal/terms' as Href)
    })
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: C.text }]}>{t('profileTitle', language)}</Text>

        <View style={styles.profileSection}>
          <Avatar name={name} imageUrl={avatarUrl} size={72} />
          <Text style={[styles.name, { color: C.text }]}>{name}</Text>
          <Text style={[styles.email, { color: C.textSecondary }]}>{email}</Text>
          {memberSince ? (
            <Text style={[styles.memberSince, { color: C.textTertiary }]}>
              {t('memberSinceLabel', language)} {memberSince}
            </Text>
          ) : null}

          {/* Stats row */}
          <View style={[styles.statsRow, { backgroundColor: C.surface }]}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push('/(consumer)/bookings' as Href)}
              accessibilityLabel={`${tripCount} ${t('trips', language)}`}
              accessibilityRole="button"
            >
              <Text style={[styles.statNum, { color: C.text }]}>{tripCount}</Text>
              <Text style={styles.statLabel}>{t('trips', language)}</Text>
            </TouchableOpacity>
            <View style={[styles.statDivider, { backgroundColor: C.border }]} />
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => showToast({ message: 'Your reviews coming soon', type: 'info' })}
              accessibilityLabel={`${reviewCount} ${t('reviews', language)}`}
              accessibilityRole="button"
            >
              <Text style={[styles.statNum, { color: C.text }]}>{reviewCount}</Text>
              <Text style={styles.statLabel}>{t('reviews', language)}</Text>
            </TouchableOpacity>
            <View style={[styles.statDivider, { backgroundColor: C.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: C.text }]}>★{avgRating}</Text>
              <Text style={styles.statLabel}>{t('rating', language)}</Text>
            </View>
          </View>

          {/* Verification banner */}
          <TouchableOpacity
            style={styles.verifyBanner}
            onPress={() => router.push('/(consumer)/profile/identity-verification' as Href)}
            accessibilityLabel={t('verifyIdentityBanner', language)}
            accessibilityRole="button"
          >
            <Text style={styles.verifyBannerText}>{t('verifyIdentityBanner', language)}</Text>
            <Text style={styles.verifyBannerArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Loyalty Card */}
        <Card style={styles.card}>
          <View style={styles.loyaltyHeader}>
            <Text style={[styles.sectionTitle, { color: C.textTertiary }]}>{t('loyaltyTitle', language)}</Text>
            {/* A loyalty tier is passive status, not a CTA — house neutral
                Badge (muted ink on surfaceWarm) instead of a tier-tinted pill. */}
            <Badge label={loyalty.tierInfo.label.toUpperCase()} variant="neutral" />
          </View>

          <Text
            style={[styles.loyaltyPoints, { color: C.text }]}
            accessibilityLabel={`${loyalty.points} ${t('loyaltyPoints', language)}`}
          >
            {loyalty.points.toLocaleString()}{' '}
            <Text style={styles.loyaltyPointsLabel}>{t('loyaltyPoints', language)}</Text>
          </Text>

          {/* Progress bar */}
          <View
            style={styles.progressTrack}
            accessibilityLabel={t('loyaltyProgressLabel', language)}
            accessibilityRole="progressbar"
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  // Theme-resolved tier accent — reading tierInfo.color raw
                  // always yields the DARK palette value (washed out on white).
                  backgroundColor: getTierColor(loyalty.tierInfo, C),
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          {loyalty.nextTierInfo ? (
            <Text style={styles.loyaltyNextText}>
              {/* Ink, not the tier metal: these are body copy, and the metal
                  hexes (Silver #C0C0C0, Platinum #E5E4E2) are ~1.2–1.4:1 on the
                  light surface. Emphasis comes from the bold face. */}
              <Text style={{ color: C.text, fontFamily: Fonts.bold }}>
                {loyalty.pointsToNextTier}
              </Text>
              {' '}{t('loyaltyNextTier', language)}{' '}
              <Text style={{ color: C.text, fontFamily: Fonts.bold }}>
                {loyalty.nextTierInfo.label}
              </Text>
            </Text>
          ) : (
            <Text style={styles.loyaltyNextText}>{t('loyaltyMaxTier', language)}</Text>
          )}

          {/* Perks list */}
          <Text style={[styles.sectionTitle, { color: C.textTertiary, marginTop: Spacing.md, marginBottom: Spacing.sm }]}>
            {t('loyaltyPerks', language)}
          </Text>
          {loyalty.tierInfo.perks.map((perk) => (
            <View key={perk} style={styles.perkRow}>
              {/* Decorative bullet → muted ink, not the tier accent. */}
              <Text style={[styles.perkDot, { color: C.textTertiary }]}>●</Text>
              <Text style={styles.perkText}>{PERK_LABELS[perk]?.[language] ?? perk}</Text>
            </View>
          ))}
        </Card>

        {/* Quick access */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: C.textTertiary }]}>
            {t('ternQuickAccess', language)}
          </Text>
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => router.push('/(consumer)/bookings' as Href)}
              accessibilityLabel={t('ternMyRentals', language)}
              accessibilityRole="button"
            >
              <View style={styles.quickIconCircle}>
                {/* Decorative nav icon, not a CTA → muted ink. */}
                <Ionicons name="car-sport-outline" size={20} color={C.textSecondary} />
              </View>
              <Text style={styles.quickLabel}>
                {t('ternMyRentals', language)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => router.push('/(consumer)/wishlist' as Href)}
              accessibilityLabel={t('ternSaved', language)}
              accessibilityRole="button"
            >
              <View style={styles.quickIconCircle}>
                <Ionicons name="heart-outline" size={20} color={C.textSecondary} />
              </View>
              <Text style={styles.quickLabel}>
                {t('ternSaved', language)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => router.push('/(consumer)/profile/notifications' as Href)}
              accessibilityLabel={t('ternNotifications', language)}
              accessibilityRole="button"
            >
              <View style={styles.quickIconCircle}>
                <Ionicons name="notifications-outline" size={20} color={C.textSecondary} />
              </View>
              <Text style={styles.quickLabel}>
                {t('ternNotifications', language)}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Language Card */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: C.textTertiary }]}>{t('sectionLanguage', language)}</Text>
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

        {/* Appearance Card */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: C.textTertiary }]}>
            {t('ternAppearance', language)}
          </Text>
          <View style={[styles.menuItem, { minHeight: 52 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: C.text }]}>
                {t('ternDarkMode', language)}
              </Text>
              <Text style={{ fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
                {isDark ? t('ternEnabled', language) : t('ternDisabled', language)}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor={C.white}
              accessibilityLabel="Toggle dark mode"
              accessibilityRole="switch"
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: C.textTertiary }]}>{t('sectionSwitchRole', language)}</Text>
          <View style={styles.switchRoleColumn}>
            {(Config.useMock || hasOperatorAccount) && (
              <TouchableOpacity
                style={styles.switchRoleBtn}
                onPress={() => { setRole('operator'); router.replace('/(operator)/dashboard') }}
                accessibilityLabel="Switch to Operator Dashboard"
                accessibilityRole="button"
              >
                <Ionicons name="business-outline" size={18} color={C.textSecondary} importantForAccessibility="no" />
                <Text style={[styles.switchRoleText, { color: C.text }]}>{t('roleOperator', language)}</Text>
                <Text style={[styles.switchRoleChevron, { color: C.textTertiary }]}>›</Text>
              </TouchableOpacity>
            )}
            {(Config.useMock || hasHostAccount) && (
              <TouchableOpacity
                style={styles.switchRoleBtn}
                onPress={() => { setRole('host'); router.replace('/(host)/dashboard') }}
                accessibilityLabel="Switch to Host Dashboard"
                accessibilityRole="button"
              >
                <Ionicons name="home-outline" size={18} color={C.textSecondary} importantForAccessibility="no" />
                <Text style={[styles.switchRoleText, { color: C.text }]}>{t('roleHost', language)}</Text>
                <Text style={[styles.switchRoleChevron, { color: C.textTertiary }]}>›</Text>
              </TouchableOpacity>
            )}
            {!Config.useMock && !hasOperatorAccount && (
              <TouchableOpacity
                style={[styles.switchRoleBtn, styles.switchRoleBtnAccent]}
                onPress={() => router.push('/auth/operator-setup' as Href)}
                accessibilityLabel="Become an Operator"
                accessibilityRole="button"
              >
                <Text style={styles.switchRoleIcon}>+</Text>
                <Text style={[styles.switchRoleText, styles.switchRoleTextAccent]}>
                  {t('ternBecomeOperator', language)}
                </Text>
                <Text style={[styles.switchRoleChevron, { color: C.textTertiary }]}>›</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Refer a Friend */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: C.textTertiary }]}>
            {t('ternReferFriend', language)}
          </Text>
          <View style={styles.referralCard}>
            <Text style={styles.referralDesc}>
              {t('ternReferralDesc', language)}
            </Text>
            <View style={styles.referralCodeRow}>
              <Text style={styles.referralCode}>{referralCode}</Text>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() => void Share.share({
                  message: language === 'hu'
                    ? `Használd az én Rentivo ajánlói kódomat: ${referralCode} — és kapsz 10% kedvezményt az első bérlésedre!`
                    : language === 'es'
                      ? `Usa mi código de referido de Rentivo ${referralCode} y obtén 10% de descuento en tu primer alquiler!`
                      : `Use my Rentivo referral code ${referralCode} and get 10% off your first rental!`,
                })}
                accessibilityLabel="Share referral code"
                accessibilityRole="button"
              >
                <Text style={styles.shareBtnText}>
                  {t('ternShare', language)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: C.textTertiary }]}>{t('sectionAccount', language)}</Text>
          <MenuItem
            label={`${t('identityVerification', language)}`}
            onPress={() => router.push('/(consumer)/profile/identity-verification' as Href)}
            textColor={C.text}
            chevronColor={C.textTertiary}
          />
          <Divider />
          <MenuItem
            label={`${t('payoutSettings', language)}`}
            onPress={() => {
              Alert.alert(
                t('payoutSettings', language),
                t('ternPayoutSettingsInfo', language),
                [{ text: 'OK' }],
              )
            }}
            textColor={C.text}
            chevronColor={C.textTertiary}
          />
          <Divider />
          <MenuItem
            label={`${t('cprNotificationSettings', language)}`}
            onPress={() => router.push('/(consumer)/profile/notifications' as Href)}
            textColor={C.text}
            chevronColor={C.textTertiary}
          />
          <Divider />
          <MenuItem
            label={`${t('cprPrivacySettings', language)}`}
            onPress={() => router.push('/(consumer)/profile/privacy-settings' as Href)}
            textColor={C.text}
            chevronColor={C.textTertiary}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: C.textTertiary }]}>{t('sectionLegal', language)}</Text>
          <MenuItem label={`${t('termsOfService', language)}`} onPress={handleTermsOfService} textColor={C.text} chevronColor={C.textTertiary} />
          <Divider />
          <MenuItem label={`${t('privacyPolicy', language)}`} onPress={handlePrivacyPolicy} textColor={C.text} chevronColor={C.textTertiary} />
          <Divider />
          <MenuItem label={`${t('cookiePolicy', language)}`} onPress={() => router.push('/(consumer)/legal/cookies' as Href)} textColor={C.text} chevronColor={C.textTertiary} />
          <Divider />
          <MenuItem label={`${t('cprPrivacySettings', language)}`} onPress={() => router.push('/(consumer)/profile/privacy-settings' as Href)} textColor={C.text} chevronColor={C.textTertiary} />
          <Divider />
          <MenuItem label={`${t('helpSupport', language)}`} onPress={handleHelpSupport} textColor={C.text} chevronColor={C.textTertiary} />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: C.textTertiary }]}>{t('ternAccountDeletion', language)}</Text>
          <MenuItem
            label={`${t('cprDeleteAccount', language)}`}
            onPress={() => router.push('/(consumer)/profile/delete-account' as Href)}
            danger
            textColor={C.text}
            chevronColor={C.textTertiary}
          />
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

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function MenuItem({
  label,
  onPress,
  danger,
  textColor,
  chevronColor,
}: {
  label: string
  onPress: () => void
  danger?: boolean
  textColor?: string
  chevronColor?: string
}) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Text style={[styles.menuLabel, { color: textColor ?? C.text }, danger && styles.menuLabelDanger]}>{label}</Text>
      <Text style={[styles.menuChevron, { color: chevronColor ?? C.textTertiary }]}>›</Text>
    </TouchableOpacity>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  title: { fontFamily: 'Manrope_800ExtraBold', fontSize: 26, letterSpacing: -0.6, color: C.text, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, marginBottom: Spacing.lg },
  profileSection: { alignItems: 'center', marginBottom: Spacing.xl },
  name: { fontSize: 20, fontFamily: Fonts.bold, color: C.text, marginTop: Spacing.md },
  email: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, marginTop: 4 },
  memberSince: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, marginTop: 4 },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    backgroundColor: C.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
    ...Shadow.sm,
  },
  verifyBannerText: { fontSize: 12, color: C.text, fontFamily: Fonts.semibold },
  verifyBannerArrow: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary },
  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 12, fontFamily: Fonts.bold, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  quickRow: { flexDirection: 'row', gap: Spacing.sm },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
  },
  quickIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // Neutral chip, not the CTA tint — these are shortcuts, not the CTA.
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickIcon: { fontFamily: Fonts.regular, fontSize: 22, marginBottom: 4 },
  quickLabel: { fontSize: 11, color: C.textSecondary, fontFamily: Fonts.semibold, textAlign: 'center' },
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
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, minHeight: 44 },
  menuLabel: { fontFamily: Fonts.regular, fontSize: 15, color: C.text },
  menuLabelDanger: { color: C.error },
  menuChevron: { fontFamily: Fonts.regular, fontSize: 20, color: C.textTertiary },
  signOutBtn: { marginHorizontal: Spacing.base, marginTop: Spacing.base, padding: Spacing.base, alignItems: 'center', minHeight: 44 },
  signOutText: { fontSize: 16, color: C.error, fontFamily: Fonts.semibold },
  appVersion: { textAlign: 'center', fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, marginTop: Spacing.base, marginBottom: Spacing.md },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontFamily: Fonts.extrabold, color: C.text, marginBottom: 2 },
  statLabel: { fontSize: 11, color: C.textTertiary, fontFamily: Fonts.semibold, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 32, backgroundColor: C.border },
  switchRoleColumn: { gap: Spacing.sm },
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
  // Explicit color: the "+" variant is a plain text glyph (not an emoji), so
  // without a color it falls back to default black — invisible in dark mode.
  switchRoleIcon: { fontFamily: Fonts.regular, fontSize: 18, color: C.primary },
  switchRoleText: { flex: 1, fontSize: 15, color: C.text, fontFamily: Fonts.semibold },
  switchRoleTextAccent: { color: C.primary },
  switchRoleBtnAccent: { borderColor: C.primary, borderStyle: 'dashed' },
  switchRoleChevron: { fontFamily: Fonts.regular, fontSize: 20, color: C.textTertiary },
  // Referral
  referralCard: {
    backgroundColor: C.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  referralDesc: { color: C.textSecondary, fontFamily: Fonts.regular, fontSize: 13, marginBottom: Spacing.md, lineHeight: 20 },
  referralCodeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  referralCode: { color: C.primary, fontSize: 20, fontFamily: Fonts.extrabold, letterSpacing: 2, flex: 1 },
  shareBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: { color: C.background, fontFamily: Fonts.bold, fontSize: 14 },
  // Loyalty
  loyaltyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  loyaltyPoints: { fontSize: 28, fontFamily: Fonts.extrabold, marginBottom: Spacing.sm },
  loyaltyPointsLabel: { fontSize: 14, fontFamily: Fonts.regular, color: C.textSecondary },
  progressTrack: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: C.border,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: { height: '100%', borderRadius: Radius.pill },
  loyaltyNextText: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, marginBottom: Spacing.xs },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  perkDot: { fontFamily: Fonts.regular, fontSize: 8 },
  perkText: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, flex: 1 },
  })
}
