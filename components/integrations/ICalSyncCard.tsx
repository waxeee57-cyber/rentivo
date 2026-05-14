import React, { useState, useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { formatDistanceToNow } from 'date-fns'
import { Colors, Spacing, Radius } from '@/constants/colors'

interface ICalSyncCardProps {
  url: string
  onBlockedDatesChange?: (dates: string[]) => void
  autoSync?: boolean
}

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export function ICalSyncCard({ url, onBlockedDatesChange, autoSync = true }: ICalSyncCardProps) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [blockedCount, setBlockedCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const doSync = useCallback(async () => {
    if (status === 'syncing') return
    setStatus('syncing')
    setErrorMsg(null)
    try {
      await new Promise<void>(r => setTimeout(r, 1200))
      // Mock: parse and return blocked date strings
      const mockBlocked = [
        '2026-05-20', '2026-05-21', '2026-05-22',
        '2026-05-28', '2026-05-29', '2026-05-30',
        '2026-06-05', '2026-06-06',
      ]
      setBlockedCount(mockBlocked.length)
      setLastSynced(new Date())
      setStatus('success')
      onBlockedDatesChange?.(mockBlocked)
    } catch {
      setErrorMsg('Could not reach iCal URL')
      setStatus('error')
    }
  }, [status, url, onBlockedDatesChange])

  useEffect(() => {
    if (autoSync && url) void doSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusLabel = () => {
    if (status === 'syncing') return 'Syncing...'
    if (status === 'success' && lastSynced)
      return `✓ Synced ${formatDistanceToNow(lastSynced, { addSuffix: true })} · ${blockedCount} dates blocked`
    if (status === 'error') return `✕ ${errorMsg ?? 'Sync failed'}`
    return '📅 Tap to sync'
  }

  const statusColor = () => {
    if (status === 'success') return Colors.success
    if (status === 'error') return Colors.error
    return Colors.textSecondary
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>📅</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>iCal Sync</Text>
          <Text style={styles.url} numberOfLines={1}>{url}</Text>
          <Text style={[styles.statusText, { color: statusColor() }]}>
            {statusLabel()}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.syncBtn, status === 'syncing' && styles.syncBtnDisabled]}
          onPress={() => void doSync()}
          disabled={status === 'syncing'}
          accessibilityLabel="Sync iCal"
          accessibilityRole="button"
        >
          {status === 'syncing' ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={[styles.syncText, status === 'error' && { color: Colors.error }]}>
              {status === 'error' ? 'Retry' : 'Sync'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text },
  url: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  statusText: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  syncBtn: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    minWidth: 58,
    alignItems: 'center',
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncText: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
})
