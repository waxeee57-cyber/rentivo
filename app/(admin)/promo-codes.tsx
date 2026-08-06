import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ListRenderItemInfo } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Badge } from '@/components/ui/Badge'
import { useToastStore } from '@/lib/store/useToastStore'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'

interface PromoCodeAdmin {
  id: string
  code: string
  discount_value: number
  is_active: boolean
  current_uses: number
  max_uses: number | null
}

const MOCK_PROMOS: PromoCodeAdmin[] = [
  { id: 'p-001', code: 'WELCOME10', discount_value: 10, is_active: true, current_uses: 42, max_uses: null },
  { id: 'p-002', code: 'MARBELLA20', discount_value: 20, is_active: true, current_uses: 18, max_uses: 100 },
  { id: 'p-003', code: 'SUMMER50', discount_value: 50, is_active: false, current_uses: 5, max_uses: 50 },
]

export default function AdminPromoCodesScreen() {
  const C = useColors()
  const { language } = useAuthStore()
  const styles = useMemo(() => makeStyles(C), [C])
  const [promos, setPromos] = useState<PromoCodeAdmin[]>(Config.useMock ? MOCK_PROMOS : [])
  const { showToast } = useToastStore()

  useEffect(() => {
    if (Config.useMock) return
    const load = async () => {
      // The error was discarded here, so a failed load was indistinguishable
      // from a platform with no promo codes: the list simply rendered empty.
      const { data, error } = await supabase
        .from('rentivo_promo_codes')
        .select('id, code, discount_value, is_active, current_uses, max_uses')
      if (error) {
        showToast({ message: t('admFailUpdate', language), type: 'error' })
        return
      }
      setPromos((data ?? []) as PromoCodeAdmin[])
    }
    void load()
  }, [showToast, language])

  const toggleActive = useCallback(async (p: PromoCodeAdmin) => {
    if (!Config.useMock) {
      // See users.tsx: a refused UPDATE matches zero rows and reports no error.
      // Deactivating a code that stays live is the difference between a campaign
      // that stopped costing money and one that did not.
      const { data, error } = await supabase
        .from('rentivo_promo_codes')
        .update({ is_active: !p.is_active })
        .eq('id', p.id)
        .select('id, is_active')
      if (error || (data ?? []).length === 0) {
        showToast({ message: t('admFailUpdate', language), type: 'error' })
        return
      }
    }
    setPromos((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x))
    )
    showToast({
      message: p.is_active ? t('admPromoDeactivated', language) : t('admPromoActivated', language),
      type: 'success',
    })
  }, [showToast, language])

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PromoCodeAdmin>) => (
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={styles.detail}>
            {item.discount_value}% off · {item.current_uses} uses
            {item.max_uses != null ? ` / ${item.max_uses}` : ''}
          </Text>
          <Badge
            label={item.is_active ? t('active', language) : t('admInactive', language)}
            variant={item.is_active ? 'success' : 'neutral'}
          />
        </View>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => void toggleActive(item)}
          accessibilityLabel={item.is_active ? t('admDeactivatePromo', language) : t('admActivatePromo', language)}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.actionBtnText}>
            {item.is_active ? t('admDeactivate', language) : t('admActivate', language)}
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [toggleActive, language]
  )

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('admPromoCodes', language)} onBack={() => router.back()} />
      <FlatList
        data={promos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
      />
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  list: {
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  row: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
  },
  info: {
    flex: 1,
  },
  code: {
    fontSize: 16,
    fontFamily: Fonts.extrabold,
    color: C.primary,
    letterSpacing: 1,
  },
  detail: {
    fontFamily: Fonts.regular, fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  actionBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: C.primary,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semibold,
    color: C.primary,
  },
  })
}
