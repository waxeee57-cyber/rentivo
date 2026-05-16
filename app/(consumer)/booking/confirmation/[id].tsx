import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { ConfettiAnimation } from '@/components/ui/ConfettiAnimation'
import { useToastStore } from '@/lib/store/useToastStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import BookingVoucher from '@/components/booking/BookingVoucher'

export default function BookingConfirmationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const ref = (id ?? 'XXXXX').slice(0, 8).toUpperCase()
  const { showToast } = useToastStore()
  const { language } = useAuthStore()
  const checkScale = useRef(new Animated.Value(0)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const contentY = useRef(new Animated.Value(20)).current

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    // Animate check circle entrance
    Animated.spring(checkScale, { toValue: 1, damping: 9, stiffness: 120, useNativeDriver: true }).start()
    // Animate content fade-in
    Animated.sequence([
      Animated.delay(280),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(contentY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start()
    const timer = setTimeout(() => {
      showToast({ message: `${t('bookingConfirmed', language)} ✓`, type: 'success' })
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ConfettiAnimation />
      <ScreenHeader title={t('bookingConfirmed', language)} onBack={() => router.replace('/(consumer)/bookings')} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.successSection}>
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
            <Text style={styles.checkMark}>✓</Text>
          </Animated.View>
          <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentY }] }}>
            <Text style={styles.title}>{t('bookingConfirmed', language)}</Text>
            <Text style={styles.ref}>#{ref}</Text>
            <Text style={styles.subtitle}>
              {language === 'es'
                ? 'Tu reserva ha sido enviada. El operador confirmará en breve.'
                : language === 'hu'
                ? 'A foglalásod megérkezett. Az operátor hamarosan visszaigazolja.'
                : 'Your booking has been placed. The operator will confirm shortly.'}
            </Text>
          </Animated.View>
        </View>

        {/* What happens next */}
        <View style={styles.nextCard}>
          <Text style={styles.nextCardTitle}>{t('whatHappensNext', language)}</Text>
          <View style={styles.nextStep}>
            <Text style={styles.nextStepNum}>1</Text>
            <Text style={styles.nextStepText}>
              {language === 'es'
                ? 'El operador te contactará con los detalles de recogida'
                : language === 'hu'
                ? 'Az operátor kapcsolatba lép veled az átvétel részleteiről'
                : 'The operator will contact you about pickup details'}
            </Text>
          </View>
          <View style={styles.nextStep}>
            <Text style={styles.nextStepNum}>2</Text>
            <Text style={styles.nextStepText}>
              {language === 'es'
                ? 'Recibirás un contrato digital para firmar'
                : language === 'hu'
                ? 'Digitális szerződést kapsz aláírásra'
                : "You'll receive a digital contract to sign"}
            </Text>
          </View>
          <View style={styles.nextStep}>
            <Text style={styles.nextStepNum}>3</Text>
            <Text style={styles.nextStepText}>
              {language === 'es'
                ? 'En el día de recogida: inspección conjunta del vehículo'
                : language === 'hu'
                ? 'Az átvétel napján: közös állapotfelmérés a járművel'
                : 'On pickup day: inspect the vehicle together'}
            </Text>
          </View>
        </View>

        {/* Trust checklist */}
        <View style={styles.checklist}>
          {[
            language === 'es' ? 'Reserva confirmada' : language === 'hu' ? 'Foglalás visszaigazolva' : 'Booking Confirmed',
            language === 'es' ? 'Pago procesado' : language === 'hu' ? 'Fizetés feldolgozva' : 'Payment Processed',
            language === 'es' ? 'Contrato generado' : language === 'hu' ? 'Szerződés elkészítve' : 'Contract Generated',
            language === 'es' ? 'Seguro activo 🛡️' : language === 'hu' ? 'Biztosítás aktív 🛡️' : 'Insurance Active 🛡️',
          ].map((label, i) => (
            <View key={i} style={styles.checkRow}>
              <Text style={styles.checkRowIcon}>✅</Text>
              <Text style={styles.checkRowLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Offline booking voucher with QR */}
        <BookingVoucher voucher={{ id: id ?? 'unknown' }} language={language} />

        {/* No hidden fees */}
        <View style={styles.noFeesNote}>
          <Text style={styles.noFeesText}>✓ {t('noHiddenFees', language)}</Text>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button
          title={language === 'es' ? 'Ver detalles de reserva' : language === 'hu' ? 'Foglalás részletei' : 'View booking details'}
          onPress={() => router.push(`/(consumer)/bookings/${id ?? 'bk-001'}`)}
          fullWidth
          style={{ marginBottom: Spacing.sm }}
        />
        <TouchableOpacity
          style={styles.msgBtn}
          onPress={() => router.push(`/(consumer)/bookings/chat/${id ?? 'bk-001'}` as Parameters<typeof router.push>[0])}
        >
          <Text style={styles.msgBtnText}>💬 {t('messageOperator', language)}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl },
  successSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 3,
    borderColor: Colors.success,
  },
  checkMark: { fontSize: 48, color: Colors.success, fontWeight: '900' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: Spacing.sm },
  ref: { fontSize: 15, color: Colors.primary, fontWeight: '700', marginBottom: Spacing.md },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  nextCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  nextCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  nextStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textInverse,
    flexShrink: 0,
  },
  nextStepText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20, paddingTop: 4 },

  checklist: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkRowIcon: { fontSize: 16, color: Colors.success },
  checkRowLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  noFeesNote: {
    backgroundColor: Colors.successSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  noFeesText: { fontSize: 13, fontWeight: '700', color: Colors.success },

  actions: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xxxl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  msgBtn: {
    minHeight: 52,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
})
