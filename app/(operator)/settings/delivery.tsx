import React, { useState, useEffect } from 'react'
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
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { supabase } from '@/lib/supabase'

const RADIUS_OPTIONS = [5, 10, 20, 50] as const
type RadiusOption = typeof RADIUS_OPTIONS[number]

export default function DeliverySettingsScreen() {
  const { operator } = useAuthStore()
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
          showToast({ message: 'Failed to load delivery settings', type: 'error' })
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
      showToast({ message: 'Zone already added', type: 'info' })
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
        showToast({ message: 'Delivery settings saved', type: 'success' })
        return
      }

      if (!operatorId) {
        showToast({ message: 'Operator ID missing', type: 'error' })
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
        showToast({ message: 'Failed to save delivery settings', type: 'error' })
        return
      }
      showToast({ message: 'Delivery settings saved', type: 'success' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader title="Delivery Settings" />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Delivery Settings" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Enable Toggle */}
        <Card style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Enable Delivery</Text>
              <Text style={styles.toggleSub}>
                Offer vehicle delivery to your customers
              </Text>
            </View>
            <Switch
              value={deliveryEnabled}
              onValueChange={setDeliveryEnabled}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
              accessibilityLabel="Enable delivery"
            />
          </View>
        </Card>

        {deliveryEnabled && (
          <>
            {/* Delivery Radius */}
            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>Delivery Radius</Text>
              <Text style={styles.sectionSub}>
                Maximum distance you will deliver to
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
              <Text style={styles.sectionLabel}>Delivery Fee (EUR)</Text>
              <Text style={styles.sectionSub}>
                Fee charged per delivery
              </Text>
              <View style={styles.feeRow}>
                <Text style={styles.feePrefix}>€</Text>
                <TextInput
                  style={styles.feeInput}
                  value={feeEur}
                  onChangeText={setFeeEur}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textTertiary}
                  accessibilityLabel="Delivery fee in EUR"
                />
              </View>
            </Card>

            {/* Delivery Zones */}
            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>Delivery Zones</Text>
              <Text style={styles.sectionSub}>
                Specific locations or areas you deliver to
              </Text>

              {/* Add zone input */}
              <View style={styles.addZoneRow}>
                <TextInput
                  style={styles.zoneInput}
                  value={newZone}
                  onChangeText={setNewZone}
                  placeholder="e.g. Marbella Airport"
                  placeholderTextColor={Colors.textTertiary}
                  accessibilityLabel="New delivery zone"
                  returnKeyType="done"
                  onSubmitEditing={handleAddZone}
                />
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={handleAddZone}
                  accessibilityLabel="Add delivery zone"
                  accessibilityRole="button"
                >
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* Zone list */}
              {zones.length === 0 ? (
                <Text style={styles.emptyZones}>No delivery zones added yet</Text>
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
          title={saving ? 'Saving...' : 'Save Settings'}
          onPress={() => void handleSave()}
          loading={saving}
          fullWidth
          style={styles.saveBtn}
          accessibilityLabel="Save delivery settings"
        />

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.text,
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusBtnActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  radiusBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  radiusBtnTextActive: {
    color: Colors.primary,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    minHeight: 44,
  },
  feePrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  feeInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  addZoneRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  zoneInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
    minHeight: 44,
  },
  addBtn: {
    backgroundColor: Colors.primary,
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
    color: Colors.textInverse,
  },
  emptyZones: {
    fontSize: 13,
    color: Colors.textTertiary,
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  zoneText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: '700',
  },
  saveBtn: {
    marginTop: Spacing.base,
  },
})
