import React, { useMemo } from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { Radius, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

const FEATURE_EMOJIS: Record<string, string> = {
  'AC': '❄️',
  'GPS': '🗺️',
  'Bluetooth': '📱',
  'USB': '🔌',
  'Leather seats': '💺',
  'Sunroof': '☀️',
  'Convertible': '🌬️',
  '4WD': '🏔️',
  'Child seat': '👶',
  'Cruise control': '🚗',
  'Parking sensors': '📡',
  'Backup camera': '📷',
  'Heated seats': '🔥',
  'Apple CarPlay': '🍎',
  'Android Auto': '🤖',
}

interface ListingFeaturesProps {
  features: string[]
}

export function ListingFeatures({ features }: ListingFeaturesProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  if (!features || features.length === 0) return null

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {features.map(f => (
        <View key={f} style={styles.pill}>
          {FEATURE_EMOJIS[f] && <Text style={styles.emoji}>{FEATURE_EMOJIS[f]}</Text>}
          <Text style={styles.label}>{f}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { paddingHorizontal: Spacing.base, gap: Spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: C.surfaceWarm,
    borderWidth: 1,
    borderColor: C.border,
  },
  emoji: { fontSize: 14, marginRight: 4 },
  label: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
  })
}
