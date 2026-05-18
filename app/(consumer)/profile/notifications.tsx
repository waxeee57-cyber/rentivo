import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'

interface NotificationPrefs {
  booking_confirmed: boolean
  booking_cancelled: boolean
  booking_reminder: boolean
  new_message: boolean
  payment_received: boolean
  review_received: boolean
  promotions: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  booking_confirmed: true,
  booking_cancelled: true,
  booking_reminder: true,
  new_message: true,
  payment_received: true,
  review_received: true,
  promotions: false,
}

export default function NotificationsScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language } = useAuthStore()
  const insets = useSafeAreaInsets()
  const isHu = language === 'hu'
  const isEs = language === 'es'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)

  const label = (hu: string, es: string, en: string) =>
    isHu ? hu : isEs ? es : en

  const loadPrefs = useCallback(async () => {
    if (Config.useMock) {
      setLoading(false)
      return
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoading(false); return }

      const { data } = await supabase
        .from('rentivo_notification_prefs')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (data) {
        setPrefs({
          booking_confirmed: data.booking_confirmed ?? true,
          booking_cancelled: data.booking_cancelled ?? true,
          booking_reminder: data.booking_reminder ?? true,
          new_message: data.new_message ?? true,
          payment_received: data.payment_received ?? true,
          review_received: data.review_received ?? true,
          promotions: data.promotions ?? false,
        })
      }
    } catch {
      // silent — table may not exist yet, use defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPrefs()
  }, [loadPrefs])

  const updatePref = async (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs(prev => ({ ...prev, [key]: value }))
    if (Config.useMock) return

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      await supabase
        .from('rentivo_notification_prefs')
        .upsert(
          { user_id: session.user.id, [key]: value },
          { onConflict: 'user_id' },
        )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Alert.alert(isHu ? 'Hiba' : isEs ? 'Error' : 'Error', msg)
      // revert optimistic update
      setPrefs(prev => ({ ...prev, [key]: !value }))
    } finally {
      setSaving(false)
    }
  }

  const sections: Array<{
    titleHu: string; titleEs: string; titleEn: string;
    items: Array<{ key: keyof NotificationPrefs; labelHu: string; labelEs: string; labelEn: string; descHu: string; descEs: string; descEn: string }>
  }> = [
    {
      titleHu: 'FOGLALÁSOK',
      titleEs: 'RESERVAS',
      titleEn: 'BOOKINGS',
      items: [
        {
          key: 'booking_confirmed',
          labelHu: 'Foglalás visszaigazolva',
          labelEs: 'Reserva confirmada',
          labelEn: 'Booking confirmed',
          descHu: 'Amikor a foglalásodat visszaigazolják',
          descEs: 'Cuando tu reserva sea confirmada',
          descEn: 'When your booking is confirmed',
        },
        {
          key: 'booking_cancelled',
          labelHu: 'Foglalás lemondva',
          labelEs: 'Reserva cancelada',
          labelEn: 'Booking cancelled',
          descHu: 'Ha egy foglalást lemondanak',
          descEs: 'Si una reserva es cancelada',
          descEn: 'If a booking is cancelled',
        },
        {
          key: 'booking_reminder',
          labelHu: 'Bérlési emlékeztető',
          labelEs: 'Recordatorio de reserva',
          labelEn: 'Booking reminder',
          descHu: '24 órával az átvétel előtt',
          descEs: '24 horas antes de la recogida',
          descEn: '24 hours before pickup',
        },
      ],
    },
    {
      titleHu: 'KOMMUNIKÁCIÓ',
      titleEs: 'COMUNICACIÓN',
      titleEn: 'COMMUNICATION',
      items: [
        {
          key: 'new_message',
          labelHu: 'Új üzenet',
          labelEs: 'Nuevo mensaje',
          labelEn: 'New message',
          descHu: 'Amikor új üzeneted érkezik',
          descEs: 'Cuando recibas un nuevo mensaje',
          descEn: 'When you receive a new message',
        },
        {
          key: 'review_received',
          labelHu: 'Új értékelés',
          labelEs: 'Nueva reseña',
          labelEn: 'New review',
          descHu: 'Amikor értékelést kapsz',
          descEs: 'Cuando recibas una reseña',
          descEn: 'When you receive a review',
        },
      ],
    },
    {
      titleHu: 'FIZETÉSEK',
      titleEs: 'PAGOS',
      titleEn: 'PAYMENTS',
      items: [
        {
          key: 'payment_received',
          labelHu: 'Befizetés érkezett',
          labelEs: 'Pago recibido',
          labelEn: 'Payment received',
          descHu: 'Sikeres fizetés esetén',
          descEs: 'Cuando se recibe un pago',
          descEn: 'When a payment is processed',
        },
      ],
    },
    {
      titleHu: 'MARKETING',
      titleEs: 'MARKETING',
      titleEn: 'MARKETING',
      items: [
        {
          key: 'promotions',
          labelHu: 'Akciók és ajánlatok',
          labelEs: 'Promociones y ofertas',
          labelEn: 'Promotions & offers',
          descHu: 'Rentivo ajánlatok és hírek',
          descEs: 'Ofertas y noticias de Rentivo',
          descEn: 'Rentivo deals and news',
        },
      ],
    },
  ]

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + Spacing.base }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back header */}
        <TouchableOpacity
          style={[styles.back, { paddingTop: insets.top + Spacing.sm }]}
          onPress={() => router.back()}
          accessibilityLabel={label('Vissza', 'Volver', 'Go back')}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>← {label('Vissza', 'Volver', 'Back')}</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>
            {label('Értesítési beállítások', 'Configuración de notificaciones', 'Notification Settings')}
          </Text>
          <Text style={styles.subtitle}>
            {label(
              'Válaszd ki, milyen értesítéseket szeretnél kapni.',
              'Elige qué notificaciones deseas recibir.',
              'Choose which notifications you want to receive.',
            )}
          </Text>

          {saving && (
            <View style={styles.savingBadge}>
              <ActivityIndicator color={C.primary} size="small" />
              <Text style={styles.savingText}>{label('Mentés...', 'Guardando...', 'Saving...')}</Text>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={C.primary} size="large" />
            </View>
          ) : (
            sections.map(section => (
              <View key={section.titleEn} style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {label(section.titleHu, section.titleEs, section.titleEn)}
                </Text>

                {section.items.map((item, idx) => (
                  <React.Fragment key={item.key}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.switchRow}>
                      <View style={styles.switchContent}>
                        <Text style={styles.switchTitle}>
                          {label(item.labelHu, item.labelEs, item.labelEn)}
                        </Text>
                        <Text style={styles.switchDesc}>
                          {label(item.descHu, item.descEs, item.descEn)}
                        </Text>
                      </View>
                      <Switch
                        value={prefs[item.key]}
                        onValueChange={(value) => void updatePref(item.key, value)}
                        trackColor={{ false: C.border, true: C.primary }}
                        thumbColor={C.white}
                        accessibilityLabel={label(item.labelHu, item.labelEs, item.labelEn)}
                      />
                    </View>
                  </React.Fragment>
                ))}
              </View>
            ))
          )}

          <Text style={styles.footer}>
            {label(
              'A push értesítések kezeléséhez az eszközöd beállításait is ellenőrizd.',
              'Para gestionar notificaciones push, también revisa la configuración de tu dispositivo.',
              'To manage push notifications, also check your device settings.',
            )}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { flexGrow: 1 },
  back: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  backText: { fontSize: 16, color: C.primary, fontWeight: '600' },
  content: { padding: Spacing.base },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: C.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: C.primarySurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  savingText: { fontSize: 12, color: C.primary, fontWeight: '600' },
  loadingContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
  },
  section: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textTertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: Spacing.xs,
  },
  switchContent: { flex: 1, marginRight: Spacing.md },
  switchTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  switchDesc: { fontSize: 12, color: C.textTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: Spacing.sm },
  footer: {
    fontSize: 12,
    color: C.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  })
}
