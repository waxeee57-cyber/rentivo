import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Divider } from '@/components/ui/Divider'
import { useToastStore } from '@/lib/store/useToastStore'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'

const tr = t

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

interface Webhook {
  id: string
  url: string
  events: string[]
  is_active: boolean
  failure_count: number
  last_triggered_at: string | null
}

const MOCK_API_KEYS: ApiKey[] = [
  {
    id: 'k-001',
    name: 'Production Key',
    key_prefix: 'rnt_live_abc1',
    is_active: true,
    last_used_at: '2026-05-15',
    created_at: '2026-01-01',
  },
]

const MOCK_WEBHOOKS: Webhook[] = [
  {
    id: 'wh-001',
    url: 'https://example.com/webhooks/rentivo',
    events: ['booking.confirmed', 'booking.cancelled'],
    is_active: true,
    failure_count: 0,
    last_triggered_at: '2026-05-14',
  },
]

const WEBHOOK_EVENTS = [
  'booking.confirmed',
  'booking.cancelled',
  'booking.completed',
  'booking.created',
  '*',
]

export default function ApiSettingsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { operator, language } = useAuthStore()
  const { showToast } = useToastStore()
  // Seeded with MOCK_* unconditionally before — a shipped build opened this screen
  // showing a fake `rnt_live_abc1` key, and a failed query left it there for good.
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(Config.useMock ? MOCK_API_KEYS : [])
  const [webhooks, setWebhooks] = useState<Webhook[]>(Config.useMock ? MOCK_WEBHOOKS : [])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['booking.confirmed'])
  const [addingWebhook, setAddingWebhook] = useState(false)
  const [showAddWebhook, setShowAddWebhook] = useState(false)

  const loadData = useCallback(async () => {
    if (!operator?.id) return
    const [keysRes, hooksRes] = await Promise.all([
      supabase.from('rentivo_api_keys').select('*').eq('operator_id', operator.id),
      supabase.from('rentivo_webhooks').select('*').eq('operator_id', operator.id),
    ])
    // A failed query must say so rather than leave whatever was on screen; credentials
    // silently showing stale/absent data is how people revoke or trust the wrong key.
    const failure = keysRes.error ?? hooksRes.error
    setLoadError(failure ? failure.message : null)
    if (keysRes.data) setApiKeys(keysRes.data as ApiKey[])
    if (hooksRes.data) setWebhooks(hooksRes.data as Webhook[])
  }, [operator?.id])

  useEffect(() => {
    if (!Config.useMock && operator?.id) {
      void loadData()
    }
  }, [operator?.id, loadData])

  const revokeKey = (keyId: string) => {
    Alert.alert(tr('opSetRevokeApiKey', language), tr('opSetCannotBeUndone', language), [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: tr('opSetRevoke', language),
        style: 'destructive',
        onPress: async () => {
          if (!Config.useMock) {
            // supabase-js reports NO error on a 0-row update (RLS/stale id), so a
            // failed revoke used to still show "revoked" while the key stayed live.
            const { data, error } = await supabase
              .from('rentivo_api_keys')
              .update({ is_active: false })
              .eq('id', keyId)
              .select('id')
            if (error || !data || data.length === 0) {
              showToast({ message: tr('opSetActionFailed', language), type: 'error' })
              return
            }
          }
          setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, is_active: false } : k))
          showToast({ message: tr('opSetApiKeyRevoked', language), type: 'success' })
        },
      },
    ])
  }

  const addWebhook = async () => {
    if (!newWebhookUrl.trim().startsWith('https://')) {
      showToast({ message: tr('opSetUrlHttpsRequired', language), type: 'error' })
      return
    }
    setAddingWebhook(true)
    try {
      if (!Config.useMock && operator?.id) {
        const { error } = await supabase.from('rentivo_webhooks').insert({
          operator_id: operator.id,
          url: newWebhookUrl.trim(),
          events: selectedEvents,
        })
        if (error) throw error
        await loadData()
      } else {
        const newHook: Webhook = {
          id: `wh-${Date.now()}`,
          url: newWebhookUrl.trim(),
          events: selectedEvents,
          is_active: true,
          failure_count: 0,
          last_triggered_at: null,
        }
        setWebhooks(prev => [...prev, newHook])
      }
      setNewWebhookUrl('')
      setShowAddWebhook(false)
      showToast({ message: tr('opSetWebhookAdded', language), type: 'success' })
    } catch {
      showToast({ message: tr('opSetWebhookAddFailed', language), type: 'error' })
    } finally {
      setAddingWebhook(false)
    }
  }

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={tr('opSetApiWebhooks', language)} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>

        {loadError !== null && (
          <Card style={styles.card}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Button
              title={t('tryAgain', language)}
              variant="secondary"
              onPress={() => { void loadData() }}
            />
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{tr('opSetApiKeysTitle', language)}</Text>
          {apiKeys.map(key => (
            <View key={key.id}>
              <View style={styles.keyRow}>
                <View style={styles.keyInfo}>
                  <Text style={styles.keyName}>{key.name}</Text>
                  <Text style={styles.keyPrefix}>{key.key_prefix}...</Text>
                  {key.last_used_at !== null && (
                    <Text style={styles.meta}>Last used: {key.last_used_at}</Text>
                  )}
                </View>
                <View style={styles.keyActions}>
                  <Badge
                    label={key.is_active ? t('active', language) : tr('opSetRevoked', language)}
                    variant={key.is_active ? 'success' : 'neutral'}
                  />
                  {key.is_active && (
                    <TouchableOpacity
                      onPress={() => revokeKey(key.id)}
                      style={styles.revokeBtn}
                      accessibilityLabel={tr('opSetRevokeKey', language)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.revokeBtnText}>{tr('opSetRevoke', language)}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Divider />
            </View>
          ))}
          <Text style={styles.infoText}>{tr('opSetContactSupportInfo', language)}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{tr('opSetWebhooksTitle', language)}</Text>
          {webhooks.map(hook => (
            <View key={hook.id} style={styles.webhookRow}>
              <Text style={styles.webhookUrl} numberOfLines={1}>{hook.url}</Text>
              <Text style={styles.webhookEvents}>{hook.events.join(', ')}</Text>
              <View style={styles.webhookMeta}>
                <Badge
                  label={hook.is_active ? t('active', language) : tr('opSetInactive', language)}
                  variant={hook.is_active ? 'success' : 'neutral'}
                />
                {hook.failure_count > 0 && (
                  <Text style={styles.failCount}>{hook.failure_count} failures</Text>
                )}
              </View>
            </View>
          ))}

          {showAddWebhook ? (
            <View style={styles.addWebhook}>
              <TextInput
                style={styles.urlInput}
                value={newWebhookUrl}
                onChangeText={setNewWebhookUrl}
                placeholder="https://your-server.com/webhook"
                placeholderTextColor={C.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={styles.eventsLabel}>{tr('opSetEvents', language)}</Text>
              <View style={styles.eventsRow}>
                {WEBHOOK_EVENTS.map(ev => (
                  <TouchableOpacity
                    key={ev}
                    style={[styles.eventChip, selectedEvents.includes(ev) && styles.eventChipActive]}
                    onPress={() => toggleEvent(ev)}
                    accessibilityLabel={ev}
                    accessibilityRole="checkbox"
                  >
                    <Text style={[styles.eventChipText, selectedEvents.includes(ev) && styles.eventChipTextActive]}>
                      {ev}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.addBtns}>
                <Button title={t('cancel', language)} onPress={() => setShowAddWebhook(false)} variant="secondary" />
                <Button
                  title={addingWebhook ? tr('opSetAdding', language) : tr('opSetAddWebhook', language)}
                  onPress={() => void addWebhook()}
                  loading={addingWebhook}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addWebhookBtn}
              onPress={() => setShowAddWebhook(true)}
              accessibilityLabel={tr('opSetAddWebhook', language)}
              accessibilityRole="button"
            >
              <Text style={styles.addWebhookBtnText}>+ {tr('opSetAddWebhook', language)}</Text>
            </TouchableOpacity>
          )}
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: Spacing.base, gap: Spacing.md },
  card: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  keyInfo: { flex: 1 },
  keyName: { fontSize: 14, fontFamily: Fonts.bold, color: C.text },
  keyPrefix: { fontSize: 13, color: C.primary, fontFamily: 'monospace', marginTop: 2 },
  meta: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  keyActions: { alignItems: 'flex-end', gap: Spacing.xs },
  revokeBtn: {
    borderWidth: 1,
    borderColor: C.error,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    minHeight: 28,
    justifyContent: 'center',
  },
  revokeBtnText: { fontSize: 12, color: C.error, fontFamily: Fonts.semibold },
  infoText: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary, fontStyle: 'italic' },
  errorText: { fontFamily: Fonts.regular, fontSize: 14, color: C.error, lineHeight: 20 },
  webhookRow: {
    paddingVertical: Spacing.sm,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  webhookUrl: { fontSize: 13, color: C.text, fontFamily: Fonts.semibold },
  webhookEvents: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary },
  webhookMeta: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: 4 },
  failCount: { fontFamily: Fonts.regular, fontSize: 12, color: C.error },
  addWebhook: { marginTop: Spacing.md, gap: Spacing.sm },
  urlInput: {
    backgroundColor: C.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: C.text,
    fontFamily: Fonts.regular, fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
  },
  eventsLabel: { fontSize: 13, color: C.text, fontFamily: Fonts.semibold },
  eventsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  eventChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 28,
    justifyContent: 'center',
  },
  eventChipActive: { backgroundColor: C.primarySurface, borderColor: C.primary },
  eventChipText: { fontFamily: Fonts.regular, fontSize: 11, color: C.textSecondary },
  eventChipTextActive: { color: C.primaryDark },
  addBtns: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  addWebhookBtn: {
    padding: Spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addWebhookBtnText: { fontSize: 14, color: C.primary, fontFamily: Fonts.semibold },
  })
}
