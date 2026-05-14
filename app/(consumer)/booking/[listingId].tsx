import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { differenceInDays, addDays, format } from 'date-fns'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { PriceBreakdown } from '@/components/booking/PriceBreakdown'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useListing } from '@/lib/hooks/useListing'
import { useToastStore } from '@/lib/store/useToastStore'
import { calculatePrice } from '@/lib/utils/calculatePrice'
import { getError } from '@/lib/errors'
import { Config } from '@/constants/config'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'

const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const hour = 8 + Math.floor(i / 2)
  const min = i % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${min}`
})

export default function BookingFlowScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>()
  const { listing, loading } = useListing(listingId ?? '')
  const { language } = useAuthStore()
  const [step, setStep] = useState(1)
  const [pickupTime, setPickupTime] = useState('10:00')
  const [guestName, setGuestName] = useState(Config.useMock ? 'Test User' : '')
  const [guestPhone, setGuestPhone] = useState(Config.useMock ? '+36701234567' : '')
  const [guestEmail, setGuestEmail] = useState(Config.useMock ? 'test@example.com' : '')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const { showToast } = useToastStore()

  const startDate = addDays(new Date(), 1)
  const endDate = addDays(new Date(), 4)
  const totalDays = differenceInDays(endDate, startDate)

  if (loading || !listing) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>

  const priceCalc = calculatePrice(
    listing.price_per_day,
    totalDays,
    listing.deposit_amount,
    listing.price_per_week,
  )

  const handlePayment = async () => {
    if (!guestName.trim()) {
      showToast({ message: getError('name_required'), type: 'error' })
      return
    }
    if (!guestPhone.trim()) {
      showToast({ message: getError('phone_required'), type: 'error' })
      return
    }
    setProcessing(true)
    try {
      await new Promise(r => setTimeout(r, 1500))
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace('/(consumer)/booking/confirmation/mock-booking-001')
    } catch {
      showToast({ message: getError('payment_failed'), type: 'error' })
    } finally {
      setProcessing(false)
    }
  }

  const steps = [t('tripDetails', language), t('reviewAndPay', language)]

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={language === 'es' ? 'Reservar vehículo' : language === 'hu' ? 'Jármű foglalása' : 'Book Vehicle'}
        onBack={() => step > 1 ? setStep(s => s - 1) : router.back()}
        rightAction={
          step === 2 ? (
            <HelpTooltip
              title="Secure payment"
              description={'Your payment is processed by Stripe — the same technology used by Amazon and Airbnb.'}
              faqs={[
                { q: 'When am I charged?', a: 'Immediately when you confirm the booking.' },
                { q: 'What if I need to cancel?', a: 'Check the cancellation policy shown on this page.' },
              ]}
            />
          ) : undefined
        }
      />

      <StepIndicator
        totalSteps={2}
        currentStep={step}
        labels={steps}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Trip summary card — shown on both steps */}
        <View style={styles.summaryCard}>
          <Image
            source={{ uri: listing.cover_image_url ?? undefined }}
            style={styles.summaryImage}
            contentFit="cover"
          />
          <View style={styles.summaryBody}>
            <Text style={styles.summaryTitle} numberOfLines={1}>{listing.title}</Text>
            <Text style={styles.summaryOp} numberOfLines={1}>{listing.operator?.name} · {listing.operator?.city}</Text>
            <View style={styles.summaryDatesRow}>
              <View style={styles.summaryDateBlock}>
                <Text style={styles.summaryDateLabel}>Pick-up</Text>
                <Text style={styles.summaryDateValue}>{format(startDate, 'EEE, MMM d')}</Text>
              </View>
              <View style={styles.summaryArrow}><Text style={styles.summaryArrowText}>→</Text></View>
              <View style={styles.summaryDateBlock}>
                <Text style={styles.summaryDateLabel}>Return</Text>
                <Text style={styles.summaryDateValue}>{format(endDate, 'EEE, MMM d')}</Text>
              </View>
              <View style={styles.summaryDaysBlock}>
                <Text style={styles.summaryDaysNum}>{totalDays}</Text>
                <Text style={styles.summaryDaysLabel}>days</Text>
              </View>
            </View>
            {step === 1 && (
              <TouchableOpacity onPress={() => {}}>
                <Text style={styles.editDates}>Edit dates</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {step === 1 && (
          <>
            <PriceBreakdown calculation={priceCalc} />

            <Text style={styles.formTitle}>{t('guestInfo', language)}</Text>
            <Input
              label={language === 'es' ? 'Nombre completo *' : language === 'hu' ? 'Teljes név *' : 'Full name *'}
              value={guestName} onChangeText={setGuestName}
              placeholder={language === 'es' ? 'María García' : language === 'hu' ? 'Kovács János' : 'John Smith'}
            />
            <Input
              label={language === 'es' ? 'Número de teléfono *' : language === 'hu' ? 'Telefonszám *' : 'Phone number *'}
              value={guestPhone} onChangeText={setGuestPhone}
              placeholder="+34 600 000 000" keyboardType="phone-pad"
            />
            <Input
              label={language === 'es' ? 'Email (opcional)' : language === 'hu' ? 'Email (opcionális)' : 'Email (optional)'}
              value={guestEmail} onChangeText={setGuestEmail}
              placeholder="email@example.com" keyboardType="email-address"
            />
            <Input
              label={language === 'es' ? 'Notas' : language === 'hu' ? 'Megjegyzés' : 'Notes'}
              value={notes} onChangeText={setNotes}
              placeholder={language === 'es' ? 'Peticiones especiales...' : language === 'hu' ? 'Különleges kérések...' : 'Special requests...'}
              multiline numberOfLines={3}
            />

            {/* Pickup time selector */}
            <Text style={styles.formTitle}>
              {language === 'es' ? 'Hora de recogida' : language === 'hu' ? 'Átvétel időpontja' : 'Pickup time'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timeSlots}
              style={{ marginBottom: Spacing.md }}
            >
              {TIME_SLOTS.map(slot => (
                <TouchableOpacity
                  key={slot}
                  style={[styles.timeSlot, pickupTime === slot && styles.timeSlotActive]}
                  onPress={() => setPickupTime(slot)}
                >
                  <Text style={[styles.timeSlotText, pickupTime === slot && styles.timeSlotTextActive]}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Button
              title={t('continueToPayment', language) + ' →'}
              onPress={() => setStep(2)}
              disabled={!guestName.trim() || !guestPhone.trim()}
              fullWidth
              style={{ marginTop: Spacing.md }}
            />
          </>
        )}

        {step === 2 && (
          <>
            <PriceBreakdown calculation={priceCalc} />

            {/* Guest recap */}
            <View style={styles.guestRecap}>
              <Text style={styles.guestRecapTitle}>Booked as</Text>
              <Text style={styles.guestRecapName}>{guestName}</Text>
              <Text style={styles.guestRecapContact}>{guestPhone}{guestEmail ? ` · ${guestEmail}` : ''}</Text>
            </View>

            {/* Trust signals — 2×2 grid */}
            <View style={styles.trustGrid}>
              {[
                { icon: '🔒', text: 'Stripe secure' },
                { icon: '✓', text: 'No hidden fees' },
                { icon: '✓', text: 'Cancel anytime' },
                { icon: '↩', text: 'Money back' },
              ].map(item => (
                <View key={item.text} style={styles.trustItem}>
                  <Text style={styles.trustIcon}>{item.icon}</Text>
                  <Text style={styles.trustText}>{item.text}</Text>
                </View>
              ))}
            </View>

            <Button
              title={`Pay €${(priceCalc.total / 100).toFixed(2)}`}
              onPress={handlePayment}
              loading={processing}
              fullWidth
              style={{ marginTop: Spacing.xl }}
            />
            <Text style={styles.secureNote}>🔒 Secure payment · SSL encrypted</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },


  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },

  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryImage: { width: '100%', height: 140 },
  summaryBody: { padding: Spacing.base },
  summaryTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  summaryOp: { fontSize: 12, color: Colors.textSecondary, marginBottom: Spacing.md },
  summaryDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
  },
  summaryDateBlock: { flex: 1 },
  summaryDateLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  summaryDateValue: { fontSize: 13, fontWeight: '700', color: Colors.text },
  summaryArrow: { paddingHorizontal: Spacing.xs },
  summaryArrowText: { fontSize: 16, color: Colors.textTertiary },
  summaryDaysBlock: { alignItems: 'center', paddingLeft: Spacing.sm, borderLeftWidth: 1, borderLeftColor: Colors.border },
  summaryDaysNum: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  summaryDaysLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600' },
  editDates: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginTop: Spacing.sm },

  formTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: Spacing.base, marginTop: Spacing.xl },
  guestRecap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginTop: Spacing.base,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  guestRecapTitle: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: 4 },
  guestRecapName: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  guestRecapContact: { fontSize: 13, color: Colors.textSecondary },
  timeSlots: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  timeSlot: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  timeSlotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeSlotText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  timeSlotTextActive: { color: Colors.textInverse },
  stripeNote: { fontSize: 16, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  stripeNote2: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: 4 },
  secureNote: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.sm },
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.base,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borderWarm,
  },
  trustItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  trustIcon: { fontSize: 14, width: 20, textAlign: 'center' },
  trustText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
})
