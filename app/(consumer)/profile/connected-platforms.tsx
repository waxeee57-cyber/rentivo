import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { performICalSync } from '@/lib/ical'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'

// Wrapper to allow pending cpr keys before i18n.ts is updated
const cprT = (key: string, lang: 'en' | 'es' | 'hu'): string =>
  t(key as unknown as TranslationKey, lang)

interface Connection {
  id: string
  platform: string
  /** Neutral glyph for the platform *type* — the text label carries the brand. */
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  status: 'active' | 'error' | 'pending'
  lastSynced: string
  icalEnabled: boolean
  /** Feed the sync actually pulls. Null means there is nothing to sync. */
  icalUrl: string | null
}

const PLATFORM_META: Record<string, { icon: Connection['icon']; label: string }> = {
  airbnb: { icon: 'home-outline', label: 'Airbnb' },
  booking: { icon: 'business-outline', label: 'Booking.com' },
  vrbo: { icon: 'home-outline', label: 'VRBO' },
  turo: { icon: 'car-sport-outline', label: 'Turo' },
  holidu: { icon: 'home-outline', label: 'Holidu' },
  other: { icon: 'link-outline', label: 'Other' },
}

const MOCK_CONNECTIONS: Connection[] = Config.useMock ? [
  {
    id: 'conn-1',
    platform: 'airbnb',
    icon: 'home-outline',
    label: 'Airbnb',
    status: 'active',
    lastSynced: '2 hours ago',
    icalEnabled: true,
    icalUrl: 'https://www.airbnb.com/calendar/ical/mock.ics',
  },
  {
    id: 'conn-2',
    platform: 'booking',
    icon: 'business-outline',
    label: 'Booking.com',
    status: 'active',
    lastSynced: '4 hours ago',
    icalEnabled: true,
    icalUrl: 'https://admin.booking.com/ical/mock.ics',
  },
] : []

