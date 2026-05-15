import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { differenceInDays, format } from 'date-fns'
import * as Haptics from 'expo-haptics'
import { CardField, useStripe } from '@stripe/stripe-react-native'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { PriceBreakdown } from '@/components/booking/PriceBreakdown'
import { InsuranceSelector } from '@/components/booking/InsuranceSelector'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useListing } from '@/lib/hooks/useListing'
import { useToastStore } from '@/lib/store/useToastStore'
import { calculatePrice } from '@/lib/utils/calculatePrice'
import { getError } from '@/lib/errors'
import { Config } from '@/constants/config'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { supabase } from '@/lib/supabase'
import { createBooking } from '@/lib/api/bookings'
import { createPaymentIntent } from '@/lib/api/payments'
import { t } from '@/constants/i18n'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { INSURANCE_PACKAGES } from '@/types'
import type { InsuranceId } from '@/types'
import { validatePromoCode } from '@/lib/api/promo'

const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const hour = 8 + Math.floor(i / 2)
  const min = i % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${min}`
})

export default function BookingFlowScreen() {
  const {
    listingId,
    startDate: startDateParam,
    endDate: endDateParam,
    rentalType: rentalTypeParam,
  } = useLocalSearchParams<{
    listingId: string
    startDate?: string
    endDate?: string
    rentalType?: string
  }>()
  const { listing, loading } = useListing(listingId ?? '')
  const { language } = useAuthStore()
  const { confirmPayment } = useStripe()
  const [step, setStep] = useState(1)
  const [pickupTime, setPickupTime] = useState('10:00')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [flightNumber, setFlightNumber] = useState('')
  const [insurancePackage, setInsurancePackage] = useState<InsuranceId>('basic')
  const [cardComplete, setCardComplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [rentalType, setRentalType] = useState<'daily' | 'hourly'>(
    rentalTypeParam === 'hourly' ? 'hourly' : 'daily',
  )
  const [startHour, setStartHour] = useState('10:00')
  const [totalHours, setTotalHours] = useState(2)
  const { showToast } = useToastStore()

  const startDate = startDateParam
    ? new Date(startDateParam)
    : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d })()
  const endDate = endDateParam
    ? new Date(endDateParam)
    : (() => { const d = new Date(); d.setDate(d.getDate() + 4); return d })()
  const totalDays = Math.max(1, differenceInDays(endDate, startDate))

  if (loading || !listing) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>

  const priceCalc = calculatePrice(
    listing.price_per_day,
    totalDays,
    listing.deposit_amount,
    listing.price_per_week,
  )

  const selectedInsurance = INSURANCE_PACKAGES.find(p => p.id === insurancePackage) ?? INSURANCE_PACKAGES[0]
  const insuranceTotalCost = selectedInsurance.price * totalDays
  const hourlySubtotal = rentalType === 'hourly' && listing.price_per_hour != null
    ? listing.price_per_hour * totalHours
    : 0
  const grandTotal = rentalType === 'hourly'
    ? hourlySubtotal + insuranceTotalCost
    : priceCalc.total + insuranceTotalCost

  const handlePayment = async () => {
    if (submitting || submitted) return

    if (!guestName.trim()) {
      showToast({ message: getError('name_required'), type: 'error' })
      return
    }
    if (!guestPhone.trim()) {
      showToast({ message: getError('phone_required'), type: 'error' })
      return
    }

    setSubmitting(true)
    try {
      let bookingId: string

      if (Config.useMock) {
        await new Promise<void>(r => setTimeout(r, 1500))
        bookingId = `mock-${Math.random().toString(36).slice(2, 8)}`
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          showToast({ message: getError('auth_required'), type: 'error' })
          return
        }

        // Step 1: Create booking (pending — no payment yet)
        const booking = await createBooking({
          listing_id: listing.id,
          operator_id: listing.operator_id,
          user_id: session.user.id,
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim() || null,
          guest_phone: guestPhone.trim(),
          guest_nationality: null,
          driver_license_no: null,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          total_days: totalDays,
          pickup_time: pickupTime,
          return_time: null,
          pickup_location: null,
          price_per_day: listing.price_per_day,
          subtotal: priceCalc.subtotal,
          platform_fee: priceCalc.platformFee,
          total_amount: grandTotal,
          deposit_amount: selectedInsurance.price > 0 ? 0 : listing.deposit_amount,
          currency: 'EUR',
          status: 'pending',
          payment_status: 'pending',
          payment_intent_id: null,
          paid_at: null,
          contract_signed_at: null,
          contract_url: null,
          consumer_signature: null,
          operator_signature: null,
          notes: notes.trim() || null,
          flight_number: flightNumber.trim() || null,
        })
        bookingId = booking.id

        // Step 2: Create PaymentIntent via Edge Function
        const { clientSecret } = await createPaymentIntent({
          bookingId,
          amountEur: grandTotal,
          listingTitle: listing.title,
          operatorStripeAccountId: listing.operator?.stripe_account_id ?? null,
          accessToken: session.access_token,
        })

        // Step 3: Confirm payment with CardField input
        const { error: stripeError } = await confirmPayment(clientSecret, {
          paymentMethodType: 'Card',
        })

        if (stripeError) {
          showToast({ message: stripeError.message ?? getError('payment_failed'), type: 'error' })
          return
        }
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setSubmitted(true)
      router.replace(`/(consumer)/booking/confirmation/${bookingId}`)
    } catch {
      showToast({ message: getError('payment_failed'), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const steps = [t('tripDetails', language), t('reviewAndPay', language)]

  // Platform fee breakdown
  const platformFeeLabel = `Service fee (${(Config.platformCut * 100).toFixed(1)}%)`
  const refundableDeposit = listing.deposit_amount

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

      <StepIndicator totalSteps={2} currentStep={step} labels={steps} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Trip summary */}
        <View style={styles.summaryCard}>
          {(listing.images?.[0] ?? listing.cover_image_url) ? (
            <Image
              source={{ uri: (listing.images?.[0] ?? listing.cover_image_url) as string }}
              style={styles.summaryImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.summaryImage, styles.summaryImagePlaceholder]}>
              <Text style={styles.summaryImagePlaceholderText}>🚗</Text>
            </View>
          )}
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
          </View>
        </View>

        {step === 1 && (
          <>
            {listing.hourly_rental_enabled && (
              <View style={styles.rentalTypeRow}>
                {(['daily', 'hourly'] as const).map(rt => (
                  <TouchableOpacity
                    key={rt}
                    style={[styles.typeChip, rentalType === rt && styles.typeChipActive]}
                    onPress={() => setRentalType(rt)}
                    accessibilityLabel={`Select ${rt} rental`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: rentalType === rt }}
                  >
                    <Text style={[styles.typeChipText, rentalType === rt && styles.typeChipTextActive]}>
                      {rt === 'daily' ? '📅 Daily' : '⏱ Hourly'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {rentalType === 'hourly' && (
              <View style={styles.hourlySection}>
                <Text style={styles.formTitle}>Start time</Text>
                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: Spacing.md }}
                >
                  {TIME_SLOTS.slice(0, 20).map(slot => (
                    <TouchableOpacity
                      key={slot}
                      style={[styles.slotBtn, startHour === slot && styles.slotBtnActive]}
                      onPress={() => setStartHour(slot)}
                      accessibilityLabel={`Start at ${slot}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: startHour === slot }}
                    >
                      <Text style={[styles.slotText, startHour === slot && styles.slotTextActive]}>{slot}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.formTitle}>Duration</Text>
                <View style={styles.hoursRow}>
                  {[2, 3, 4, 6, 8, 12].map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.slotBtn, totalHours === h && styles.slotBtnActive]}
                      onPress={() => setTotalHours(h)}
                      accessibilityLabel={`${h} hours`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: totalHours === h }}
                    >
                      <Text style={[styles.slotText, totalHours === h && styles.slotTextActive]}>{h}h</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {listing.price_per_hour != null && (
                  <Text style={styles.hourlyTotal}>
                    Total: €{listing.price_per_hour * totalHours}
                  </Text>
                )}
              </View>
            )}

            {rentalType === 'daily' && (
              <PriceBreakdown
                calculation={priceCalc}
                insuranceName={t(selectedInsurance.nameKey, language)}
                insurancePricePerDay={selectedInsurance.price}
                totalDays={totalDays}
              />
            )}

            <InsuranceSelector
              selected={insurancePackage}
              onSelect={setInsurancePackage}
              language={language}
            />

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

            <View style={styles.flightSection}>
              <Text style={styles.flightLabel}>✈️ Airport pickup? (optional)</Text>
              <TextInput
                style={styles.flightInput}
                value={flightNumber}
                onChangeText={setFlightNumber}
                placeholder="Flight number (e.g. FR1234)"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="characters"
                maxLength={10}
                accessibilityLabel="Flight number input"
              />
              {flightNumber.length > 0 && (
                <Text style={styles.flightHint}>
                  We'll track your flight and adjust pickup if delayed.
                </Text>
              )}
            </View>

            <Text style={styles.formTitle}>
              {language === 'es' ? 'Hora de recogida' : language === 'hu' ? 'Átvétel időpontja' : 'Pickup time'}
            </Text>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timeSlots}
              style={{ marginBottom: Spacing.md }}
            >
              {TIME_SLOTS.map(slot => (
                <TouchableOpacity
                  key={slot}
                  style={[styles.timeSlot, pickupTime === slot && styles.timeSlotActive]}
                  onPress={() => setPickupTime(slot)}
                  accessibilityLabel={`Pickup time ${slot}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: pickupTime === slot }}
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
            {/* Transparent price breakdown */}
            <View style={styles.priceCard}>
              <Text style={styles.priceCardTitle}>Your total</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{priceCalc.breakdown}</Text>
                <Text style={styles.priceValue}>{formatEURDecimal(priceCalc.subtotal)}</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{platformFeeLabel}</Text>
                <Text style={styles.priceValue}>{formatEURDecimal(priceCalc.platformFee)}</Text>
              </View>
              {selectedInsurance.price > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>
                    {`${t(selectedInsurance.nameKey, language)} ${t('insurance', language)}`}
                  </Text>
                  <Text style={styles.priceValue}>{formatEURDecimal(insuranceTotalCost)}</Text>
                </View>
              )}
              <View style={[styles.priceRow, styles.priceTotal]}>
                <Text style={styles.priceTotalLabel}>Total now</Text>
                <Text style={styles.priceTotalValue}>{formatEURDecimal(grandTotal)}</Text>
              </View>
              {selectedInsurance.price > 0 ? (
                <View style={styles.depositRow}>
                  <Text style={styles.depositLabel}>✓ No deposit required</Text>
                  <Text style={[styles.depositValue, { color: Colors.success }]}>Included</Text>
                </View>
              ) : (
                <View style={styles.depositRow}>
                  <Text style={styles.depositLabel}>🔒 Refundable deposit</Text>
                  <Text style={styles.depositValue}>{formatEURDecimal(refundableDeposit)}</Text>
                </View>
              )}
              <View style={styles.trustRow}>
                <Text style={styles.trustItem}>✓ Free cancel until 48h before</Text>
                <Text style={styles.trustItem}>✓ No hidden fees</Text>
              </View>
            </View>

            {/* Guest recap */}
            <View style={styles.guestRecap}>
              <Text style={styles.guestRecapTitle}>Booked as</Text>
              <Text style={styles.guestRecapName}>{guestName}</Text>
              <Text style={styles.guestRecapContact}>{guestPhone}{guestEmail ? ` · ${guestEmail}` : ''}</Text>
            </View>

            {/* Card input */}
            {!Config.useMock && (
              <View style={styles.cardFieldWrapper}>
                <Text style={styles.cardLabel}>
                  {language === 'hu' ? 'Bankkártya adatok' : 'Card details'}
                </Text>
                <CardField
                  postalCodeEnabled={false}
                  onCardChange={(details) => setCardComplete(details.complete)}
                  style={styles.cardField}
                  cardStyle={{
                    backgroundColor: Colors.surface,
                    textColor: Colors.text,
                    placeholderColor: Colors.textSecondary,
                    borderColor: Colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                  }}
                />
              </View>
            )}

            {/* Trust signals */}
            <View style={styles.trustGrid}>
              {[
                { icon: '🔒', text: 'Stripe secure' },
                { icon: '✓', text: 'No hidden fees' },
                { icon: '✓', text: 'Cancel anytime' },
                { icon: '↩', text: 'Money back' },
              ].map(item => (
                <View key={item.text} style={styles.trustGridItem}>
                  <Text style={styles.trustGridIcon}>{item.icon}</Text>
                  <Text style={styles.trustGridText}>{item.text}</Text>
                </View>
              ))}
            </View>

            {/* Pay button with anti-double-submit */}
            <TouchableOpacity
              style={[
                styles.payBtn,
                (submitting || submitted || !guestName.trim() || (!Config.useMock && !cardComplete)) && styles.payBtnDisabled,
              ]}
              onPress={() => void handlePayment()}
              disabled={submitting || submitted || !guestName.trim() || (!Config.useMock && !cardComplete)}
              accessibilityLabel={`Pay ${formatEURDecimal(grandTotal)}`}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <Text style={styles.payBtnText}>
                  Pay {formatEURDecimal(grandTotal)} →
                </Text>
              )}
            </TouchableOpacity>
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
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    overflow: 'hidden', marginBottom: Spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  summaryImage: { width: '100%', height: 140 },
  summaryImagePlaceholder: {
    backgroundColor: Colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryImagePlaceholderText: { fontSize: 48 },
  summaryBody: { padding: Spacing.base },
  summaryTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  summaryOp: { fontSize: 12, color: Colors.textSecondary, marginBottom: Spacing.md },
  summaryDatesRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surfaceWarm, borderRadius: Radius.lg, padding: Spacing.sm,
  },
  summaryDateBlock: { flex: 1 },
  summaryDateLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  summaryDateValue: { fontSize: 13, fontWeight: '700', color: Colors.text },
  summaryArrow: { paddingHorizontal: Spacing.xs },
  summaryArrowText: { fontSize: 16, color: Colors.textTertiary },
  summaryDaysBlock: { alignItems: 'center', paddingLeft: Spacing.sm, borderLeftWidth: 1, borderLeftColor: Colors.border },
  summaryDaysNum: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  summaryDaysLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600' },

  formTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: Spacing.base, marginTop: Spacing.xl },
  timeSlots: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  timeSlot: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  timeSlotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeSlotText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  timeSlotTextActive: { color: Colors.textInverse },

  // Transparent price card
  priceCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.base, marginBottom: Spacing.base,
    borderWidth: 1, borderColor: Colors.border,
  },
  priceCardTitle: { fontSize: 13, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: Spacing.md },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  priceLabel: { fontSize: 14, color: Colors.textSecondary },
  priceValue: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  priceTotal: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: Spacing.sm, marginTop: Spacing.xs,
  },
  priceTotalLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  priceTotalValue: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  depositRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  depositLabel: { fontSize: 13, color: Colors.textSecondary },
  depositValue: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  trustRow: { marginTop: Spacing.md, gap: 4 },
  trustItem: { fontSize: 12, color: Colors.success, fontWeight: '500' },

  guestRecap: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.base,
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  guestRecapTitle: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: 4 },
  guestRecapName: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  guestRecapContact: { fontSize: 13, color: Colors.textSecondary },

  trustGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.surfaceWarm, borderRadius: Radius.lg,
    padding: Spacing.base, borderWidth: 1, borderColor: Colors.borderWarm,
  },
  trustGridItem: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  trustGridIcon: { fontSize: 14, width: 20, textAlign: 'center' },
  trustGridText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  cardFieldWrapper: { marginBottom: Spacing.base },
  cardLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  cardField: { height: 50, marginBottom: 4 },

  payBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingVertical: Spacing.base, alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
    minHeight: 52, justifyContent: 'center',
  },
  payBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  payBtnText: { color: Colors.textInverse, fontWeight: '800', fontSize: 17 },
  secureNote: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.sm },

  // Hourly rental styles
  rentalTypeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  typeChip: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  typeChipTextActive: { color: Colors.background },
  hourlySection: { marginBottom: Spacing.base },
  slotBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    marginRight: Spacing.sm, minHeight: 44, justifyContent: 'center',
  },
  slotBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  slotTextActive: { color: Colors.background },
  hoursRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  hourlyTotal: { color: Colors.primary, fontSize: 18, fontWeight: '700', marginTop: Spacing.md },

  // Flight tracking
  flightSection: { marginBottom: 16 },
  flightLabel: { color: Colors.textSecondary, fontSize: 14, marginBottom: 8 },
  flightInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
  },
  flightHint: { color: Colors.primary, fontSize: 12, marginTop: 4 },
})
