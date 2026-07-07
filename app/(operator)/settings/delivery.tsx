import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'

const tr = t

const RADIUS_OPTIONS = [5, 10, 20, 50] as const
type RadiusOption = typeof RADIUS_OPTIONS[number]

export default function DeliverySettingsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { operator, language } = useAuthStore()
  const { showToast } = useToastStore()

  const operatorId = Config.useMock ? 'op-001' : (operator?.id ?? '')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [deliveryEnabled, setDeliveryEnabled] = useState(false)
  const [radiusKm, setRadiusKm] = useState<RadiusOption>(10)
  const [feeEur, setFeeEur] = useState('0')
  const [zones, setZones] = useState<string[]>([])
  const [newZone, setNewZone] = useState('')

  useEffect(() => {
    void loadSettings()
  }, [operatorId])

  const loadSettings = async () => {
    setLoading(true)
    try {
      if (Config.useMock) {
        setDeliveryEnabled(false)
        setRadiusKm(10)
        setFeeEur('0')
        setZones([])
      } else {
        if (!operatorId) return
        const { data, error } = await supabase
          .from('rentivo_operators')
          .select('delivery_enabled, delivery_radius_km, delivery_fee_eur, delivery_zones')
          .eq('id', operatorId)
          .maybeSingle()

        if (error) {
          showToast({ message: tr('opSetDeliveryLoadFailed', language), type: 'error' })
          return
        }
        if (data) {
          setDeliveryEnabled(data.delivery_enabled ?? false)
          const raw = data.delivery_radius_km ?? 10
          const valid = RADIUS_OPTIONS.includes(raw as RadiusOption) ? (raw as RadiusOption) : 10
          setRadiusKm(valid)
          setFeeEur(String(data.delivery_fee_eur ?? 0))
          setZones(data.delivery_zones ?? [])
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddZone = () => {
    const trimmed = newZone.trim()
    if (!trimmed) return
    if (zones.includes(trimmed)) {
      showToast({ message: tr('opSetZoneAlreadyAdded', language), type: 'info' })
      return
    }
    setZones(prev => [...prev, trimmed])
    setNewZone('')
  }

  const handleRemoveZone = (zone: string) => {
    setZones(prev => prev.filter(z => z !== zone))
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const parsedFee = parseFloat(feeEur)
      const fee = isNaN(parsedFee) ? 0 : Math.max(0, parsedFee)

      if (Config.useMock) {
        await new Promise<void>(r => setTimeout(r, 800))
        showToast({ message: tr('opSetDeliverySaved', language), type: 'success' })
        return
      }

      if (!operatorId) {
        showToast({ message: tr('opSetOperatorIdMissing', language), type: 'error' })
        return
      }

      const { error } = await supabase
        .from('rentivo_operators')
        .update({
          delivery_enabled: deliveryEnabled,
          delivery_radius_km: radiusKm,
          delivery_fee_eur: fee,
          delivery_zones: zones,
        })
        .eq('id', operatorId)

      if (error) {
        showToast({ message: tr('opSetDeliverySaveFailed', language), type: 'error' })
        return
      }
      showToast({ message: tr('opSetDeliverySaved', language), type: 'success' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader title={tr('opSetDeliverySettings', language)} />
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={tr('opSetDeliverySettings', language)} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Enable Toggle */}
        <Card style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>{tr('opSetEnableDelivery', language)}</Text>
              <Text style={styles.toggleSub}>
                {tr('opSetEnableDeliveryDesc', language)}
              </Text>
            </View>
            <Switch
              value={deliveryEnabled}
              onValueChange={setDeliveryEnabled}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor={C.white}
              accessibilityLabel={tr('opSetEnableDelivery', language)}
            />
          </View>
        </Card>

        {deliveryEnabled && (
          <>
            {/* Delivery Radius */}
            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>{tr('opSetDeliveryRadius', language)}</Text>
              <Text style={styles.sectionSub}>
                {tr('opSetDeliveryRadiusDesc', language)}
              </Text>
              <View style={styles.radiusRow}>
                {RADIUS_OPTIONS.map(km => (
                  <TouchableOpacity
                    key={km}
                    style={[styles.radiusBtn, radiusKm === km && styles.radiusBtnActive]}
                    onPress={() => setRadiusKm(km)}
                    accessibilityLabel={`${km} km delivery radius`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: radiusKm === km }}
                  >
                    <Text style={[styles.radiusBtnText, radiusKm === km && styles.radiusBtnTextActive]}>
                      {km} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            {/* Delivery Fee */}
            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>{tr('opSetDeliveryFee', language)}</Text>
              <Text style={styles.sectionSub}>
                {tr('opSetDeliveryFeeDesc', language)}
              </Text>
              <View style={styles.feeRow}>
                <Text style={styles.feePrefix}>€</Text>
                <TextInput
                  style={styles.feeInput}
                  value={feeEur}
                  onChangeText={setFeeEur}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={C.textTertiary}
                  accessibilityLabel={tr('opSetDeliveryFeeLabel', language)}
                />
              </View>
            </Card>

            {/* Delivery Zones */}
            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>{tr('opSetDeliveryZones', language)}</Text>
              <Text style={styles.sectionSub}>
                {tr('opSetDeliveryZonesDesc', language)}
              </Text>

              {/* Add zone input */}
              <View style={styles.addZoneRow}>
                <TextInput
                  style={styles.zoneInput}
                  value={newZone}
                  onChangeText={setNewZone}
                  placeholder="e.g. Marbella Airport"
                  placeholderTextColor={C.textTertiary}
                  accessibilityLabel={tr('opSetNewZone', language)}
                  returnKeyType="done"
                  onSubmitEditing={handleAddZone}
                />
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={handleAddZone}
                  accessibilityLabel={tr('opSetAddZone', language)}
                  accessibilityRole="button"
                >
                  <Text style={styles.addBtnText}>{tr('opSetAdd', language)}</Text>
                </TouchableOpacity>
              </View>

              {/* Zone list */}
              {zones.length === 0 ? (
                <Text style={styles.emptyZones}>{tr('opSetZonesEmpty', language)}</Text>
              ) : (
                <View style={styles.zoneList}>
                  {zones.map(zone => (
                    <View key={zone} style={styles.zoneItem}>
                      <Text style={styles.zoneText} numberOfLines={1}>{zone}</Text>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemoveZone(zone)}
                        accessibilityLabel={`Remove ${zone}`}
                        accessibilityRole="button"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}

        <Button
          title={saving ? tr('opSetSaving', language) : tr('opSetSaveSettings', language)}
          onPress={() => void handleSave()}
          loading={saving}
          fullWidth
          style={styles.saveBtn}
          accessibilityLabel={tr('opSetSaveSettings', language)}
        />

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: 100,
  },
  card: {
    marginBottom: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.base,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: Spacing.base,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  radiusBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusBtnActive: {
    backgroundColor: C.primarySurface,
    borderColor: C.primary,
  },
  radiusBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
  },
  radiusBtnTextActive: {
    color: C.primary,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: Spacing.base,
    minHeight: 44,
  },
  feePrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textSecondary,
    marginRight: Spacing.xs,
  },
  feeInput: {
    flex: 1,
    fontSize: 16,
    color: C.text,
    paddingVertical: Spacing.sm,
  },
  addZoneRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  zoneInput: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: C.text,
    minHeight: 44,
  },
  addBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 60,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textInverse,
  },
  emptyZones: {
    fontSize: 13,
    color: C.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.base,
  },
  zoneList: {
    gap: Spacing.sm,
  },
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  zoneText: {
    flex: 1,
    fontSize: 14,
    color: C.text,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: C.errorSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    fontSize: 12,
    color: C.error,
    fontWeight: '700',
  },
  saveBtn: {
    marginTop: Spacing.base,
  },
  })
}
