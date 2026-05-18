import React, { useState, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Spacing, Radius } from '@/constants/colors'
import { Config } from '@/constants/config'
import { MOCK_CONVERSATIONS } from '@/lib/mockData'
import { supabase } from '@/lib/supabase'
import { useNotificationStore } from '@/lib/store/useNotificationStore'
import type { Conversation } from '@/types'
import { format } from 'date-fns'
import { useColors } from '@/lib/hooks/useColors'

function formatTime(iso: string): string {
  try {
    const date = new Date(iso)
    const diffMs = Date.now() - date.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffDays < 1) return format(date, 'HH:mm')
    if (diffDays < 7) return format(date, 'EEE')
    return format(date, 'MMM d')
  } catch { return '' }
}

export default function OperatorMessagesScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const { setOperatorUnreadCount } = useNotificationStore()

  const load = useCallback(async () => {
    if (Config.useMock) {
      setConversations([...MOCK_CONVERSATIONS])
      return
    }
    const { data } = await supabase
      .from('rentivo_conversations')
      .select('*, listing:rentivo_listings(*)')
      .order('last_message_at', { ascending: false })
    setConversations((data as Conversation[]) ?? [])
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    const total = conversations.reduce((sum, c) => sum + (c.unread_operator ?? 0), 0)
    setOperatorUnreadCount(total)
  }, [conversations, setOperatorUnreadCount])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const handlePress = (conv: Conversation) => {
    setConversations(prev =>
      prev.map(c => c.id === conv.id ? { ...c, unread_operator: 0 } : c)
    )
    router.push(`/(operator)/bookings/chat/${conv.booking_id}`)
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Messages" />
      <FlatList
        data={conversations}
        keyExtractor={c => c.id}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => handlePress(item)} activeOpacity={0.7} accessibilityLabel={`Message from ${item.guest_name ?? 'Guest'}${item.unread_operator > 0 ? `, ${item.unread_operator} unread` : ''}`} accessibilityRole="button">
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.guest_name ?? 'G')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.rowContent}>
              <View style={styles.rowTop}>
                <Text
                  style={[styles.guestName, item.unread_operator > 0 && styles.guestNameUnread]}
                  numberOfLines={1}
                >
                  {item.guest_name ?? 'Guest'}
                </Text>
                <Text style={styles.time}>{item.last_message_at ? formatTime(item.last_message_at) : ''}</Text>
              </View>
              <View style={styles.rowBottom}>
                <Text
                  style={[styles.lastMsg, item.unread_operator > 0 && styles.lastMsgUnread]}
                  numberOfLines={1}
                >
                  {item.listing?.title ? `${item.listing.title} · ` : ''}{item.last_message ?? ''}
                </Text>
                {item.unread_operator > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread_operator}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>Messages from guests will appear here</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  listContent: { paddingVertical: Spacing.sm, paddingBottom: 100 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 120, paddingHorizontal: Spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.base },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: Spacing.xs },
  emptySubtitle: { fontSize: 14, color: C.textSecondary, textAlign: 'center' },
  separator: { height: 1, backgroundColor: C.border, marginLeft: 72 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    gap: Spacing.base,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, color: C.primary, fontWeight: '700' },
  rowContent: { flex: 1, gap: 4 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guestName: { fontSize: 15, fontWeight: '600', color: C.text, flex: 1, marginRight: 8 },
  guestNameUnread: { fontWeight: '700' },
  time: { fontSize: 12, color: C.textTertiary },
  lastMsg: { fontSize: 14, color: C.textSecondary, flex: 1, marginRight: 8 },
  lastMsgUnread: { color: C.text, fontWeight: '500' },
  badge: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: C.textInverse },
  })
}
