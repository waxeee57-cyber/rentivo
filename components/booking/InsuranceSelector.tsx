import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { INSURANCE_PACKAGES } from '@/types'
import type { InsuranceId } from '@/types'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'

interface InsuranceSelectorProps {
  selected: InsuranceId
  onSelect: (id: InsuranceId) => void
  language: 'en' | 'es' | 'hu'
}

export function InsuranceSelector({ selected, onSelect, language }: InsuranceSelectorProps) {
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

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.base,
    marginTop: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
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
    backgroundColor: Colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
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
    fontWeight: '700',
    color: Colors.text,
  },
  nameSelected: {
    color: Colors.primary,
  },
  recommendedBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textInverse,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  desc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  priceBlock: {
    alignItems: 'flex-end',
    minWidth: 52,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  priceSelected: {
    color: Colors.primary,
  },
  priceFree: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.success,
  },
  priceUnit: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
})
