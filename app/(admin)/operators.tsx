import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ListRenderItemInfo, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Badge } from '@/components/ui/Badge'
import { useToastStore } from '@/lib/store/useToastStore'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'

interface AdminOperator {
  id: string
  name: string
  city: string
  approved: boolean
  suspended: boolean
  tier: string
}

const MOCK_OPERATORS: AdminOperator[] = [
  { id: 'op-001', name: 'Marbella Rentals', city: 'Marbella', approved: true, suspended: false, tier: 'gold' },
  { id: 'op-002', name: 'Costa Cars', city: 'Málaga', approved: true, suspended: false, tier: 'silver' },
  { id: 'op-003', name: 'Test Operator', city: 'Madrid', approved: false, suspended: false, tier: 'bronze' },
]

export default function AdminOperatorsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [operators, setOperators] = useState<AdminOperator[]>(Config.useMock ? MOCK_OPERATORS : [])
  const [loadingList, setLoadingList] = useState(!Config.useMock)
  const { showToast } = useToastStore()

  useEffect(() => {
    if (Config.useMock) return
    const load = async () => {
      setLoadingList(true)
      try {
        const { data, error } = await supabase
          .from('rentivo_operators')
          .select('id, name, city, approved, suspended, tier')
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) { showToast({ message: 'Failed to load operators', type: 'error' }); return }
        setOperators(
          (data ?? []).map(o => ({
            id: o.id as string,
            name: (o.name as string | null) ?? 'Unknown',
            city: (o.city as string | null) ?? '',
            approved: (o.approved as boolean | null) ?? true,
            suspended: (o.suspended as boolean | null) ?? false,
            tier: (o.tier as string | null) ?? 'bronze',
          }))
        )
      } finally {
        setLoadingList(false)
      }
    }
    void load()
  }, [showToast])

  const approveOperator = useCallback(async (op: AdminOperator) => {
    if (!Config.useMock) {
      const { error } = await supabase
        .from('rentivo_operators')
        .update({ approved: true })
        .eq('id', op.id)
      if (error) {
        showToast({ message: 'Failed to approve', type: 'error' })
        return
      }
    }
    setOperators(prev => prev.map(o => o.id === op.id ? { ...o, approved: true } : o))
    showToast({ message: 'Operator approved', type: 'success' })
  }, [showToast])

  const toggleSuspend = useCallback(async (op: AdminOperator) => {
    if (!Config.useMock) {
      const { error } = await supabase
        .from('rentivo_operators')
        .update({ suspended: !op.suspended })
        .eq('id', op.id)
      if (error) {
        showToast({ message: 'Failed to update', type: 'error' })
        return
      }
    }
    setOperators((prev) =>
      prev.map((o) => (o.id === op.id ? { ...o, suspended: !o.suspended } : o))
    )
    showToast({
      message: op.suspended ? 'Operator unsuspended' : 'Operator suspended',
      type: 'success',
    })
  }, [showToast])

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<AdminOperator>) => (
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.city}>{item.city} · {item.tier}</Text>
          <View style={styles.badges}>
            <Badge
              label={item.approved ? 'Approved' : 'Pending'}
              variant={item.approved ? 'success' : 'warning'}
            />
            {item.suspended && <Badge label="Suspended" variant="error" />}
          </View>
        </View>
        <View style={styles.actions}>
          {!item.approved && (
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => void approveOperator(item)}
              accessibilityLabel="Approve operator"
              accessibilityRole="button"
            >
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, item.suspended && styles.actionBtnActive]}
            onPress={() => void toggleSuspend(item)}
            accessibilityLabel={item.suspended ? 'Unsuspend operator' : 'Suspend operator'}
            accessibilityRole="button"
          >
            <Text style={[styles.actionBtnText, item.suspended && styles.actionBtnTextActive]}>
              {item.suspended ? 'Unsuspend' : 'Suspend'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [toggleSuspend, approveOperator]
  )

  if (loadingList) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScreenHeader title="Operators" onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Operators" onBack={() => router.back()} />
      <FlatList
        data={operators}
        keyExtractor={(o) => o.id}
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
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },
  city: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: 6,
  },
  actions: {
    gap: Spacing.xs,
    alignItems: 'flex-end',
  },
  approveBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: C.success,
    minHeight: 36,
    justifyContent: 'center',
    backgroundColor: C.successSurface,
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.success,
  },
  actionBtn: {
    backgroundColor: C.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: C.error,
    minHeight: 36,
    justifyContent: 'center',
  },
  actionBtnActive: {
    borderColor: C.success,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.error,
  },
  actionBtnTextActive: {
    color: C.success,
  },
  })
}
