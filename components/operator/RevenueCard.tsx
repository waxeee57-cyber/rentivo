import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface RevenueCardProps {
  label: string
  value: string
  sub?: string
  emoji?: string
}

export function RevenueCard({ label, value, sub, emoji }: RevenueCardProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.card}>
      {emoji && <Text style={styles.emoji}>{emoji}</Text>}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    minWidth: 80,
  },
  emoji: { fontSize: 20, marginBottom: Spacing.xs },
  value: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 2 },
  label: { fontSize: 13, color: C.textTertiary, textAlign: 'center' },
  sub: { fontSize: 11, color: C.textTertiary, textAlign: 'center', marginTop: 2 },
  })
}
