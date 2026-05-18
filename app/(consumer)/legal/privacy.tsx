import React, { useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Spacing, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

const SECTIONS = [
  {
    title: 'Data We Collect',
    body: 'We collect information you provide when creating an account (name, email, phone), payment details processed securely by Stripe, driver\'s license information for verification, location data when using the map feature, and usage analytics to improve our service.',
  },
  {
    title: 'How We Use Your Data',
    body: 'Your data is used to process bookings and payments, verify your identity for rental eligibility, communicate about your reservations, improve the app experience, and comply with legal obligations.',
  },
  {
    title: 'Third-Party Services',
    body: 'We use Stripe for payment processing, Supabase for secure data storage, Expo for push notifications, and analytics providers. Each third party has their own privacy policy and data handling practices.',
  },
  {
    title: 'Your Rights',
    body: 'Under GDPR you have the right to access, correct, or delete your personal data. You may withdraw consent at any time, request data portability, and object to processing. Contact us at privacy@rentivo.app to exercise these rights.',
  },
  {
    title: 'Data Retention',
    body: 'We retain your data for the duration of your account and up to 7 years for financial records as required by law. Booking data is kept for dispute resolution purposes.',
  },
  {
    title: 'Cookies',
    body: 'We use essential cookies for authentication, performance cookies to analyze usage, and preference cookies to remember your settings. See our Cookie Policy for details.',
  },
  {
    title: 'Contact Us',
    body: 'For privacy questions, contact our Data Protection Officer at privacy@rentivo.app or write to Rentivo SL, Av. Ricardo Soriano 72, Marbella, Spain.',
  },
]

export default function PrivacyPolicyScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Privacy Policy" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>Last updated: January 2025</Text>
        <Text style={styles.intro}>
          Rentivo ("we", "our", "us") is committed to protecting your privacy. This policy explains how we collect, use, and protect your personal data.
        </Text>
        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  lastUpdated: { fontSize: 12, color: C.textTertiary, marginBottom: Spacing.md },
  intro: { fontSize: 14, color: C.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  section: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: Spacing.sm },
  sectionBody: { fontSize: 14, color: C.textSecondary, lineHeight: 22 },
  })
}
