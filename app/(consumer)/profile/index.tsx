import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { Href } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useBookings } from '@/lib/hooks/useBookings'
import { Config } from '@/constants/config'

function AnimatedStat({ value, label }: { value: number; label: string }) {
  const displayValue = useRef(0)
  const anim = useRef(new Animated.Value(0)).current
  const [display, setDisplay] = React.useState(0)

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 800,
      useNativeDriver: false,
    }).start()
    const id = anim.addListener(({ value: v }) => {
      const rounded = Math.round(v)
      if (rounded !== displayValue.current) {
        displayValue.current = rounded
        setDisplay(rounded)
      }
    })
    return () => anim.removeListener(id)
  }, [value])

  return (
    <View style={styles.statItem}>
      <Text style={styles.statNum}>{display}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

export default function ProfileScreen() {
  const { user, operator, role, signOut, language, setLanguage } = useAuthStore()
  const name = Config.useMock ? 'Test User' : (user?.name ?? operator?.name ?? 'User')
  const email = Config.useMock ? 'test@example.com' : (user?.email ?? operator?.email ?? '')
  const userId = Config.useMock ? 'usr-001' : (user?.id ?? null)
  const { bookings } = useBookings(userId)
  const tripCount = Config.useMock ? 4 : bookings.filter(b => b.status === 'completed').length
  const reviewCount = Config.useMock ? 2 : 0
  const avgRating = Config.useMock ? '4.9' : '—'

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

        <View style={styles.profileSection}>
          <Avatar name={name} size={72} />
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>

          {/* Stats row with animated counters */}
          <View style={styles.statsRow}>
            <AnimatedStat value={tripCount} label="Trips" />
            <View style={styles.statDivider} />
            <AnimatedStat value={reviewCount} label="Reviews" />
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>★{avgRating}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>

          {/* Verification badge */}
          <TouchableOpacity
            style={styles.verifyBanner}
            onPress={() => router.push('/(consumer)/profile/verify' as Href)}
          >
            <Text style={styles.verifyBannerText}>⚠️ Verify your identity</Text>
            <Text style={styles.verifyBannerArrow}>→</Text>
          </TouchableOpacity>
        </View>

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

        {Config.useMock && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Switch Role (Mock)</Text>
            <View style={styles.langRow}>
              <TouchableOpacity
                style={[styles.langBtn, role === 'consumer' && styles.langBtnActive]}
                onPress={() => { useAuthStore.getState().setRole('consumer'); router.replace('/(consumer)/explore') }}
              >
                <Text style={styles.langText}>🌴 Consumer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, role === 'host' && styles.langBtnActive]}
                onPress={() => { useAuthStore.getState().setRole('host'); router.replace('/(host)/dashboard') }}
              >
                <Text style={styles.langText}>🏠 Host</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, role === 'operator' && styles.langBtnActive]}
                onPress={() => { useAuthStore.getState().setRole('operator'); router.replace('/(operator)/dashboard') }}
              >
                <Text style={styles.langText}>🏢 Operator</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <MenuItem label="🪪 Identity Verification" onPress={() => router.push('/(consumer)/profile/verify' as Href)} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <MenuItem label="📄 Terms of Service" onPress={() => router.push('/(consumer)/legal/terms' as Href)} />
          <Divider />
          <MenuItem label="🔒 Privacy Policy" onPress={() => router.push('/(consumer)/legal/privacy' as Href)} />
          <Divider />
          <MenuItem label="🍪 Cookie Policy" onPress={() => router.push('/(consumer)/legal/cookies' as Href)} />
          <Divider />
          <MenuItem label="❓ Help & Support" onPress={() => Alert.alert('Help & Support', 'Email us at support@rentivo.app\n\nResponse time: within 24 hours', [{ text: 'OK' }])} />
        </Card>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

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
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, marginBottom: Spacing.lg },
  profileSection: { alignItems: 'center', marginBottom: Spacing.xl },
  name: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: Spacing.md },
  email: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
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
  },
  verifyBannerText: { fontSize: 12, color: Colors.primaryDark, fontWeight: '600' },
  verifyBannerArrow: { fontSize: 12, color: Colors.primaryDark },
  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  langRow: { flexDirection: 'row', gap: Spacing.sm },
  langBtn: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  langBtnActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  langText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  langTextActive: { color: Colors.primaryDark },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  menuLabel: { fontSize: 15, color: Colors.text },
  menuChevron: { fontSize: 20, color: Colors.textTertiary },
  signOutBtn: { marginHorizontal: Spacing.base, marginTop: Spacing.base, padding: Spacing.base, alignItems: 'center' },
  signOutText: { fontSize: 16, color: Colors.error, fontWeight: '600' },
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
})
