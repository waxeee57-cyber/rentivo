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
import { captureException } from '@/lib/sentry'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useColors } from '@/lib/hooks/useColors'

export default function ICalSyncScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { id } = useLocalSearchParams<{ id: string }>()
  const { language } = useAuthStore()

  const [icalUrl, setIcalUrl] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  async function handleSync() {
    if (!icalUrl.trim()) {
      Alert.alert(
        t('opFleet2Error', language),
        t('opFleet2EnterICalUrl', language),
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
        t('opFleet2SyncComplete', language),
        language === 'hu'
          ? `${result.count ?? 0} foglalt nap importálva`
          : `${result.count ?? 0} blocked dates imported`,
      )
    } catch (error) {
      Alert.alert(
        t('opFleet2Error', language),
        error instanceof Error ? error.message : t('opFleet2SyncFailed', language),
      )
    } finally {
      setSyncing(false)
    }
  }

  async function handleExport() {
    // The feed now carries a per-listing token. Without it the URL was a public
    // read of this vehicle's entire booking calendar to anyone who knew the
    // listing id, and listing ids are public.
    const { data, error } = await supabase
      .from('rentivo_listings')
      .select('ical_feed_token')
      .eq('id', id)
      .maybeSingle()

    if (error || !data?.ical_feed_token) {
      captureException(error ?? new Error('ical_feed_token missing'), {
        screen: 'fleet/ical-sync', listingId: String(id),
      })
      Alert.alert(t('opFleet2Error', language), t('opFleet2SyncFailed', language))
      return
    }

    const exportUrl =
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ical-export` +
      `?listing_id=${id}&token=${data.ical_feed_token}`
    Alert.alert(
      t('opFleet2ICalExportUrl', language),
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
            accessibilityLabel={t('opFleet2GoBack', language)}
            accessibilityRole="button"
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('opFleet2ICalSync', language)}</Text>
        </View>

        {/* Import section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('opFleet2ImportCalendar', language)}
          </Text>
          <Text style={styles.sectionDesc}>
            {t('opFleet2ImportCalendarDesc', language)}
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
            accessibilityLabel={t('opFleet2ICalUrlInput', language)}
          />

          {lastSync !== null && (
            <Text style={styles.lastSync}>
              {`${t('opFleet2LastSyncPrefix', language)} ${lastSync}`}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.button, syncing && styles.buttonDisabled]}
            onPress={() => void handleSync()}
            disabled={syncing}
            accessibilityLabel={t('opFleet2StartSync', language)}
            accessibilityRole="button"
          >
            {syncing ? (
              <ActivityIndicator color={C.textInverse} />
            ) : (
              <Text style={styles.buttonText}>
                {t('opFleet2SyncNow', language)}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Export section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('opFleet2ExportCalendar', language)}
          </Text>
          <Text style={styles.sectionDesc}>
            {t('opFleet2ExportCalendarDesc', language)}
          </Text>

          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={() => void handleExport()}
            accessibilityLabel={t('opFleet2ShowExportUrl', language)}
            accessibilityRole="button"
          >
            <Text style={styles.buttonSecondaryText}>
              {t('opFleet2ShowExportUrl', language)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            {t('opFleet2HowItWorks', language)}
          </Text>
          <Text style={styles.infoText}>
            {t('opFleet2HowItWorksText', language)}
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
    fontFamily: Fonts.regular, fontSize: 20,
    color: C.text,
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.bold,
    color: C.text,
    marginBottom: Spacing.sm,
  },
  sectionDesc: {
    fontFamily: Fonts.regular, fontSize: 13,
    color: C.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.base,
  },

  // Input
  inputLabel: {
    fontSize: 12,
    fontFamily: Fonts.semibold,
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
    fontFamily: Fonts.regular, fontSize: 14,
    color: C.text,
    marginBottom: Spacing.sm,
  },

  lastSync: {
    fontFamily: Fonts.regular, fontSize: 12,
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
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.bold,
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
    fontFamily: Fonts.bold,
    color: C.info,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontFamily: Fonts.regular, fontSize: 13,
    color: C.textSecondary,
    lineHeight: 20,
  },
  })
}
