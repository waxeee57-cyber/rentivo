import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface StarRatingProps {
  rating: number
  reviewCount?: number
  size?: number
  showCount?: boolean
}

export function StarRating({ rating, reviewCount, size = 14, showCount = true }: StarRatingProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.row}>
      <Text style={[styles.star, { fontSize: size }]}>★</Text>
      <Text style={[styles.rating, { fontSize: size }]}>{rating.toFixed(1)}</Text>
      {showCount && reviewCount !== undefined && (
        <Text style={[styles.count, { fontSize: size }]}> ({reviewCount})</Text>
      )}
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { color: C.primary },
  rating: { color: C.text, fontWeight: '600', marginLeft: 2 },
  count: { color: C.textTertiary },
  })
}
