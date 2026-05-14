import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing } from '@/constants/colors'

interface StarRatingProps {
  rating: number
  reviewCount?: number
  size?: number
  showCount?: boolean
}

export function StarRating({ rating, reviewCount, size = 14, showCount = true }: StarRatingProps) {
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { color: Colors.primary },
  rating: { color: Colors.text, fontWeight: '600', marginLeft: 2 },
  count: { color: Colors.textTertiary },
})
