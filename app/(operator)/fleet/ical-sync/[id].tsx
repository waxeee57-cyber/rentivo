import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { Spacing, Radius } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useColors } from '@/lib/hooks/useColors'

export default function ICalSyncScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { id } = useLocalSearchParams<{ id: string }>()
  const { language } = useAuthStore()
  const isHu = language === 'hu'

  const [icalUrl, setIcalUrl] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  async function handleSync() {
    if (!icalUrl.trim()) {
      Alert.alert(
        isHu ? 'Hiba' : 'Error',
        isHu ? 'Add meg az iCal URL-t' : 'Please enter an iCal URL',
      )
      return
    }
    setSyncing(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ical-import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ listing_id: id, ical_url: icalUrl.trim() }),
        },
      )
      const result = (await response.json()) as { count?: number; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Sync failed')

      setLastSync(new Date().toLocaleString())
      Alert.alert(
        isHu ? 'Szinkronizálás kész' : 'Sync complete',
        isHu
          ? `${result.count ?? 0} foglalt nap importálva`
          : `${result.count ?? 0} blocked dates imported`,
      )
    } catch (error) {
      Alert.alert(
        isHu ? 'Hiba' : 'Error',
        error instanceof Error ? error.message : 'Sync failed',
      )
    } finally {
      setSyncing(false)
    }
  }

  function handleExport() {
    const exportUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ical-export?listing_id=${id}`
    Alert.alert(
      isHu ? 'iCal export URL' : 'iCal Export URL',
      exportUrl,
      [{ text: 'OK' }],
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel={isHu ? 'Vissza' : 'Go back'}
            accessibilityRole="button"
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isHu ? 'iCal szinkronizálás' : 'iCal Sync'}</Text>
        </View>

        {/* Import section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isHu ? 'Külső naptár importálása' : 'Import external calendar'}
          </Text>
          <Text style={styles.sectionDesc}>
            {isHu
              ? 'Add meg az Airbnb, Booking.com vagy más platform iCal URL-jét, hogy a foglalt napok automatikusan blokkolásra kerüljenek.'
              : 'Enter your Airbnb, Booking.com or other platform iCal URL to automatically block booked dates.'}
          </Text>

          <Text style={styles.inputLabel}>iCal URL</Text>
          <TextInput
            value={icalUrl}
            onChangeText={setIcalUrl}
            placeholder="https://www.airbnb.com/calendar/ical/..."
            placeholderTextColor={C.textTertiary}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="iCal URL input"
          />

          {lastSync !== null && (
            <Text style={styles.lastSync}>
              {isHu ? `Utolsó szinkron: ${lastSync}` : `Last sync: ${lastSync}`}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.button, syncing && styles.buttonDisabled]}
            onPress={() => void handleSync()}
            disabled={syncing}
            accessibilityLabel={isHu ? 'Szinkronizálás indítása' : 'Start sync'}
            accessibilityRole="button"
          >
            {syncing ? (
              <ActivityIndicator color={C.textInverse} />
            ) : (
              <Text style={styles.buttonText}>
                {isHu ? 'Szinkronizálás' : 'Sync now'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Export section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isHu ? 'Saját naptár exportálása' : 'Export your calendar'}
          </Text>
          <Text style={styles.sectionDesc}>
            {isHu
              ? 'Más platformok számára szinkronizáld a foglalásaidat ezzel az iCal URL-lel.'
              : 'Use this iCal URL to sync your bookings to other platforms.'}
          </Text>

          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={handleExport}
            accessibilityLabel={isHu ? 'Export URL megjelenítése' : 'Show export URL'}
            accessibilityRole="button"
          >
            <Text style={styles.buttonSecondaryText}>
              {isHu ? 'Export URL megjelenítése' : 'Show export URL'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            {isHu ? 'Hogyan működik?' : 'How it works'}
          </Text>
          <Text style={styles.infoText}>
            {isHu
              ? '1. Másold ki az iCal URL-t az Airbnb / Booking.com fiókodból.\n2. Illeszd be a fenti mezőbe.\n3. Nyomj a Szinkronizálás gombra — a foglalt napok azonnal blokkolva lesznek.'
              : '1. Copy the iCal URL from your Airbnb / Booking.com account.\n2. Paste it in the field above.\n3. Tap Sync now — booked dates will be blocked immediately.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  content: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xxxl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  backText: {
    fontSize: 20,
    color: C.text,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
  },

  // Section
  section: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    marginBottom: Spacing.sm,
  },
  sectionDesc: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.base,
  },

  // Input
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontSize: 14,
    color: C.text,
    marginBottom: Spacing.sm,
  },

  lastSync: {
    fontSize: 12,
    color: C.textTertiary,
    marginBottom: Spacing.md,
  },

  // Primary button
  button: {
    backgroundColor: C.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textInverse,
  },

  // Secondary button
  buttonSecondary: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: C.primary,
    backgroundColor: C.primarySurface,
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.primary,
  },

  // Info card
  infoCard: {
    backgroundColor: C.infoSurface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.info + '44',
    marginBottom: Spacing.base,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.info,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 20,
  },
  })
}
