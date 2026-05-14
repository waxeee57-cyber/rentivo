import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'

export default function ProfileScreen() {
  const { user, operator, role, signOut, language, setLanguage } = useAuthStore()
  const name = Config.useMock ? 'Test User' : (user?.name ?? operator?.name ?? 'User')
  const email = Config.useMock ? 'test@example.com' : (user?.email ?? operator?.email ?? '')

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.profileSection}>
        <Avatar name={name} size={72} />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
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
              style={[styles.langBtn, role === 'operator' && styles.langBtnActive]}
              onPress={() => { useAuthStore.getState().setRole('operator'); router.replace('/(operator)/dashboard') }}
            >
              <Text style={styles.langText}>🚗 Operator</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      <Card style={styles.card}>
        <MenuItem label="Terms of Service" onPress={() => {}} />
        <Divider />
        <MenuItem label="Privacy Policy" onPress={() => {}} />
        <Divider />
        <MenuItem label="Help & Support" onPress={() => {}} />
      </Card>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
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
})
