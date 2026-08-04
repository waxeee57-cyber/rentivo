import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Spacing, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'

interface StarRatingProps {
  rating: number
  reviewCount?: number
  size?: number
  showCount?: boolean
}

export function StarRating({ rating, reviewCount, size = 14, showCount = true }: StarRatingProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const language = useAuthStore(s => s.language)
  // No reviews yet → "★ 0.0 (0)" reads as a terrible rating instead of no
  // rating. Show a friendly "New" marker until the first review lands.
  const isUnrated = (reviewCount === 0 || reviewCount === undefined) && rating === 0
  if (isUnrated) {
    return (
      <View
        style={styles.row}
        accessible
        accessibilityRole="text"
        accessibilityLabel={t('starRatingNewA11y', language)}
      >
        <Text style={[styles.star, { fontFamily: Fonts.regular, fontSize: size }]} accessibilityElementsHidden importantForAccessibility="no">★</Text>
        <Text style={[styles.newLabel, { fontFamily: Fonts.regular, fontSize: size }]} accessibilityElementsHidden importantForAccessibility="no">
          {t('starRatingNew', language)}
        </Text>
      </View>
    )
  }
  const showsCount = showCount && reviewCount !== undefined
  // The three Texts used to be announced as three separate nodes — "black
  // star", "4.8", "(23)". `accessible` collapses them into one node and the
  // children are hidden so nothing is read twice.
  const label = showsCount
    ? t('starRatingA11y', language, { rating: rating.toFixed(1), count: reviewCount ?? 0 })
    : t('starRatingNoCountA11y', language, { rating: rating.toFixed(1) })
  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={label}>
      <Text style={[styles.star, { fontFamily: Fonts.regular, fontSize: size }]} accessibilityElementsHidden importantForAccessibility="no">★</Text>
      <Text style={[styles.rating, { fontFamily: Fonts.regular, fontSize: size }]} accessibilityElementsHidden importantForAccessibility="no">
        {rating.toFixed(1)}
      </Text>
      {showsCount && (
        <Text style={[styles.count, { fontFamily: Fonts.regular, fontSize: size }]} accessibilityElementsHidden importantForAccessibility="no">
          {' '}({reviewCount})
        </Text>
      )}
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { color: C.text },
  rating: { color: C.text, fontFamily: Fonts.semibold, marginLeft: 2 },
  count: { color: C.textTertiary },
  newLabel: { color: C.textSecondary, fontFamily: Fonts.semibold, marginLeft: 2 },
  })
}
