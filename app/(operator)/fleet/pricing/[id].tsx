import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { useListing } from '@/lib/hooks/useListing'
import { Config } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import type { DynamicPricingRules } from '@/lib/utils/pricing'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MULTIPLIERS = [1.0, 1.2, 1.3, 1.5, 2.0]

export default function PricingRulesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { listing } = useListing(id ?? '')
  const { showToast } = useToastStore()

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
        showToast({ message: 'Failed to save pricing rules', type: 'error' })
        setSaving(false)
        return
      }
    }

    showToast({ message: 'Pricing rules saved', type: 'success' })
    setSaving(false)
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Pricing Rules" />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Weekend Multiplier */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Weekend Multiplier</Text>
          <Text style={styles.sectionDesc}>Price on Sat/Sun vs weekday</Text>
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
              <Text style={styles.sectionTitle}>Peak Season</Text>
              <Text style={styles.sectionDesc}>Higher prices in peak months</Text>
            </View>
            <Switch
              value={peakEnabled}
              onValueChange={setPeakEnabled}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.text}
              accessibilityLabel="Enable peak season pricing"
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
              <Text style={[styles.sectionDesc, { marginTop: 8 }]}>Peak multiplier</Text>
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
          <Text style={styles.sectionTitle}>Long Stay Discounts</Text>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Weekly (7+ days)</Text>
            <TextInput
              style={styles.input}
              value={String(Math.round(weeklyDiscount * 100))}
              onChangeText={v => setWeeklyDiscount((parseFloat(v) || 0) / 100)}
              keyboardType="numeric"
              placeholder="10"
              placeholderTextColor={Colors.textTertiary}
              accessibilityLabel="Weekly discount percentage"
            />
            <Text style={styles.inputSuffix}>%</Text>
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Monthly (30+ days)</Text>
            <TextInput
              style={styles.input}
              value={String(Math.round(monthlyDiscount * 100))}
              onChangeText={v => setMonthlyDiscount((parseFloat(v) || 0) / 100)}
              keyboardType="numeric"
              placeholder="20"
              placeholderTextColor={Colors.textTertiary}
              accessibilityLabel="Monthly discount percentage"
            />
            <Text style={styles.inputSuffix}>%</Text>
          </View>
        </Card>

        {/* Preview */}
        {listing && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Preview</Text>
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
          title="Save Pricing Rules"
          onPress={() => void handleSave()}
          loading={saving}
          fullWidth
          style={{ marginTop: Spacing.base }}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 100 },
  section: { marginBottom: Spacing.base, padding: Spacing.base },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  sectionDesc: { color: Colors.textSecondary, fontSize: 13, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: Colors.background },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  inputLabel: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 70,
    textAlign: 'center',
    fontSize: 14,
    minHeight: 44,
  },
  inputSuffix: { color: Colors.textSecondary, fontSize: 14 },
  previewText: { color: Colors.text, fontSize: 14, marginBottom: 4 },
})
