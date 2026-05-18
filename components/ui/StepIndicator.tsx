import React, { useEffect, useRef, useMemo } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface StepIndicatorProps {
  totalSteps: number
  currentStep: number
  labels?: string[]
}

function PulsingDot({ children }: { children: React.ReactNode }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 650, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 650, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [])

  return (
    <Animated.View style={[styles.dot, styles.dotCurrent, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  )
}

export function StepIndicator({ totalSteps, currentStep, labels }: StepIndicatorProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1
          const isDone = step < currentStep
          const isCurrent = step === currentStep

          const dot = isCurrent
            ? (
              <PulsingDot>
                <Text style={styles.stepNumCurrent}>{step}</Text>
              </PulsingDot>
            )
            : (
              <View style={[styles.dot, isDone && styles.dotDone]}>
                {isDone
                  ? <Text style={styles.checkmark}>✓</Text>
                  : <Text style={styles.stepNum}>{step}</Text>
                }
              </View>
            )

          return (
            <React.Fragment key={step}>
              <View style={styles.stepCol}>
                {dot}
                {labels?.[i] != null && (
                  <Text style={[
                    styles.label,
                    isCurrent && styles.labelCurrent,
                    isDone && styles.labelDone,
                  ]} numberOfLines={1}>
                    {labels[i]}
                  </Text>
                )}
              </View>
              {step < totalSteps && (
                <View style={[styles.connector, isDone && styles.connectorDone]} />
              )}
            </React.Fragment>
          )
        })}
      </View>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepCol: {
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surfaceWarm,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCurrent: {
    backgroundColor: C.primarySurface,
    borderColor: C.primary,
  },
  dotDone: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textTertiary,
  },
  stepNumCurrent: {
    fontSize: 12,
    fontWeight: '700',
    color: C.primary,
  },
  checkmark: {
    fontSize: 12,
    fontWeight: '800',
    color: C.textInverse,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: C.border,
    marginHorizontal: 4,
    marginTop: 13,
  },
  connectorDone: {
    backgroundColor: C.primary,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: C.textTertiary,
    textAlign: 'center',
    maxWidth: 60,
  },
  labelCurrent: {
    color: C.primary,
    fontWeight: '700',
  },
  labelDone: {
    color: C.success,
  },
  })
}
