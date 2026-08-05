import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Radius, Spacing, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

/**
 * Slot-by-slot pickup/return photo comparison for the operator damage review.
 *
 * Deliberately dumb: every label arrives already translated, because this
 * component is rendered inside a screen that owns `language`. It renders an
 * <Image> ONLY for a non-null uri — damage report photo columns are all
 * nullable, and an <Image source={{ uri: null }}> is a runtime error.
 */
export interface DamageComparePair {
  key: string
  /** Translated slot name, e.g. "Front". */
  label: string
  /** Pickup photo url, or null when that slot was never captured. */
  before: string | null
  /** Return photo url, or null. */
  after: string | null
}

interface DamagePhotoCompareProps {
  pairs: DamageComparePair[]
  beforeLabel: string
  afterLabel: string
  /** Shown inside a slot that has no photo. */
  missingLabel: string
}

export function DamagePhotoCompare({
  pairs, beforeLabel, afterLabel, missingLabel,
}: DamagePhotoCompareProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.slotLabelCol} />
        <Text style={styles.colHeader} numberOfLines={1}>{beforeLabel}</Text>
        <Text style={styles.colHeader} numberOfLines={1}>{afterLabel}</Text>
      </View>

      {pairs.map(pair => (
        <View key={pair.key} style={styles.row}>
          <View style={styles.slotLabelCol}>
            <Text style={styles.slotLabel} numberOfLines={2}>{pair.label}</Text>
          </View>
          <Cell uri={pair.before} missingLabel={missingLabel} a11y={`${pair.label} — ${beforeLabel}`} />
          <Cell uri={pair.after} missingLabel={missingLabel} a11y={`${pair.label} — ${afterLabel}`} />
        </View>
      ))}
    </View>
  )
}

function Cell({ uri, missingLabel, a11y }: { uri: string | null; missingLabel: string; a11y: string }) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])

  if (!uri) {
    return (
      <View style={[styles.cell, styles.cellEmpty]} accessible accessibilityRole="text">
        <Text style={styles.missingText} numberOfLines={2}>{missingLabel}</Text>
      </View>
    )
  }

  return (
    <Image
      source={{ uri }}
      style={styles.cell}
      contentFit="cover"
      accessible
      accessibilityLabel={a11y}
      transition={120}
    />
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    slotLabelCol: {
      width: 68,
    },
    slotLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: C.textSecondary,
    },
    colHeader: {
      flex: 1,
      fontSize: 11,
      fontFamily: Fonts.bold,
      color: C.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    cell: {
      flex: 1,
      height: 84,
      borderRadius: Radius.md,
      backgroundColor: C.surfaceWarm,
    },
    cellEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.border,
      borderStyle: 'dashed',
    },
    missingText: {
      fontSize: 11,
      fontFamily: Fonts.regular,
      color: C.textTertiary,
      textAlign: 'center',
      paddingHorizontal: Spacing.xs,
    },
  })
}