export default function ConnectedPlatformsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language } = useAuthStore()
  const STATUS_COLORS: Record<Connection['status'], string> = {
    active: C.success,
    error: C.error,
    pending: C.warning,
  }
  const [connections, setConnections] = useState<Connection[]>(MOCK_CONNECTIONS)
  const [syncing, setSyncing] = useState<string | null>(null)
  const { showToast } = useToastStore()

  const statusLabel = (s: Connection['status']): string => {
    if (s === 'active') return cprT('cprStatusSynced', language)
    if (s === 'error') return cprT('cprStatusSyncError', language)
    return cprT('cprStatusPending', language)
  }

  // In a live build the list was never loaded from anywhere, so the screen always
  // rendered "no platforms connected" no matter what the host had linked.
  const loadConnections = useCallback(async () => {
    if (Config.useMock) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const { data, error } = await supabase
      .from('rentivo_connected_platforms')
      .select('id, platform, ical_url, active, last_synced_at')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false })
    if (error || !data) return
    setConnections(data.map(row => {
      const meta = PLATFORM_META[row.platform as string] ?? PLATFORM_META.other
      return {
        id: row.id as string,
        platform: row.platform as string,
        icon: meta.icon,
        label: meta.label,
        status: 'active',
        lastSynced: (row.last_synced_at as string | null) ?? '—',
        icalEnabled: row.active !== false,
        icalUrl: (row.ical_url as string | null) ?? null,
      }
    }))
  }, [])

  useEffect(() => { void loadConnections() }, [loadConnections])

  const handleSync = async (id: string) => {
    const conn = connections.find(c => c.id === id)
    if (!conn) return
    setSyncing(id)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Was `setTimeout(1200)` + an unconditional success toast with no network call and
    // no mock gate: the user was told their Airbnb/Booking calendar had synced when
    // nothing had happened. performICalSync is the real path (and mock-aware itself).
    const result = await performICalSync({ ical_url: conn.icalUrl })

    if (!Config.useMock && result.error === null) {
      // Persist the timestamp so the next screen open shows the truth.
      await supabase
        .from('rentivo_connected_platforms')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', id)
    }

    setSyncing(null)
    if (result.error !== null) {
      showToast({ message: result.error, type: 'error' })
      setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'error' } : c))
      return
    }
    showToast({ message: cprT('cprICalSyncComplete', language), type: 'success' })
    setConnections(prev => prev.map(c =>
      c.id === id ? { ...c, lastSynced: 'just now', status: 'active' } : c
    ))
  }

  const handleToggleIcal = async (id: string, enabled: boolean) => {
    setConnections(prev => prev.map(c =>
      c.id === id ? { ...c, icalEnabled: enabled } : c
    ))
    // Persist too — a purely local toggle silently reverted on the next screen open.
    if (!Config.useMock) {
      await supabase
        .from('rentivo_connected_platforms')
        .update({ active: enabled })
        .eq('id', id)
    }
    showToast({
      message: enabled ? cprT('cprICalSyncEnabled', language) : cprT('cprICalSyncPaused', language),
      type: 'info',
    })
  }

  const handleAddConnection = () => {
    router.push('/(host)/listings/add-external' as Parameters<typeof router.push>[0])
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('connectedPlatforms', language)} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{cprT('cprConnectedPlatformsSubtitle', language)}</Text>

        {connections.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="link-outline" size={48} color={C.textTertiary} style={styles.emptyEmoji} importantForAccessibility="no" />
            <Text style={styles.emptyTitle}>{cprT('cprNoPlatformsConnected', language)}</Text>
            <Text style={styles.emptySubtitle}>{cprT('cprNoPlatformsDesc', language)}</Text>
          </View>
        ) : (
          connections.map(conn => (
            <Card key={conn.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name={conn.icon} size={28} color={C.textSecondary} importantForAccessibility="no" />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardLabel}>{conn.label}</Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[conn.status] }]} />
                    <Text style={[styles.statusText, { color: STATUS_COLORS[conn.status] }]}>
                      {statusLabel(conn.status)}
                    </Text>
                    <Text style={styles.lastSynced}> · {cprT('cprLastSynced', language)} {conn.lastSynced}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardRow}>
                <View style={styles.cardRowLeft}>
                  <View style={styles.cardRowLabelRow}>
                    <Ionicons name="sync-outline" size={15} color={C.text} importantForAccessibility="no" />
                    <Text style={styles.cardRowLabel}>{cprT('cprICalSync', language)}</Text>
                  </View>
                  <Text style={styles.cardRowSub}>{cprT('cprAutoSyncEvery4Hours', language)}</Text>
                </View>
                <Switch
                  value={conn.icalEnabled}
                  onValueChange={v => { void handleToggleIcal(conn.id, v) }}
                  trackColor={{ true: C.success, false: C.border }}
                  accessibilityLabel={cprT('cprICalSync', language)}
                />
              </View>

              <TouchableOpacity
                style={[styles.syncBtn, syncing === conn.id && styles.syncBtnDisabled]}
                onPress={() => { void handleSync(conn.id) }}
                disabled={syncing === conn.id}
                accessibilityRole="button"
                accessibilityLabel={cprT('cprSyncNow', language)}
              >
                <Text style={styles.syncBtnText}>
                  {syncing === conn.id ? cprT('cprSyncing', language) : cprT('cprSyncNow', language)}
                </Text>
              </TouchableOpacity>
            </Card>
          ))
        )}

        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleAddConnection}
          accessibilityRole="button"
          accessibilityLabel={cprT('cprAddPlatformConnection', language)}
        >
          <Text style={styles.addBtnText}>{cprT('cprAddPlatformConnection', language)}</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{t('opFleet2HowItWorks', language)}</Text>
          <Text style={styles.infoText}>{cprT('cprConnectedPlatformsHowItWorks', language)}</Text>
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
    fontFamily: Fonts.regular, fontSize: 14,
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
  emptyEmoji: { marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: C.text, marginBottom: Spacing.sm },
  emptySubtitle: {
    fontFamily: Fonts.regular, fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 20,
  },

  card: { marginBottom: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 17, fontFamily: Fonts.bold, color: C.text, marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: Fonts.bold },
  lastSynced: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary },

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
  cardRowLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardRowLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: C.text },
  cardRowSub: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary },

  syncBtn: {
    backgroundColor: C.primarySurface,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.primary,
    minHeight: 44,
    justifyContent: 'center',
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: C.primaryDark },

  addBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.primary,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    minHeight: 44,
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: C.primary },

  infoBox: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: C.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  infoText: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, lineHeight: 24 },
  })
}
