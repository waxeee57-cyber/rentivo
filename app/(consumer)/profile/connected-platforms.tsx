import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'

interface Connection {
  id: string
  platform: string
  emoji: string
  label: string
  status: 'active' | 'error' | 'pending'
  lastSynced: string
  icalEnabled: boolean
}

const MOCK_CONNECTIONS: Connection[] = Config.useMock ? [
  {
    id: 'conn-1',
    platform: 'airbnb',
    emoji: '🏠',
    label: 'Airbnb',
    status: 'active',
    lastSynced: '2 hours ago',
    icalEnabled: true,
  },
  {
    id: 'conn-2',
    platform: 'booking',
    emoji: '🏨',
    label: 'Booking.com',
    status: 'active',
    lastSynced: '4 hours ago',
    icalEnabled: true,
  },
] : []

const STATUS_LABELS: Record<Connection['status'], string> = {
  active: 'Synced',
  error: 'Sync error',
  pending: 'Pending',
}

export default function ConnectedPlatformsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const STATUS_COLORS: Record<Connection['status'], string> = {
    active: C.success,
    error: C.error,
    pending: C.warning,
  }
  const [connections, setConnections] = useState<Connection[]>(MOCK_CONNECTIONS)
  const [syncing, setSyncing] = useState<string | null>(null)
  const { showToast } = useToastStore()

  const handleSync = async (id: string) => {
    setSyncing(id)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await new Promise(r => setTimeout(r, 1200))
    setSyncing(null)
    showToast({ message: 'iCal sync complete ✓', type: 'success' })
    setConnections(prev => prev.map(c =>
      c.id === id ? { ...c, lastSynced: 'just now', status: 'active' } : c
    ))
  }

  const handleToggleIcal = (id: string, enabled: boolean) => {
    setConnections(prev => prev.map(c =>
      c.id === id ? { ...c, icalEnabled: enabled } : c
    ))
    showToast({ message: enabled ? 'iCal sync enabled' : 'iCal sync paused', type: 'info' })
  }

  const handleAddConnection = () => {
    router.push('/(host)/listings/add-external' as Parameters<typeof router.push>[0])
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Connected Platforms" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Connect your listings from Airbnb, Booking.com, VRBO and more.
          Your availability syncs automatically — no double bookings.
        </Text>

        {connections.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔗</Text>
            <Text style={styles.emptyTitle}>No platforms connected</Text>
            <Text style={styles.emptySubtitle}>
              Connect your external listings to sync availability automatically.
            </Text>
          </View>
        ) : (
          connections.map(conn => (
            <Card key={conn.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmoji}>{conn.emoji}</Text>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardLabel}>{conn.label}</Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[conn.status] }]} />
                    <Text style={[styles.statusText, { color: STATUS_COLORS[conn.status] }]}>
                      {STATUS_LABELS[conn.status]}
                    </Text>
                    <Text style={styles.lastSynced}> · Last synced: {conn.lastSynced}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardRow}>
                <View style={styles.cardRowLeft}>
                  <Text style={styles.cardRowLabel}>🔄 iCal sync</Text>
                  <Text style={styles.cardRowSub}>Auto-sync every 4 hours</Text>
                </View>
                <Switch
                  value={conn.icalEnabled}
                  onValueChange={v => handleToggleIcal(conn.id, v)}
                  trackColor={{ true: C.success, false: C.border }}
                />
              </View>

              <TouchableOpacity
                style={[styles.syncBtn, syncing === conn.id && styles.syncBtnDisabled]}
                onPress={() => { void handleSync(conn.id) }}
                disabled={syncing === conn.id}
              >
                <Text style={styles.syncBtnText}>
                  {syncing === conn.id ? 'Syncing...' : '⟳ Sync now'}
                </Text>
              </TouchableOpacity>
            </Card>
          ))
        )}

        <TouchableOpacity style={styles.addBtn} onPress={handleAddConnection}>
          <Text style={styles.addBtnText}>+ Add a platform connection</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            {'✓  Your listing appears on Rentivo\n'}
            {'✓  Guests are directed to book on the original platform\n'}
            {'✓  iCal keeps your calendars in sync automatically\n'}
            {'✓  Rentivo earns a commission on bookings made through the link'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  subtitle: {
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    backgroundColor: C.surface,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.xl,
  },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: Spacing.sm },
  emptySubtitle: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 20,
  },

  card: { marginBottom: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  cardEmoji: { fontSize: 32 },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  lastSynced: { fontSize: 12, color: C.textTertiary },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginBottom: Spacing.md,
  },
  cardRowLeft: { flex: 1 },
  cardRowLabel: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  cardRowSub: { fontSize: 12, color: C.textSecondary },

  syncBtn: {
    backgroundColor: C.primarySurface,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.primary,
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { fontSize: 14, fontWeight: '700', color: C.primaryDark },

  addBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.primary,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: C.primary },

  infoBox: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  infoText: { fontSize: 13, color: C.textSecondary, lineHeight: 24 },
  })
}
