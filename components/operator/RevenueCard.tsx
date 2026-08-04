import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Radius, Spacing, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface RevenueCardProps {
  label: string
  value: string
  sub?: string
  icon?: React.ComponentProps<typeof Ionicons>['name']
}

export function RevenueCard({ label, value, sub, icon }: RevenueCardProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.card}>
      {icon
        ? <Ionicons name={icon} size={18} color={C.textSecondary} style={{ marginBottom: Spacing.xs }} />
        : null}
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
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
  value: { fontSize: 20, fontFamily: Fonts.extrabold, color: C.text, marginBottom: 2 },
  label: { fontFamily: Fonts.regular, fontSize: 13, color: C.textTertiary, textAlign: 'center' },
  sub: { fontFamily: Fonts.regular, fontSize: 11, color: C.textTertiary, textAlign: 'center', marginTop: 2 },
  })
}
