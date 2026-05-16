import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Linking, Animated, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { Href } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useBookings } from '@/lib/hooks/useBookings'
import { useToastStore } from '@/lib/store/useToastStore'
import { Config } from '@/constants/config'
import { t } from '@/constants/i18n'
import { useLoyalty } from '@/lib/hooks/useLoyalty'
import { supabase } from '@/lib/supabase'

export default function ProfileScreen() {
  const { user, operator, signOut, language, setLanguage, hasOperatorAccount, hasHostAccount, setRole } = useAuthStore()
  const { showToast } = useToastStore()
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
          : '—')

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
          router.replace('/auth/login' as Href)
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('profileTitle', language)}</Text>

        <View style={styles.profileSection}>
          <Avatar name={name} imageUrl={avatarUrl} size={72} />
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
          <Text style={styles.memberSince}>
            {t('memberSinceLabel', language)} {memberSince}
          </Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push('/(consumer)/bookings' as Href)}
              accessibilityLabel={`${tripCount} ${t('trips', language)}`}
              accessibilityRole="button"
            >
              <Text style={styles.statNum}>{tripCount}</Text>
              <Text style={styles.statLabel}>{t('trips', language)}</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => showToast({ message: 'Your reviews coming soon', type: 'info' })}
              accessibilityLabel={`${reviewCount} ${t('reviews', language)}`}
              accessibilityRole="button"
            >
              <Text style={styles.statNum}>{reviewCount}</Text>
              <Text style={styles.statLabel}>{t('reviews', language)}</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>★{avgRating}</Text>
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
            <Text style={styles.sectionTitle}>{t('loyaltyTitle', language)}</Text>
            <View style={[styles.tierBadge, { backgroundColor: loyalty.tierInfo.color + '22', borderColor: loyalty.tierInfo.color + '66' }]}>
              <Text style={[styles.tierBadgeText, { color: loyalty.tierInfo.color }]}>
                {loyalty.tierInfo.label.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text
            style={[styles.loyaltyPoints, { color: loyalty.tierInfo.color }]}
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
                  backgroundColor: loyalty.tierInfo.color,
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
              <Text style={{ color: loyalty.nextTierInfo.color, fontWeight: '700' }}>
                {loyalty.pointsToNextTier}
              </Text>
              {' '}{t('loyaltyNextTier', language)}{' '}
              <Text style={{ color: loyalty.nextTierInfo.color, fontWeight: '700' }}>
                {loyalty.nextTierInfo.label}
              </Text>
            </Text>
          ) : (
            <Text style={styles.loyaltyNextText}>{t('loyaltyMaxTier', language)}</Text>
          )}

          {/* Perks list */}
          <Text style={[styles.sectionTitle, { marginTop: Spacing.md, marginBottom: Spacing.sm }]}>
            {t('loyaltyPerks', language)}
          </Text>
          {loyalty.tierInfo.perks.map((perk) => (
            <View key={perk} style={styles.perkRow}>
              <Text style={[styles.perkDot, { color: loyalty.tierInfo.color }]}>●</Text>
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </Card>

        {/* Quick access */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>
            {language === 'hu' ? 'GYORS ELÉRÉS' : language === 'es' ? 'ACCESO RÁPIDO' : 'QUICK ACCESS'}
          </Text>
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => router.push('/(consumer)/bookings' as Href)}
              accessibilityLabel={language === 'hu' ? 'Bérléseim' : language === 'es' ? 'Mis reservas' : 'My Rentals'}
              accessibilityRole="button"
            >
              <Text style={styles.quickIcon}>🚗</Text>
              <Text style={styles.quickLabel}>
                {language === 'hu' ? 'Bérléseim' : language === 'es' ? 'Mis reservas' : 'My Rentals'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => router.push('/(consumer)/wishlist' as Href)}
              accessibilityLabel={language === 'hu' ? 'Mentett' : language === 'es' ? 'Guardados' : 'Saved'}
              accessibilityRole="button"
            >
              <Text style={styles.quickIcon}>❤️</Text>
              <Text style={styles.quickLabel}>
                {language === 'hu' ? 'Mentett' : language === 'es' ? 'Guardados' : 'Saved'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => router.push('/(consumer)/profile/notifications' as Href)}
              accessibilityLabel={language === 'hu' ? 'Értesítések' : language === 'es' ? 'Notificaciones' : 'Notifications'}
              accessibilityRole="button"
            >
              <Text style={styles.quickIcon}>🔔</Text>
              <Text style={styles.quickLabel}>
                {language === 'hu' ? 'Értesítések' : language === 'es' ? 'Notificaciones' : 'Notifications'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

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
                  {lang === 'en' ? '🇬🇧 EN' : lang === 'es' ? '🇪🇸 ES' : '🇭🇺 HU'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('sectionSwitchRole', language)}</Text>
          <View style={styles.switchRoleColumn}>
            {(Config.useMock || hasOperatorAccount) && (
              <TouchableOpacity
                style={styles.switchRoleBtn}
                onPress={() => { setRole('operator'); router.replace('/(operator)/dashboard') }}
                accessibilityLabel="Switch to Operator Dashboard"
                accessibilityRole="button"
              >
                <Text style={styles.switchRoleIcon}>🏢</Text>
                <Text style={styles.switchRoleText}>{t('roleOperator', language)}</Text>
                <Text style={styles.switchRoleChevron}>›</Text>
              </TouchableOpacity>
            )}
            {(Config.useMock || hasHostAccount) && (
              <TouchableOpacity
                style={styles.switchRoleBtn}
                onPress={() => { setRole('host'); router.replace('/(host)/dashboard') }}
                accessibilityLabel="Switch to Host Dashboard"
                accessibilityRole="button"
              >
                <Text style={styles.switchRoleIcon}>🏠</Text>
                <Text style={styles.switchRoleText}>{t('roleHost', language)}</Text>
                <Text style={styles.switchRoleChevron}>›</Text>
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
                  {language === 'hu' ? 'Legyen operátor' : language === 'es' ? 'Convertirse en operador' : 'Become an operator'}
                </Text>
                <Text style={styles.switchRoleChevron}>›</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Refer a Friend */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>
            {language === 'hu' ? 'BARÁT MEGHÍVÁSA' : language === 'es' ? 'INVITAR AMIGOS' : 'REFER A FRIEND'}
          </Text>
          <View style={styles.referralCard}>
            <Text style={styles.referralDesc}>
              {language === 'hu'
                ? 'Oszd meg a kódodat és keress 500 hűségpontot minden barátért, aki bérel!'
                : language === 'es'
                  ? '¡Comparte tu código y gana 500 puntos de fidelidad por cada amigo que reserve!'
                  : 'Share your code and earn 500 loyalty points for each friend who books!'}
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
                  {language === 'hu' ? 'Megosztás' : language === 'es' ? 'Compartir' : 'Share'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('sectionAccount', language)}</Text>
          <MenuItem
            label={`🪪 ${t('identityVerification', language)}`}
            onPress={() => router.push('/(consumer)/profile/identity-verification' as Href)}
          />
          <Divider />
          <MenuItem
            label={`💳 ${t('payoutSettings', language)}`}
            onPress={() => {
              Alert.alert(
                t('payoutSettings', language),
                language === 'hu'
                  ? 'A kifizetési beállítások Stripe Connect portálon keresztül kezelhetők. Hamarosan elérhető az app-on belül.'
                  : language === 'es'
                    ? 'Los ajustes de pago se gestionan a través de Stripe Connect. Próximamente disponible en la app.'
                    : 'Payout settings are managed via Stripe Connect. In-app management coming soon.',
                [{ text: 'OK' }],
              )
            }}
          />
          <Divider />
          <MenuItem
            label={`🔔 ${language === 'hu' ? 'Értesítési beállítások' : language === 'es' ? 'Configuración de notificaciones' : 'Notification settings'}`}
            onPress={() => router.push('/(consumer)/profile/notifications' as Href)}
          />
          <Divider />
          <MenuItem
            label={`🛡️ ${language === 'hu' ? 'Adatvédelmi beállítások' : language === 'es' ? 'Configuración de privacidad' : 'Privacy settings'}`}
            onPress={() => router.push('/(consumer)/profile/privacy-settings' as Href)}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('sectionLegal', language)}</Text>
          <MenuItem label={`📄 ${t('termsOfService', language)}`} onPress={handleTermsOfService} />
          <Divider />
          <MenuItem label={`🔒 ${t('privacyPolicy', language)}`} onPress={handlePrivacyPolicy} />
          <Divider />
          <MenuItem label={`🍪 ${t('cookiePolicy', language)}`} onPress={() => router.push('/(consumer)/legal/cookies' as Href)} />
          <Divider />
          <MenuItem label={`🛡️ ${language === 'hu' ? 'Adatvédelmi beállítások' : 'Privacy settings'}`} onPress={() => router.push('/(consumer)/profile/privacy-settings' as Href)} />
          <Divider />
          <MenuItem label={`❓ ${t('helpSupport', language)}`} onPress={handleHelpSupport} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{language === 'hu' ? 'FIÓK TÖRLÉSE' : 'ACCOUNT DELETION'}</Text>
          <MenuItem
            label={`🗑️ ${language === 'hu' ? 'Fiók törlése' : 'Delete account'}`}
            onPress={() => router.push('/(consumer)/profile/delete-account' as Href)}
            danger
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

function MenuItem({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      <Text style={styles.menuChevron}>›</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, marginBottom: Spacing.lg },
  profileSection: { alignItems: 'center', marginBottom: Spacing.xl },
  name: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: Spacing.md },
  email: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  memberSince: { fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    backgroundColor: Colors.warningSurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.warning,
    minHeight: 44,
  },
  verifyBannerText: { fontSize: 12, color: Colors.primaryDark, fontWeight: '600' },
  verifyBannerArrow: { fontSize: 12, color: Colors.primaryDark },
  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  quickRow: { flexDirection: 'row', gap: Spacing.sm },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
  },
  quickIcon: { fontSize: 22, marginBottom: 4 },
  quickLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  langRow: { flexDirection: 'row', gap: Spacing.sm },
  langBtn: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  langBtnActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  langText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  langTextActive: { color: Colors.primaryDark },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, minHeight: 44 },
  menuLabel: { fontSize: 15, color: Colors.text },
  menuLabelDanger: { color: Colors.error },
  menuChevron: { fontSize: 20, color: Colors.textTertiary },
  signOutBtn: { marginHorizontal: Spacing.base, marginTop: Spacing.base, padding: Spacing.base, alignItems: 'center', minHeight: 44 },
  signOutText: { fontSize: 16, color: Colors.error, fontWeight: '600' },
  appVersion: { textAlign: 'center', fontSize: 12, color: Colors.textTertiary, marginTop: Spacing.base, marginBottom: Spacing.md },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
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
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  statLabel: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600', textTransform: 'uppercase' },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  switchRoleColumn: { gap: Spacing.sm },
  switchRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    minHeight: 44,
  },
  switchRoleIcon: { fontSize: 18 },
  switchRoleText: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '600' },
  switchRoleTextAccent: { color: Colors.primary },
  switchRoleBtnAccent: { borderColor: Colors.primary, borderStyle: 'dashed' },
  switchRoleChevron: { fontSize: 20, color: Colors.textTertiary },
  // Referral
  referralCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  referralDesc: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.md, lineHeight: 20 },
  referralCodeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  referralCode: { color: Colors.primary, fontSize: 20, fontWeight: '800', letterSpacing: 2, flex: 1 },
  shareBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
  // Loyalty
  loyaltyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  tierBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  tierBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  loyaltyPoints: { fontSize: 28, fontWeight: '800', marginBottom: Spacing.sm },
  loyaltyPointsLabel: { fontSize: 14, fontWeight: '400', color: Colors.textSecondary },
  progressTrack: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: { height: '100%', borderRadius: Radius.pill },
  loyaltyNextText: { fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.xs },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  perkDot: { fontSize: 8 },
  perkText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
})
