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

interface AdminUser {
  id: string
  name: string
  email: string
  is_banned: boolean
  created_at: string
}

const MOCK_USERS: AdminUser[] = [
  { id: 'u-001', name: 'Maria Garcia', email: 'maria@example.com', is_banned: false, created_at: '2026-01-15' },
  { id: 'u-002', name: 'James Wilson', email: 'james@example.com', is_banned: false, created_at: '2026-02-20' },
  { id: 'u-003', name: 'Test User', email: 'test@example.com', is_banned: true, created_at: '2026-03-01' },
]

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<AdminUser[]>(MOCK_USERS)
  const { showToast } = useToastStore()

  const toggleBan = useCallback(async (u: AdminUser) => {
    if (!Config.useMock) {
      const { error } = await supabase
        .from('rentivo_users')
        .update({ is_banned: !u.is_banned })
        .eq('id', u.id)
      if (error) {
        showToast({ message: 'Failed to update', type: 'error' })
        return
      }
    }
    setUsers((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, is_banned: !x.is_banned } : x))
    )
    showToast({
      message: u.is_banned ? 'User unbanned' : 'User banned',
      type: 'success',
    })
  }, [showToast])

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<AdminUser>) => (
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.email}>{item.email}</Text>
          {item.is_banned && <Badge label="Banned" variant="error" />}
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, item.is_banned && styles.actionBtnUnban]}
          onPress={() => void toggleBan(item)}
          accessibilityLabel={item.is_banned ? 'Unban user' : 'Ban user'}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.actionBtnText, item.is_banned && styles.actionBtnTextUnban]}>
            {item.is_banned ? 'Unban' : 'Ban'}
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [toggleBan]
  )

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Users" onBack={() => router.back()} />
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
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
  email: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.error,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnUnban: {
    borderColor: Colors.success,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
  },
  actionBtnTextUnban: {
    color: Colors.success,
  },
})
