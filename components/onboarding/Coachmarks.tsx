import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Spacing, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

const { width, height } = Dimensions.get('window')

interface CoachmarkStep {
  title: string
  body: string
  targetHint: string
}

const EXPLORE_STEPS: CoachmarkStep[] = [
  {
    title: 'Start your search here',
    body: 'Tap the search bar to find vehicles by city or dates.',
    targetHint: 'search-bar',
  },
  {
    title: 'Explore the map',
    body: 'Each marker is a listing. Tap it to see details and price.',
    targetHint: 'map-marker',
  },
  {
    title: 'Filter by category',
    body: 'Use these pills to filter by car, boat, scooter and more.',
    targetHint: 'category-pills',
  },
]

const STORAGE_KEY = 'coachmarks_explore_done'

interface CoachmarksProps {
  screen: 'explore'
}

export function Coachmarks({ screen }: CoachmarksProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(done => {
      if (!done) setVisible(true)
    }).catch(() => {})
  }, [])

  const handleNext = () => {
    if (step < EXPLORE_STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      void AsyncStorage.setItem(STORAGE_KEY, 'true')
      setVisible(false)
    }
  }

  const handleSkip = () => {
    void AsyncStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  const current = EXPLORE_STEPS[step]

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleNext} />
        <View style={styles.tooltip}>
          <View style={styles.stepRow}>
            {EXPLORE_STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.stepDot, i === step && styles.stepDotActive]}
              />
            ))}
          </View>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleSkip}>
              <Text style={styles.skip}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextText}>
                {step < EXPLORE_STEPS.length - 1 ? 'Next →' : 'Got it! ✓'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'flex-end',
    paddingBottom: 160,
    paddingHorizontal: Spacing.base,
  },
  tooltip: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: C.border,
  },
  stepRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.md },
  stepDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.border,
  },
  stepDotActive: { backgroundColor: C.primary, width: 20 },
  title: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: Spacing.sm },
  body: { fontSize: 14, color: C.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skip: { fontSize: 14, color: C.textTertiary, fontWeight: '600' },
  nextBtn: {
    backgroundColor: C.primary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
  },
  nextText: { fontSize: 14, fontWeight: '800', color: C.textInverse },
  })
}
