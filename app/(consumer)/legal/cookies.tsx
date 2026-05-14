import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'

export default function CookiePolicyScreen() {
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  const handleSave = async () => {
    await AsyncStorage.setItem('cookie_preferences', JSON.stringify({ essential: true, analytics, marketing }))
    router.back()
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Cookie Policy" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          We use cookies and similar technologies to operate our service and enhance your experience. Manage your preferences below.
        </Text>

        <View style={styles.cookieCard}>
          <View style={styles.cookieRow}>
            <View style={styles.cookieInfo}>
              <Text style={styles.cookieName}>Essential Cookies</Text>
              <Text style={styles.cookieDesc}>Required for authentication and core app functionality. Cannot be disabled.</Text>
            </View>
            <Switch value={true} disabled trackColor={{ true: Colors.success }} />
          </View>
        </View>

        <View style={styles.cookieCard}>
          <View style={styles.cookieRow}>
            <View style={styles.cookieInfo}>
              <Text style={styles.cookieName}>Analytics Cookies</Text>
              <Text style={styles.cookieDesc}>Help us understand how the app is used to improve performance and features.</Text>
            </View>
            <Switch
              value={analytics}
              onValueChange={setAnalytics}
              trackColor={{ true: Colors.primary }}
            />
          </View>
        </View>

        <View style={styles.cookieCard}>
          <View style={styles.cookieRow}>
            <View style={styles.cookieInfo}>
              <Text style={styles.cookieName}>Marketing Cookies</Text>
              <Text style={styles.cookieDesc}>Used to show relevant promotions and personalized offers within the app.</Text>
            </View>
            <Switch
              value={marketing}
              onValueChange={setMarketing}
              trackColor={{ true: Colors.primary }}
            />
          </View>
        </View>

        <Text style={styles.note}>
          Your preferences are saved locally. For more information, see our Privacy Policy. Changing these settings takes effect on next app launch.
        </Text>

        <Button title="Save Preferences" onPress={handleSave} fullWidth style={{ marginTop: Spacing.xl }} />
        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  intro: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  cookieCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  cookieRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cookieInfo: { flex: 1 },
  cookieName: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  cookieDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  note: { fontSize: 12, color: Colors.textTertiary, lineHeight: 18, marginTop: Spacing.md },
})
