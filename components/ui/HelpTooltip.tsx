import React, { useState, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native'
import { Spacing, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface HelpTooltipProps {
  title: string
  description: string
  faqs?: { q: string; a: string }[]
}

export function HelpTooltip({ title, description, faqs }: HelpTooltipProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [visible, setVisible] = useState(false)

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setVisible(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.triggerText}>?</Text>
      </TouchableOpacity>

      <Modal
        transparent
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          {faqs && faqs.length > 0 && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.faqHeader}>Frequently asked</Text>
              {faqs.map((faq, i) => (
                <View key={i} style={styles.faqItem}>
                  <Text style={styles.faqQ}>{faq.q}</Text>
                  <Text style={styles.faqA}>{faq.a}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
            <Text style={styles.closeBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  trigger: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surfaceWarm,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textSecondary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: C.overlay,
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: 15,
    color: C.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  faqHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  faqItem: {
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
  },
  faqQ: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  faqA: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 20,
  },
  closeBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textInverse,
  },
  })
}
