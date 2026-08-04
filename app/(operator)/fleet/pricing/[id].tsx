import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { useListing } from '@/lib/hooks/useListing'
import { Config } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import type { DynamicPricingRules } from '@/lib/utils/pricing'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MULTIPLIERS = [1.0, 1.2, 1.3, 1.5, 2.0]

export default function PricingRulesScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { id } = useLocalSearchParams<{ id: string }>()
  const { listing } = useListing(id ?? '')
  const { showToast } = useToastStore()
  const { language } = useAuthStore()

  const [weekendMultiplier, setWeekendMultiplier] = useState(1.3)
  const [peakEnabled, setPeakEnabled] = useState(false)
  const [peakMonths, setPeakMonths] = useState<number[]>([7, 8])
  const [peakMultiplier, setPeakMultiplier] = useState(1.5)
  const [weeklyDiscount, setWeeklyDiscount] = useState(0.1)
  const [monthlyDiscount, setMonthlyDiscount] = useState(0.2)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (listing?.pricing_rules) {
      const r = listing.pricing_rules
      setWeekendMultiplier(r.weekend_multiplier ?? 1.3)
      setPeakEnabled((r.peak_months?.length ?? 0) > 0)
      setPeakMonths(r.peak_months ?? [7, 8])
      setPeakMultiplier(r.peak_multiplier ?? 1.5)
      setWeeklyDiscount(r.weekly_discount ?? 0.1)
      setMonthlyDiscount(r.monthly_discount ?? 0.2)
    }
  }, [listing])

  const handleSave = async () => {
    setSaving(true)
    const rules: DynamicPricingRules = {
      weekend_multiplier: weekendMultiplier,
      peak_months: peakEnabled ? peakMonths : [],
      peak_multiplier: peakMultiplier,
      weekly_discount: weeklyDiscount,
      monthly_discount: monthlyDiscount,
    }

    if (!Config.useMock) {
      const { error } = await supabase
        .from('rentivo_listings')
        .update({ pricing_rules: rules })
        .eq('id', id ?? '')
      if (error) {
        showToast({ message: t('opFleet2SaveError', language), type: 'error' })
        setSaving(false)
        return
      }
    }

    showToast({ message: t('opFleet2SaveSuccess', language), type: 'success' })
    setSaving(false)
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={t('opFleet2PricingRulesTitle', language)} />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Weekend Multiplier */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('opFleet2WeekendMultiplier', language)}</Text>
          <Text style={styles.sectionDesc}>{t('opFleet2WeekendMultiplierDesc', language)}</Text>
          <View style={styles.row}>
            {MULTIPLIERS.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, weekendMultiplier === m && styles.chipActive]}
                onPress={() => setWeekendMultiplier(m)}
                accessibilityLabel={`Weekend multiplier ${m}x`}
                accessibilityRole="radio"
                accessibilityState={{ selected: weekendMultiplier === m }}
              >
                <Text style={[styles.chipText, weekendMultiplier === m && styles.chipTextActive]}>
                  {m}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Peak Season */}
        <Card style={styles.section}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.sectionTitle}>{t('opFleet2PeakSeason', language)}</Text>
              <Text style={styles.sectionDesc}>{t('opFleet2PeakSeasonDesc', language)}</Text>
            </View>
            <Switch
              value={peakEnabled}
              onValueChange={setPeakEnabled}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor={C.text}
              accessibilityLabel={t('opFleet2EnablePeakSeason', language)}
            />
          </View>
          {peakEnabled && (
            <>
              <View style={[styles.row, { marginTop: 12, flexWrap: 'wrap' }]}>
                {MONTHS.map((m, i) => {
                  const monthNum = i + 1
                  const selected = peakMonths.includes(monthNum)
                  return (
                    <TouchableOpacity
                      key={monthNum}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => {
                        setPeakMonths(prev =>
                          selected ? prev.filter(x => x !== monthNum) : [...prev, monthNum]
                        )
                      }}
                      accessibilityLabel={`Toggle peak month ${m}`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <Text style={[styles.sectionDesc, { marginTop: 8 }]}>{t('opFleet2PeakMultiplier', language)}</Text>
              <View style={styles.row}>
                {MULTIPLIERS.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, peakMultiplier === m && styles.chipActive]}
                    onPress={() => setPeakMultiplier(m)}
                    accessibilityLabel={`Peak multiplier ${m}x`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: peakMultiplier === m }}
                  >
                    <Text style={[styles.chipText, peakMultiplier === m && styles.chipTextActive]}>
                      {m}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </Card>

        {/* Long Stay Discounts */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('opFleet2LongStayDiscounts', language)}</Text>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>{t('opFleet2WeeklyDiscount', language)}</Text>
            <TextInput
              style={styles.input}
              value={String(Math.round(weeklyDiscount * 100))}
              onChangeText={v => setWeeklyDiscount((parseFloat(v) || 0) / 100)}
              keyboardType="numeric"
              placeholder="10"
              placeholderTextColor={C.textTertiary}
              accessibilityLabel={t('opFleet2WeeklyDiscountA11y', language)}
            />
            <Text style={styles.inputSuffix}>%</Text>
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>{t('opFleet2MonthlyDiscount', language)}</Text>
            <TextInput
              style={styles.input}
              value={String(Math.round(monthlyDiscount * 100))}
              onChangeText={v => setMonthlyDiscount((parseFloat(v) || 0) / 100)}
              keyboardType="numeric"
              placeholder="20"
              placeholderTextColor={C.textTertiary}
              accessibilityLabel={t('opFleet2MonthlyDiscountA11y', language)}
            />
            <Text style={styles.inputSuffix}>%</Text>
          </View>
        </Card>

        {/* Preview */}
        {listing && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{t('opFleet2Preview', language)}</Text>
            <Text style={styles.previewText}>
              Base: {listing.price_per_day} EUR/day
            </Text>
            <Text style={styles.previewText}>
              Weekend: {Math.round(listing.price_per_day * weekendMultiplier)} EUR/day
            </Text>
            {peakEnabled && (
              <Text style={styles.previewText}>
                Peak: {Math.round(listing.price_per_day * peakMultiplier)} EUR/day
              </Text>
            )}
          </Card>
        )}

        <Button
          title={t('opFleet2SaveRules', language)}
          onPress={() => void handleSave()}
          loading={saving}
          fullWidth
          style={{ marginTop: Spacing.base }}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: Spacing.base, paddingBottom: 100 },
  section: { marginBottom: Spacing.base, padding: Spacing.base },
  sectionTitle: { color: C.text, fontSize: 16, fontFamily: Fonts.semibold, marginBottom: 4 },
  sectionDesc: { color: C.textSecondary, fontFamily: Fonts.regular, fontSize: 13, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.textSecondary, fontSize: 13, fontFamily: Fonts.semibold },
  chipTextActive: { color: C.background },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  inputLabel: { color: C.textSecondary, fontFamily: Fonts.regular, fontSize: 14, flex: 1 },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.sm,
    color: C.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 70,
    textAlign: 'center',
    fontFamily: Fonts.regular, fontSize: 14,
    minHeight: 44,
  },
  inputSuffix: { color: C.textSecondary, fontFamily: Fonts.regular, fontSize: 14 },
  previewText: { color: C.text, fontFamily: Fonts.regular, fontSize: 14, marginBottom: 4 },
  })
}
