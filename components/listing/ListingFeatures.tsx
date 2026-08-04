import React, { useMemo } from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Radius, Spacing, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

const FEATURE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'AC': 'snow-outline',
  'GPS': 'navigate-outline',
  'Bluetooth': 'bluetooth-outline',
  'USB': 'hardware-chip-outline',
  'Leather seats': 'layers-outline',
  'Sunroof': 'sunny-outline',
  'Convertible': 'car-sport-outline',
  '4WD': 'trail-sign-outline',
  'Child seat': 'person-outline',
  'Cruise control': 'speedometer-outline',
  'Parking sensors': 'radio-outline',
  'Backup camera': 'camera-outline',
  'Heated seats': 'flame-outline',
  'Apple CarPlay': 'logo-apple',
  'Android Auto': 'logo-android',
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
          {FEATURE_ICONS[f] && (
            <Ionicons
              name={FEATURE_ICONS[f]}
              size={14}
              color={C.textSecondary}
              style={styles.icon}
              importantForAccessibility="no"
            />
          )}
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
  icon: { marginRight: 4 },
  label: { fontSize: 13, color: C.textSecondary, fontFamily: Fonts.medium },
  })
}
