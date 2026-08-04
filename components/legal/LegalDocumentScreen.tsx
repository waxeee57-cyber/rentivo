import React, { useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { t, type TranslationKey } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { getLegalDoc, isLegalBullet, stripLegalBullet, type LegalDocId } from '@/constants/legal'

interface LegalDocumentScreenProps {
  docId: LegalDocId
  /** Screen title key — the three already exist in constants/i18n.ts. */
  titleKey: TranslationKey
}

/**
 * Renders one legal document from constants/legal.ts.
 *
 * All three legal screens share this so that none of them can hold its own copy
 * of the text. The web pages under public/legal/ are generated from the same
 * literal by scripts/build-legal.mjs. Before this existed, the in-app privacy
 * policy and the hosted one disagreed about who the data controller was.
 */
export function LegalDocumentScreen({ docId, titleKey }: LegalDocumentScreenProps) {
  const C = useColors()
  const { language } = useAuthStore()
  const styles = useMemo(() => makeStyles(C), [C])
  const doc = useMemo(() => getLegalDoc(language, docId), [language, docId])

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t(titleKey, language)} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>
          {t('legLastUpdated', language)} {doc.updated}  ·  v{doc.version}
        </Text>
        <Text style={styles.intro}>{doc.intro}</Text>

        {doc.sections.map((section, index) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{index + 1}. {section.title}</Text>
            {section.body.map((paragraph, i) =>
              isLegalBullet(paragraph) ? (
                <View key={`${section.id}-${i}`} style={styles.bulletRow}>
                  <Text style={styles.bulletMark}>·</Text>
                  <Text style={styles.bulletText}>{stripLegalBullet(paragraph)}</Text>
                </View>
              ) : (
                <Text key={`${section.id}-${i}`} style={styles.sectionBody}>{paragraph}</Text>
              ),
            )}
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
    sectionBody: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, lineHeight: 22, marginBottom: Spacing.sm },
    bulletRow: { flexDirection: 'row', marginBottom: Spacing.sm },
    bulletMark: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 22, color: C.textTertiary, width: 14 },
    bulletText: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, lineHeight: 22 },
  })
}
