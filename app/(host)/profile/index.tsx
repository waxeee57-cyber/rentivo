import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { MOCK_HOST } from '@/lib/mockData'
import { Config } from '@/constants/config'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'

export default function HostProfileScreen() {
  const { host, signOut, role, setRole, language, setLanguage } = useAuthStore()
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

  const totalEarned = Config.useMock ? 63000 : 0

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
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
              <Text style={styles.verifiedText}>✓ Verified host</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{totalRentals}</Text>
            <Text style={styles.statLabel}>Rentals</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{formatEURDecimal(totalEarned)}</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{responseRate}%</Text>
            <Text style={styles.statLabel}>Response</Text>
          </View>
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Listings</Text>
          <MenuItem label="🚗 My vehicles" onPress={() => router.push('/(host)/listings')} />
          <Divider />
          <MenuItem label="➕ List something new" onPress={() => router.push('/(host)/listings/new')} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <MenuItem label="🔗 Connected Platforms" onPress={() => router.push('/(consumer)/profile/connected-platforms' as Parameters<typeof router.push>[0])} />
          <Divider />
          <MenuItem label="🪪 Identity verification" onPress={() => router.push('/(consumer)/profile/verify' as Parameters<typeof router.push>[0])} />
          <Divider />
          <MenuItem
            label={hostData?.stripe_onboarded ? '💳 Payout settings' : '💳 Set up payouts'}
            onPress={() => Alert.alert('Payout Setup', 'Configure your bank account for payouts at dashboard.rentivo.app → Payouts', [{ text: 'OK' }])}
          />
          <Divider />
          <MenuItem label="🔔 Notification preferences" onPress={() => Alert.alert('Notifications', 'Notification settings coming soon.', [{ text: 'OK' }])} />
        </Card>

        {Config.useMock && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Switch Role</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'consumer' && styles.roleBtnActive]}
                onPress={() => { setRole('consumer'); router.replace('/(consumer)/explore') }}
              >
                <Text style={styles.roleText}>🌴 Consumer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'host' && styles.roleBtnActive]}
                onPress={() => { setRole('host'); router.replace('/(host)/dashboard') }}
              >
                <Text style={styles.roleText}>🏠 Host</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'operator' && styles.roleBtnActive]}
                onPress={() => { setRole('operator'); router.replace('/(operator)/dashboard') }}
              >
                <Text style={styles.roleText}>🏢 Operator</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Language</Text>
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
          <Text style={styles.sectionTitle}>Legal</Text>
          <MenuItem label="📄 Terms of Service" onPress={() => {}} />
          <Divider />
          <MenuItem label="🔒 Privacy Policy" onPress={() => {}} />
          <Divider />
          <MenuItem label="❓ Help & Support" onPress={() => {}} />
        </Card>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.appVersion}>Rentivo v1.0.0</Text>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuChevron}>›</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  profileSection: { alignItems: 'center', paddingBottom: Spacing.xl },
  name: { fontSize: 22, fontWeight: '700', color: Colors.text, marginTop: Spacing.md },
  location: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  ratingText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  ratingDot: { fontSize: 15, color: Colors.textTertiary },
  reviewCount: { fontSize: 14, color: Colors.textSecondary },
  memberSince: { fontSize: 13, color: Colors.textTertiary, marginTop: 4 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.successSurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  verifiedText: { fontSize: 13, fontWeight: '700', color: Colors.success },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  statLabel: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600', textTransform: 'uppercase' },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  menuLabel: { fontSize: 15, color: Colors.text },
  menuChevron: { fontSize: 20, color: Colors.textTertiary },

  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleBtn: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  roleBtnActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  roleText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  langRow: { flexDirection: 'row', gap: Spacing.sm },
  langBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  langBtnActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  langText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  langTextActive: { color: Colors.primary },

  signOutBtn: { marginHorizontal: Spacing.base, marginTop: Spacing.base, padding: Spacing.base, alignItems: 'center' },
  signOutText: { fontSize: 16, color: Colors.error, fontWeight: '600' },
  appVersion: { textAlign: 'center', fontSize: 12, color: Colors.textTertiary, marginTop: Spacing.base, marginBottom: Spacing.md },
})
