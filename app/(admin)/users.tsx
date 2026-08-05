import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ListRenderItemInfo, ActivityIndicator } from 'react-native'
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
  const C = useColors()
  const { language } = useAuthStore()
  const styles = useMemo(() => makeStyles(C), [C])
  const [users, setUsers] = useState<AdminUser[]>(Config.useMock ? MOCK_USERS : [])
  const [loadingList, setLoadingList] = useState(!Config.useMock)
  const { showToast } = useToastStore()

  useEffect(() => {
    if (Config.useMock) return
    const load = async () => {
      setLoadingList(true)
      try {
        const { data, error } = await supabase
          .from('rentivo_users')
          // `full_name` is not a column on rentivo_users; it is `name`.
          // PostgREST rejected the whole request with 42703, the catch below
          // showed a generic toast, and the admin user list has therefore
          // always been empty.
          .select('id, name, email, is_banned, created_at')
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) { showToast({ message: t('admFailLoadUsers', language), type: 'error' }); return }
        setUsers(
          (data ?? []).map(u => ({
            id: u.id as string,
            name: (u.name as string | null) ?? (u.email as string | null) ?? 'Unknown',
            email: (u.email as string | null) ?? '',
            is_banned: (u.is_banned as boolean | null) ?? false,
            created_at: u.created_at as string,
          }))
        )
      } finally {
        setLoadingList(false)
      }
    }
    void load()
  }, [showToast])

  const toggleBan = useCallback(async (u: AdminUser) => {
    if (!Config.useMock) {
      const { error } = await supabase
        .from('rentivo_users')
        .update({ is_banned: !u.is_banned })
        .eq('id', u.id)
      if (error) {
        showToast({ message: t('admFailUpdate', language), type: 'error' })
        return
      }
    }
    setUsers((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, is_banned: !x.is_banned } : x))
    )
    showToast({
      message: u.is_banned ? t('admUserUnbanned', language) : t('admUserBanned', language),
      type: 'success',
    })
  }, [showToast, language])

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<AdminUser>) => (
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.email}>{item.email}</Text>
          {item.is_banned && <Badge label={t('admBanned', language)} variant="error" />}
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, item.is_banned && styles.actionBtnUnban]}
          onPress={() => void toggleBan(item)}
          accessibilityLabel={item.is_banned ? t('admUnbanUser', language) : t('admBanUser', language)}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.actionBtnText, item.is_banned && styles.actionBtnTextUnban]}>
            {item.is_banned ? t('admUnban', language) : t('admBan', language)}
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [toggleBan, language]
  )

  if (loadingList) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScreenHeader title={t('admUsers', language)} onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('admUsers', language)} onBack={() => router.back()} />
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
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
    fontFamily: Fonts.bold,
    color: C.text,
  },
  email: {
    fontFamily: Fonts.regular, fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  actionBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: C.error,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnUnban: {
    borderColor: C.success,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semibold,
    color: C.error,
  },
  actionBtnTextUnban: {
    color: C.success,
  },
  })
}
