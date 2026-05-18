import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface WhatNextStep {
  icon: string
  text: string
}

interface WhatNextProps {
  title?: string
  emoji?: string
  steps: WhatNextStep[]
  primaryAction?: { label: string; onPress: () => void }
  secondaryAction?: { label: string; onPress: () => void }
}

export function WhatNextScreen({
  title = 'What happens next',
  emoji,
  steps,
  primaryAction,
  secondaryAction,
}: WhatNextProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.card}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.steps}>
        {steps.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepIconWrap}>
              <Text style={styles.stepIcon}>{step.icon}</Text>
            </View>
            <Text style={styles.stepText}>{step.text}</Text>
          </View>
        ))}
      </View>
      {primaryAction ? (
        <TouchableOpacity style={styles.primaryBtn} onPress={primaryAction.onPress}>
          <Text style={styles.primaryBtnText}>{primaryAction.label}</Text>
        </TouchableOpacity>
      ) : null}
      {secondaryAction ? (
        <TouchableOpacity style={styles.secondaryBtn} onPress={secondaryAction.onPress}>
          <Text style={styles.secondaryBtnText}>{secondaryAction.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: C.primary,
    marginBottom: Spacing.base,
  },
  emoji: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.base,
  },
  steps: { gap: Spacing.sm },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  stepIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepIcon: { fontSize: 16 },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 20,
    paddingTop: 6,
  },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: C.textInverse,
  },
  secondaryBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  secondaryBtnText: {
    fontSize: 14,
    color: C.textTertiary,
    fontWeight: '600',
  },
  })
}
