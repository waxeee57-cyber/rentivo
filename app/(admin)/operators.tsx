import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ListRenderItemInfo } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Badge } from '@/components/ui/Badge'
import { useToastStore } from '@/lib/store/useToastStore'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'

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
  const [operators, setOperators] = useState<AdminOperator[]>(MOCK_OPERATORS)
  const { showToast } = useToastStore()

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
        <TouchableOpacity
          style={[styles.actionBtn, item.suspended && styles.actionBtnActive]}
          onPress={() => void toggleSuspend(item)}
          accessibilityLabel={item.suspended ? 'Unsuspend operator' : 'Suspend operator'}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.actionBtnText}>
            {item.suspended ? 'Unsuspend' : 'Suspend'}
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [toggleSuspend]
  )

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  row: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  city: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: 6,
  },
  actionBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.error,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnActive: {
    borderColor: Colors.success,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
  },
})
