import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

const PLATFORM_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  vrbo: 'VRBO',
  turo: 'Turo',
  holidu: 'Holidu',
  other: 'an external platform',
}

interface AffiliateDisclosureProps {
  platform: string
  compact?: boolean
}

export function AffiliateDisclosure({ platform, compact = false }: AffiliateDisclosureProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const label = PLATFORM_LABELS[platform] ?? platform

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Ionicons
        name="information-circle-outline"
        size={14}
        color={C.info}
        style={styles.icon}
        importantForAccessibility="no"
      />
      <Text style={styles.text}>
        {compact
          ? `via ${label} · Rentivo may earn a commission`
          : `This listing is from ${label}. Rentivo may earn a commission if you book through this link. The price you pay is the same.`}
      </Text>
    </View>
  )
}

export function AffiliateSearchDisclosure() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.searchBanner}>
      <Text style={styles.searchBannerText}>
        <Ionicons name="information-circle-outline" size={12} color={C.info} />
        {' '}Results include listings from partner platforms. Rentivo may earn a commission.
      </Text>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: C.infoSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: C.info,
    marginTop: Spacing.md,
  },
  containerCompact: {
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  icon: { marginTop: 1 },
  text: {
    flex: 1,
    fontFamily: Fonts.regular, fontSize: 12,
    color: C.info,
    lineHeight: 17,
  },
  searchBanner: {
    backgroundColor: C.infoSurface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: C.info,
  },
  searchBannerText: {
    fontFamily: Fonts.regular, fontSize: 12,
    color: C.info,
    textAlign: 'center',
  },
  })
}
