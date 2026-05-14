import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing, Radius } from '@/constants/colors'

interface StepIndicatorProps {
  totalSteps: number
  currentStep: number
  labels?: string[]
}

export function StepIndicator({ totalSteps, currentStep, labels }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1
          const isDone = step < currentStep
          const isCurrent = step === currentStep
          return (
            <React.Fragment key={step}>
              <View style={styles.stepCol}>
                <View style={[
                  styles.dot,
                  isDone && styles.dotDone,
                  isCurrent && styles.dotCurrent,
                ]}>
                  {isDone ? (
                    <Text style={styles.checkmark}>✓</Text>
                  ) : (
                    <Text style={[styles.stepNum, isCurrent && styles.stepNumCurrent]}>
                      {step}
                    </Text>
                  )}
                </View>
                {labels && labels[i] && (
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

const styles = StyleSheet.create({
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
    backgroundColor: Colors.surfaceWarm,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCurrent: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  dotDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  stepNumCurrent: {
    color: Colors.primary,
  },
  checkmark: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textInverse,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
    marginTop: 13,
  },
  connectorDone: {
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textTertiary,
    textAlign: 'center',
    maxWidth: 60,
  },
  labelCurrent: {
    color: Colors.primary,
    fontWeight: '700',
  },
  labelDone: {
    color: Colors.success,
  },
})
