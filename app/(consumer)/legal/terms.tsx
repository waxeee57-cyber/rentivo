import React, { useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'

// The contract must quote the fee actually charged. Section 3 said "2.5%" while
// Config.platformCut defaults to 0.10 — a contract that contradicts the charge.
// Formatted exactly like components/booking/PriceBreakdown.tsx so the Terms and
// the checkout line can never drift apart.
const PLATFORM_FEE_PCT = (Config.platformCut * 100).toFixed(
  Number.isInteger(Config.platformCut * 100) ? 0 : 1,
)

const SECTIONS = [
  {
    title: '1. Service Description',
    body: 'Rentivo is a peer-to-peer rental marketplace connecting vehicle and equipment owners ("Operators") with renters ("Consumers"). Rentivo acts as an intermediary platform and is not a party to the rental agreement between Operators and Consumers.',
  },
  {
    title: '2. User Obligations',
    body: 'You must be at least 18 years old to use Rentivo. You agree to provide accurate information, maintain the security of your account, use vehicles responsibly and in accordance with local laws, and return rentals in the same condition as received.',
  },
  {
    title: '3. Payments',
    body: `All payments are processed securely via Stripe. Rentivo charges a platform fee of ${PLATFORM_FEE_PCT}% on each transaction. The security deposit is held as an authorization and released within 7 days of return if no damage is reported.`,
  },
  {
    title: '4. Cancellation Policy',
    body: 'Each listing has its own cancellation policy (Flexible, Moderate, or Strict). The applicable policy is shown on the listing and at checkout. Rentivo\'s platform fee is non-refundable in all cases.',
  },
  {
    // Rentivo has no underwriter and no insurance-intermediary registration, so
    // the old "€500,000 third-party liability / €500 excess" promise was a
    // regulated insurance claim it could not honour (IDD 2016/97). Third-party
    // liability belongs to the Operator's compulsory motor policy; the Rentivo
    // product is a contractual damage waiver, capped by the deposit it replaces.
    title: '5. Damage Waiver & Liability',
    body: 'Rentivo is not an insurer and does not distribute insurance. Third-party liability for a rented vehicle is covered by that vehicle\'s own compulsory motor insurance, which the Operator is legally required to hold. Rentivo separately offers an optional paid damage waiver: where a paid waiver is taken, the security deposit is set to €0 and Rentivo reduces or releases the Consumer\'s own liability for damage to the rented item, up to the deposit amount that would otherwise have applied. Without a paid waiver the full security deposit applies and the Consumer remains liable for damage. Rentivo is not liable for indirect or consequential damages.',
  },
  {
    title: '6. Damage & Disputes',
    body: 'Damage must be reported at pickup or return via the in-app inspection tool. Disputes are first handled between Consumer and Operator. Rentivo may mediate but does not guarantee resolution. False damage claims may result in account suspension.',
  },
  {
    title: '7. Governing Law',
    body: 'These Terms are governed by the laws of Spain. Any disputes shall be subject to the exclusive jurisdiction of the courts of Marbella, Spain, except where mandatory local law provides otherwise.',
  },
]

export default function TermsOfServiceScreen() {
  const C = useColors()
  const { language } = useAuthStore()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('termsOfService', language)} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>{t('legLastUpdated', language)} January 2025</Text>
        <Text style={styles.intro}>
          Please read these Terms of Service carefully before using Rentivo. By using the app you agree to be bound by these terms.
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
  lastUpdated: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, marginBottom: Spacing.md },
  intro: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  section: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 15, fontFamily: Fonts.bold, color: C.text, marginBottom: Spacing.sm },
  sectionBody: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, lineHeight: 22 },
  })
}
