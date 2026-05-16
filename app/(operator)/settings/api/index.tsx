import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Divider } from '@/components/ui/Divider'
import { useToastStore } from '@/lib/store/useToastStore'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'

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
  const { operator } = useAuthStore()
  const { showToast } = useToastStore()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(MOCK_API_KEYS)
  const [webhooks, setWebhooks] = useState<Webhook[]>(MOCK_WEBHOOKS)
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
    if (keysRes.data) setApiKeys(keysRes.data as ApiKey[])
    if (hooksRes.data) setWebhooks(hooksRes.data as Webhook[])
  }, [operator?.id])

  useEffect(() => {
    if (!Config.useMock && operator?.id) {
      void loadData()
    }
  }, [operator?.id, loadData])

  const revokeKey = (keyId: string) => {
    Alert.alert('Revoke API Key', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          if (!Config.useMock) {
            await supabase
              .from('rentivo_api_keys')
              .update({ is_active: false })
              .eq('id', keyId)
          }
          setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, is_active: false } : k))
          showToast({ message: 'API key revoked', type: 'success' })
        },
      },
    ])
  }

  const addWebhook = async () => {
    if (!newWebhookUrl.trim().startsWith('https://')) {
      showToast({ message: 'URL must start with https://', type: 'error' })
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
      showToast({ message: 'Webhook added', type: 'success' })
    } catch {
      showToast({ message: 'Failed to add webhook', type: 'error' })
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
      <ScreenHeader title="API & Webhooks" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>API KEYS</Text>
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
                    label={key.is_active ? 'Active' : 'Revoked'}
                    variant={key.is_active ? 'success' : 'neutral'}
                  />
                  {key.is_active && (
                    <TouchableOpacity
                      onPress={() => revokeKey(key.id)}
                      style={styles.revokeBtn}
                      accessibilityLabel="Revoke key"
                      accessibilityRole="button"
                    >
                      <Text style={styles.revokeBtnText}>Revoke</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Divider />
            </View>
          ))}
          <Text style={styles.infoText}>Contact support to generate new API keys.</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>WEBHOOKS</Text>
          {webhooks.map(hook => (
            <View key={hook.id} style={styles.webhookRow}>
              <Text style={styles.webhookUrl} numberOfLines={1}>{hook.url}</Text>
              <Text style={styles.webhookEvents}>{hook.events.join(', ')}</Text>
              <View style={styles.webhookMeta}>
                <Badge
                  label={hook.is_active ? 'Active' : 'Inactive'}
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
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={styles.eventsLabel}>Events:</Text>
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
                <Button title="Cancel" onPress={() => setShowAddWebhook(false)} variant="secondary" />
                <Button
                  title={addingWebhook ? 'Adding...' : 'Add Webhook'}
                  onPress={() => void addWebhook()}
                  loading={addingWebhook}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addWebhookBtn}
              onPress={() => setShowAddWebhook(true)}
              accessibilityLabel="Add webhook"
              accessibilityRole="button"
            >
              <Text style={styles.addWebhookBtnText}>+ Add Webhook</Text>
            </TouchableOpacity>
          )}
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.md },
  card: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
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
  keyName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  keyPrefix: { fontSize: 13, color: Colors.primary, fontFamily: 'monospace', marginTop: 2 },
  meta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  keyActions: { alignItems: 'flex-end', gap: Spacing.xs },
  revokeBtn: {
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    minHeight: 28,
    justifyContent: 'center',
  },
  revokeBtnText: { fontSize: 12, color: Colors.error, fontWeight: '600' },
  infoText: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },
  webhookRow: {
    paddingVertical: Spacing.sm,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  webhookUrl: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  webhookEvents: { fontSize: 12, color: Colors.textSecondary },
  webhookMeta: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: 4 },
  failCount: { fontSize: 12, color: Colors.error },
  addWebhook: { marginTop: Spacing.md, gap: Spacing.sm },
  urlInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
  },
  eventsLabel: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  eventsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  eventChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 28,
    justifyContent: 'center',
  },
  eventChipActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  eventChipText: { fontSize: 11, color: Colors.textSecondary },
  eventChipTextActive: { color: Colors.primaryDark },
  addBtns: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  addWebhookBtn: {
    padding: Spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addWebhookBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
})
