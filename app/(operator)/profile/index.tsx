import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'

export default function OperatorProfileScreen() {
  const { operator, signOut, language, setLanguage } = useAuthStore()
  const op = Config.useMock ? MOCK_OPERATOR : operator

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Operator Profile</Text>

      <View style={styles.profileSection}>
        <Avatar name={op?.name} imageUrl={op?.logo_url} size={72} />
        <Text style={styles.name}>{op?.name}</Text>
        <Text style={styles.city}>{op?.city}, {op?.country}</Text>
        {op?.verified && <Text style={styles.verified}>✓ Verified operator</Text>}
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
          <TouchableOpacity
            onPress={() => { useAuthStore.getState().setRole('consumer'); router.replace('/(consumer)/explore') }}
          >
            <Text style={styles.switchText}>{t('switchRole', language)}: {t('roleConsumer', language)}</Text>
          </TouchableOpacity>
        </Card>
      )}

      <Card style={styles.card}>
        <MenuItem label="🔗 Connected Platforms" onPress={() => router.push('/(consumer)/profile/connected-platforms' as Parameters<typeof router.push>[0])} />
        <Divider />
        <MenuItem label="Business settings" onPress={() => Alert.alert('Business Settings', 'Manage your business profile, VAT number, and documents in the web dashboard at dashboard.rentivo.app', [{ text: 'OK' }])} />
        <Divider />
        <MenuItem label="Payout settings" onPress={() => Alert.alert('Payout Settings', 'Configure your bank account and payout schedule at dashboard.rentivo.app → Payouts', [{ text: 'OK' }])} />
        <Divider />
        <MenuItem label="Help & Support" onPress={() => Alert.alert('Help & Support', 'Email us at support@rentivo.app\n\nResponse time: within 24 hours', [{ text: 'OK' }])} />
      </Card>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.appVersion}>Rentivo v1.0.0</Text>
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
  city: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  verified: { fontSize: 13, color: Colors.success, fontWeight: '600', marginTop: 4 },
  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  langRow: { flexDirection: 'row', gap: Spacing.sm },
  langBtn: { flex: 1, padding: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  langBtnActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  langText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  langTextActive: { color: Colors.primaryDark },
  switchText: { fontSize: 14, color: Colors.primary, fontWeight: '600', textAlign: 'center' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  menuLabel: { fontSize: 15, color: Colors.text },
  menuChevron: { fontSize: 20, color: Colors.textTertiary },
  signOutBtn: { marginHorizontal: Spacing.base, marginTop: Spacing.base, padding: Spacing.base, alignItems: 'center' },
  signOutText: { fontSize: 16, color: Colors.error, fontWeight: '600' },
  appVersion: { textAlign: 'center', fontSize: 12, color: Colors.textTertiary, marginTop: Spacing.base, marginBottom: Spacing.md },
})
