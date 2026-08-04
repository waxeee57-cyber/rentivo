import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { INSURANCE_PACKAGES } from '@/types'
import type { InsuranceId } from '@/types'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { useColors } from '@/lib/hooks/useColors'

interface InsuranceSelectorProps {
  selected: InsuranceId
  onSelect: (id: InsuranceId) => void
  language: 'en' | 'es' | 'hu'
}

export function InsuranceSelector({ selected, onSelect, language }: InsuranceSelectorProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('insuranceTitle', language)}</Text>
      {INSURANCE_PACKAGES.map((pkg) => {
        const isSelected = selected === pkg.id
        const name = t(pkg.nameKey, language)
        const desc = t(pkg.descKey, language)

        return (
          <TouchableOpacity
            key={pkg.id}
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => onSelect(pkg.id)}
            accessibilityLabel={`${name} insurance${pkg.price > 0 ? `, ${formatEURDecimal(pkg.price)} per day` : ', free'}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            activeOpacity={0.75}
          >
            <View style={styles.cardRow}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{pkg.icon}</Text>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.nameBadgeRow}>
                  <Text style={[styles.name, isSelected && styles.nameSelected]}>{name}</Text>
                  {'recommended' in pkg && pkg.recommended === true && (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>{t('insuranceRecommended', language)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.desc}>{desc}</Text>
              </View>

              <View style={styles.priceBlock}>
                {pkg.price > 0 ? (
                  <>
                    <Text style={[styles.price, isSelected && styles.priceSelected]}>
                      {formatEURDecimal(pkg.price)}
                    </Text>
                    <Text style={styles.priceUnit}>{t('insurancePerDay', language)}</Text>
                  </>
                ) : (
                  <Text style={[styles.priceFree, isSelected && styles.priceSelected]}>Free</Text>
                )}
              </View>
            </View>

            {/* Selection indicator dot */}
            <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
              {isSelected && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: C.text,
    marginBottom: Spacing.base,
    marginTop: Spacing.xl,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardSelected: {
    borderColor: C.primary,
    backgroundColor: C.primarySurface,
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontFamily: Fonts.regular, fontSize: 18,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: C.text,
  },
  nameSelected: {
    color: C.primary,
  },
  recommendedBadge: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recommendedText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: C.textInverse,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  desc: {
    fontFamily: Fonts.regular, fontSize: 12,
    color: C.textSecondary,
    lineHeight: 16,
  },
  priceBlock: {
    alignItems: 'flex-end',
    minWidth: 52,
  },
  price: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: C.text,
  },
  priceSelected: {
    color: C.primary,
  },
  priceFree: {
    fontSize: 13,
    fontFamily: Fonts.semibold,
    color: C.success,
  },
  priceUnit: {
    fontSize: 10,
    color: C.textTertiary,
    fontFamily: Fonts.medium,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  radioOuterSelected: {
    borderColor: C.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },
  })
}
