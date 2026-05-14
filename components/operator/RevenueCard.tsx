import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Radius, Spacing } from '@/constants/colors'

interface RevenueCardProps {
  label: string
  value: string
  sub?: string
  emoji?: string
}

export function RevenueCard({ label, value, sub, emoji }: RevenueCardProps) {
  return (
    <View style={styles.card}>
      {emoji && <Text style={styles.emoji}>{emoji}</Text>}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    minWidth: 80,
  },
  emoji: { fontSize: 20, marginBottom: Spacing.xs },
  value: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  label: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center' },
  sub: { fontSize: 11, color: Colors.textTertiary, textAlign: 'center', marginTop: 2 },
})
