import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { differenceInDays, format } from 'date-fns'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { CardField, useStripe } from '@stripe/stripe-react-native'
import { Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { AnimatedButton } from '@/components/ui/AnimatedButton'
import { Input } from '@/components/ui/Input'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { PriceBreakdown } from '@/components/booking/PriceBreakdown'
import { InsuranceSelector } from '@/components/booking/InsuranceSelector'
import { DatePickerSheet } from '@/components/booking/DatePickerSheet'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useListing } from '@/lib/hooks/useListing'
import { useAvailability } from '@/lib/hooks/useAvailability'
import { useToastStore } from '@/lib/store/useToastStore'
import { calculatePrice } from '@/lib/utils/calculatePrice'
import { getError } from '@/lib/errors'
import { Config } from '@/constants/config'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { supabase } from '@/lib/supabase'
import { createBooking } from '@/lib/api/bookings'
import { createPaymentIntent, createDepositSetup } from '@/lib/api/payments'
import { t } from '@/constants/i18n'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { INSURANCE_PACKAGES } from '@/types'
import type { InsuranceId } from '@/types'
import { validatePromoCode } from '@/lib/api/promo'
import { useColors } from '@/lib/hooks/useColors'

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
  const { confirmPayment, confirmSetupIntent } = useStripe()
  const [step, setStep] = useState(1)
  const [pickupTime, setPickupTime] = useState('10:00')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [insurancePackage, setInsurancePackage] = useState<InsuranceId>('basic')
  const [cardComplete, setCardComplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [rentalType, setRentalType] = useState<'daily' | 'hourly'>(
    rentalTypeParam === 'hourly' ? 'hourly' : 'daily',
  )
  const [startHour, setStartHour] = useState('10:00')
  const [totalHours, setTotalHours] = useState(2)
  const [promoCode, setPromoCode] = useState('')
  const [flightNumber, setFlightNumber] = useState('')
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoLoading, setPromoLoading] = useState(false)
  const [identityStatus, setIdentityStatus] = useState<string | null>(null)
  const [identityLoading, setIdentityLoading] = useState(true)
  const [localStartDate, setLocalStartDate] = useState<Date | null>(
    startDateParam ? new Date(startDateParam) : null
  )
  const [localEndDate, setLocalEndDate] = useState<Date | null>(
    endDateParam ? new Date(endDateParam) : null
  )
  const { showToast } = useToastStore()

  // Theme — must be before early returns
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { blockedDates } = useAvailability(listingId ?? '')

  useEffect(() => {
    if (Config.useMock) {
      setIdentityStatus('approved')
      setIdentityLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setIdentityStatus(null); setIdentityLoading(false); return }
      supabase
        .from('rentivo_identity_verifications')
        .select('status')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          setIdentityStatus(data?.status ?? 'unverified')
          setIdentityLoading(false)
        })
    })
  }, [])

  if (loading || !listing) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>

  const requiresVerification = listing.operator?.requires_identity_verification ?? false
  const isIdentityApproved = identityStatus === 'approved'

  if (requiresVerification && !identityLoading && !isIdentityApproved) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Booking" />
        <View style={styles.vgContainer}>
          <Text style={styles.vgIcon}>🔐</Text>
          <Text style={styles.vgTitle}>Identity verification required</Text>
          <Text style={styles.vgDesc}>
            {identityStatus === 'pending' || identityStatus === 'in_progress'
              ? 'Your verification is being processed. Please check back shortly.'
              : 'This operator requires verified identity before booking.'}
          </Text>
          {(identityStatus === 'unverified' || identityStatus === 'declined' || identityStatus == null) && (
            <TouchableOpacity
              style={styles.vgButton}
              onPress={() => router.push('/(consumer)/profile/identity-verification')}
              accessibilityLabel="Verify identity"
            >
              <Text style={styles.vgButtonText}>Verify my identity →</Text>
            </TouchableOpacity>
          )}
          {(identityStatus === 'pending' || identityStatus === 'in_progress') && (
            <TouchableOpacity
              style={[styles.vgButton, { backgroundColor: C.warning }]}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
            >
              <Text style={styles.vgButtonText}>Go back</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    )
  }

  // Payout guard — block booking if the operator can't receive payouts yet.
  // Without an onboarded Connect account the payment would land on the platform
  // account with no transfer to the operator. Mock mode bypasses this.
  const operatorCanReceivePayments =
    Config.useMock ||
    (listing.operator?.stripe_onboarded === true && !!listing.operator?.stripe_account_id)

  if (!operatorCanReceivePayments) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Booking" onBack={() => router.back()} />
        <View style={styles.vgContainer}>
          <Text style={styles.vgIcon}>🚧</Text>
          <Text style={styles.vgTitle}>
            {language === 'hu'
              ? 'Ez a hirdetés jelenleg nem foglalható'
              : language === 'es'
                ? 'Este anuncio no se puede reservar por ahora'
                : 'This listing is not bookable right now'}
          </Text>
          <Text style={styles.vgDesc}>
            {language === 'hu'
              ? 'A szolgáltató még nem fejezte be a fizetési beállításokat. Kérlek, próbáld újra később.'
              : language === 'es'
                ? 'El proveedor aún no ha completado la configuración de pagos. Vuelve a intentarlo más tarde.'
                : 'The operator has not finished setting up payments yet. Please try again later.'}
          </Text>
          <TouchableOpacity
            style={styles.vgButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={language === 'hu' ? 'Vissza' : language === 'es' ? 'Volver' : 'Go back'}
          >
            <Text style={styles.vgButtonText}>
              {language === 'hu' ? 'Vissza' : language === 'es' ? 'Volver' : 'Go back'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const startDate = localStartDate
  const endDate = localEndDate

  if (!startDate || !endDate) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Booking" />
        <DatePickerSheet
          visible={true}
          startDate={localStartDate}
          endDate={localEndDate}
          onApply={(start, end) => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            setLocalStartDate(start)
            setLocalEndDate(end)
          }}
          onClose={() => router.back()}
          blockedDates={blockedDates}
          pricePerDay={listing.price_per_day}
        />
      </SafeAreaView>
    )
  }
  const totalDays = Math.max(1, differenceInDays(endDate, startDate))

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
  const baseTotal = rentalType === 'hourly'
    ? hourlySubtotal + insuranceTotalCost
    : priceCalc.total + insuranceTotalCost
  const grandTotal = Math.max(0, baseTotal - promoDiscount)
  // Deposit Model B cap: waived when a paid insurance package covers damage,
  // otherwise the listing's deposit. Must match the deposit_amount we persist on
  // the booking below so the disclosure shows the exact charge ceiling.
  const effectiveDeposit = selectedInsurance.price > 0 ? 0 : listing.deposit_amount

  const applyPromo = async () => {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    const result = await validatePromoCode(promoCode, baseTotal)
    if (result.valid) {
      setPromoDiscount(result.discount)
      setPromoApplied(true)
      showToast({ message: `Promo applied: -${formatEURDecimal(result.discount)}`, type: 'success' })
    } else {
      showToast({ message: result.error ?? 'Invalid promo code', type: 'error' })
      setPromoDiscount(0)
      setPromoApplied(false)
    }
    setPromoLoading(false)
  }

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

        // Server-authoritative: the client sends only booking parameters — never money.
        // create-booking derives subtotal/platform_fee/total_amount/deposit_amount from
        // the listing + these inputs (the client-side priceCalc above is display-only).
        const booking = await createBooking({
          listing_id: listing.id,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          rental_type: rentalType,
          total_hours: rentalType === 'hourly' ? totalHours : null,
          insurance_id: insurancePackage,
          promo_code: promoApplied ? promoCode : null,
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim() || null,
          guest_phone: guestPhone.trim(),
          guest_nationality: null,
          driver_license_no: null,
          pickup_time: pickupTime,
          return_time: null,
          pickup_location: null,
          notes: notes.trim() || null,
          flight_number: flightNumber.trim() || null,
        })
        bookingId = booking.id

        const { clientSecret } = await createPaymentIntent({
          bookingId,
          accessToken: session.access_token,
        })

        const { error: stripeError } = await confirmPayment(clientSecret, {
          paymentMethodType: 'Card',
        })

        if (stripeError) {
          showToast({ message: stripeError.message ?? getError('payment_failed'), type: 'error' })
          return
        }

        // Deposit Model B — vault the same card (off_session) for potential
        // damage charges, capped at effectiveDeposit. Non-blocking: the rental is
        // already paid, so a vault failure only warns and proceeds.
        if (effectiveDeposit > 0) {
          const depositVaultFailed =
            language === 'hu'
              ? 'A fizetés sikeres, de a kaució kártyamentése nem sikerült.'
              : language === 'es'
                ? 'El pago se realizó, pero no se pudo guardar la tarjeta para la fianza.'
                : 'Payment succeeded, but saving your card for the deposit failed.'
          try {
            const { clientSecret: depositSecret } = await createDepositSetup({
              bookingId,
              accessToken: session.access_token,
            })
            const { error: setupError } = await confirmSetupIntent(depositSecret, {
              paymentMethodType: 'Card',
            })
            if (setupError) {
              showToast({ message: setupError.message ?? depositVaultFailed, type: 'error' })
            }
          } catch {
            showToast({ message: depositVaultFailed, type: 'error' })
          }
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
  const platformFeeLabel = `Service fee (${(Config.platformCut * 100).toFixed(1)}%)`

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
          <Animated.View key="step1" entering={FadeInDown.duration(200)}>
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
                    Total: {formatEURDecimal(listing.price_per_hour * totalHours)}
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
                language={language}
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
            <Input
              label={language === 'es' ? '✈️ Número de vuelo (opcional)' : language === 'hu' ? '✈️ Járatszám (opcionális)' : '✈️ Flight number (optional)'}
              value={flightNumber}
              onChangeText={v => setFlightNumber(v.toUpperCase())}
              placeholder="e.g. FR1234"
              autoCapitalize="characters"
              maxLength={10}
            />

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
          </Animated.View>
        )}

        {step === 2 && (
          <Animated.View key="step2" entering={FadeInDown.duration(200)}>
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
              {promoApplied && promoDiscount > 0 && (
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: C.success }]}>
                    Promo ({promoCode})
                  </Text>
                  <Text style={[styles.priceValue, { color: C.success }]}>
                    -{formatEURDecimal(promoDiscount)}
                  </Text>
                </View>
              )}
              <View style={[styles.priceRow, styles.priceTotal]}>
                <Text style={styles.priceTotalLabel}>Total now</Text>
                <Text style={styles.priceTotalValue}>{formatEURDecimal(grandTotal)}</Text>
              </View>
              {effectiveDeposit > 0 ? (
                <>
                  <View style={styles.depositRow}>
                    <Text style={styles.depositLabel}>🔒 {t('depositHoldLabel', language)}</Text>
                    <Text style={styles.depositValue}>{formatEURDecimal(effectiveDeposit)}</Text>
                  </View>
                  <Text style={styles.depositNote}>
                    {t('depositHoldNote', language).replace('{amount}', formatEURDecimal(effectiveDeposit))}
                  </Text>
                </>
              ) : (
                <View style={styles.depositRow}>
                  <Text style={styles.depositLabel}>✓ No deposit required</Text>
                  <Text style={[styles.depositValue, { color: C.success }]}>Included</Text>
                </View>
              )}
              <View style={styles.trustRow}>
                <Text style={styles.trustItem}>✓ Free cancel until 48h before</Text>
                <Text style={styles.trustItem}>✓ No hidden fees</Text>
              </View>
            </View>

            {/* Promo code */}
            <View style={styles.promoRow}>
              <TextInput
                style={styles.promoInput}
                value={promoCode}
                onChangeText={v => {
                  setPromoCode(v)
                  if (promoApplied) {
                    setPromoApplied(false)
                    setPromoDiscount(0)
                  }
                }}
                placeholder={
                  language === 'hu'
                    ? 'Promo kód (pl. WELCOME10)'
                    : language === 'es'
                      ? 'Código promo (ej. WELCOME10)'
                      : 'Promo code (e.g. WELCOME10)'
                }
                placeholderTextColor={C.textTertiary}
                autoCapitalize="characters"
                accessibilityLabel="Promo code input"
              />
              <TouchableOpacity
                style={[styles.promoBtn, promoApplied && styles.promoBtnApplied]}
                onPress={() => void applyPromo()}
                disabled={promoLoading || !promoCode.trim()}
                accessibilityLabel="Apply promo code"
                accessibilityRole="button"
              >
                {promoLoading ? (
                  <ActivityIndicator color={C.background} size="small" />
                ) : (
                  <Text style={styles.promoBtnText}>{promoApplied ? '✓' : 'Apply'}</Text>
                )}
              </TouchableOpacity>
            </View>
            {promoApplied && promoDiscount > 0 && (
              <Text style={styles.promoSaved}>
                {language === 'hu'
                  ? `Megtakarítás: -${formatEURDecimal(promoDiscount)}`
                  : language === 'es'
                    ? `Ahorro: -${formatEURDecimal(promoDiscount)}`
                    : `You save -${formatEURDecimal(promoDiscount)}`}
              </Text>
            )}

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
                    backgroundColor: C.surface,
                    textColor: C.text,
                    placeholderColor: C.textSecondary,
                    borderColor: C.border,
                    borderWidth: 1,
                    borderRadius: 8,
                  }}
                />
              </View>
            )}

            <View style={styles.trustGrid}>
              {([
                { icon: 'lock-closed', text: 'Stripe secure' },
                { icon: 'checkmark-circle', text: 'No hidden fees' },
                { icon: 'checkmark-circle', text: 'Cancel anytime' },
                { icon: 'arrow-undo', text: 'Money back' },
              ] as const).map(item => (
                <View key={item.text} style={styles.trustGridItem}>
                  <Ionicons name={item.icon} size={14} color={C.success} style={styles.trustGridIcon} />
                  <Text style={styles.trustGridText}>{item.text}</Text>
                </View>
              ))}
            </View>

            <AnimatedButton
              title={`Pay ${formatEURDecimal(grandTotal)} →`}
              onPress={() => void handlePayment()}
              loading={submitting}
              disabled={submitted || !guestName.trim() || (!Config.useMock && !cardComplete)}
              accessibilityLabel={`Pay ${formatEURDecimal(grandTotal)}`}
              fullWidth
              style={styles.payBtn}
              textStyle={styles.payBtnText}
            />
            <Text style={styles.secureNote}>🔒 Secure payment · SSL encrypted</Text>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },

    // Identity verification gate
    vgContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    vgIcon: { fontSize: 56, marginBottom: 16 },
    vgTitle: { color: C.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
    vgDesc: { color: C.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    vgButton: {
      backgroundColor: C.primary,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 14,
      minHeight: 52,
      alignItems: 'center',
      width: '100%',
    },
    vgButtonText: { color: C.background, fontSize: 16, fontWeight: '700' },

    summaryCard: {
      backgroundColor: C.surface, borderRadius: Radius.xl,
      overflow: 'hidden', marginBottom: Spacing.xl,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    },
    summaryImage: { width: '100%', height: 140 },
    summaryImagePlaceholder: {
      backgroundColor: C.surfaceWarm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryImagePlaceholderText: { fontSize: 48 },
    summaryBody: { padding: Spacing.base },
    summaryTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 2 },
    summaryOp: { fontSize: 12, color: C.textSecondary, marginBottom: Spacing.md },
    summaryDatesRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      backgroundColor: C.surfaceWarm, borderRadius: Radius.lg, padding: Spacing.sm,
    },
    summaryDateBlock: { flex: 1 },
    summaryDateLabel: { fontSize: 10, color: C.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
    summaryDateValue: { fontSize: 13, fontWeight: '700', color: C.text },
    summaryArrow: { paddingHorizontal: Spacing.xs },
    summaryArrowText: { fontSize: 16, color: C.textTertiary },
    summaryDaysBlock: { alignItems: 'center', paddingLeft: Spacing.sm, borderLeftWidth: 1, borderLeftColor: C.border },
    summaryDaysNum: { fontSize: 20, fontWeight: '800', color: C.primary },
    summaryDaysLabel: { fontSize: 10, color: C.textTertiary, fontWeight: '600' },

    formTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: Spacing.base, marginTop: Spacing.xl },
    timeSlots: { gap: Spacing.sm, paddingVertical: Spacing.xs },
    timeSlot: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
    },
    timeSlotActive: { backgroundColor: C.primary, borderColor: C.primary },
    timeSlotText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
    timeSlotTextActive: { color: C.textInverse },

    priceCard: {
      backgroundColor: C.surface, borderRadius: Radius.xl,
      padding: Spacing.base, marginBottom: Spacing.base,
      borderWidth: 1, borderColor: C.border,
    },
    priceCardTitle: { fontSize: 13, fontWeight: '700', color: C.textTertiary, textTransform: 'uppercase', marginBottom: Spacing.md },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
    priceLabel: { fontSize: 14, color: C.textSecondary },
    priceValue: { fontSize: 14, color: C.text, fontWeight: '600' },
    priceTotal: {
      borderTopWidth: 1, borderTopColor: C.border,
      paddingTop: Spacing.sm, marginTop: Spacing.xs,
    },
    priceTotalLabel: { fontSize: 15, fontWeight: '700', color: C.text },
    priceTotalValue: { fontSize: 18, fontWeight: '800', color: C.primary },
    depositRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      marginTop: Spacing.sm, paddingTop: Spacing.sm,
      borderTopWidth: 1, borderTopColor: C.border,
    },
    depositLabel: { fontSize: 13, color: C.textSecondary },
    depositNote: { fontSize: 12, color: C.textTertiary, lineHeight: 18, marginTop: Spacing.xs },
    depositValue: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
    trustRow: { marginTop: Spacing.md, gap: 4 },
    trustItem: { fontSize: 12, color: C.success, fontWeight: '500' },

    promoRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
    promoInput: {
      flex: 1,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: Radius.sm,
      color: C.text,
      paddingHorizontal: Spacing.md,
      fontSize: 14,
      minHeight: 44,
    },
    promoBtn: {
      backgroundColor: C.primary,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.base,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    promoBtnApplied: { backgroundColor: C.success },
    promoBtnText: { color: C.background, fontWeight: '700', fontSize: 14 },
    promoSaved: { color: C.success, fontSize: 13, marginBottom: Spacing.sm, fontWeight: '600' },

    guestRecap: {
      backgroundColor: C.surface, borderRadius: Radius.lg,
      padding: Spacing.base, marginBottom: Spacing.base,
      borderLeftWidth: 3, borderLeftColor: C.primary,
    },
    guestRecapTitle: { fontSize: 11, fontWeight: '700', color: C.textTertiary, textTransform: 'uppercase', marginBottom: 4 },
    guestRecapName: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
    guestRecapContact: { fontSize: 13, color: C.textSecondary },

    trustGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
      marginBottom: Spacing.xl,
      backgroundColor: C.surfaceWarm, borderRadius: Radius.lg,
      padding: Spacing.base, borderWidth: 1, borderColor: C.borderWarm,
    },
    trustGridItem: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    trustGridIcon: { fontSize: 14, width: 20, textAlign: 'center' },
    trustGridText: { fontSize: 12, color: C.textSecondary, fontWeight: '500' },

    cardFieldWrapper: { marginBottom: Spacing.base },
    cardLabel: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: Spacing.sm },
    cardField: { height: 50, marginBottom: 4 },

    payBtn: {
      backgroundColor: C.primary, borderRadius: Radius.pill,
      paddingVertical: Spacing.base, alignItems: 'center',
      marginBottom: Spacing.sm,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
      minHeight: 52, justifyContent: 'center',
    },
    payBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
    payBtnText: { color: C.textInverse, fontWeight: '800', fontSize: 17 },
    secureNote: { fontSize: 12, color: C.textTertiary, textAlign: 'center', marginTop: Spacing.sm },

    rentalTypeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
    typeChip: {
      flex: 1, padding: Spacing.md, borderRadius: Radius.sm,
      borderWidth: 1, borderColor: C.border,
      alignItems: 'center', minHeight: 44, justifyContent: 'center',
    },
    typeChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    typeChipText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
    typeChipTextActive: { color: C.background },
    hourlySection: { marginBottom: Spacing.base },
    slotBtn: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.sm,
      borderWidth: 1, borderColor: C.border,
      marginRight: Spacing.sm, minHeight: 44, justifyContent: 'center',
    },
    slotBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    slotText: { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
    slotTextActive: { color: C.background },
    hoursRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    hourlyTotal: { color: C.primary, fontSize: 18, fontWeight: '700', marginTop: Spacing.md },
  })
}
