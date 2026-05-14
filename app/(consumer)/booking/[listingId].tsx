import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { differenceInDays, addDays } from 'date-fns'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { PriceBreakdown } from '@/components/booking/PriceBreakdown'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useListing } from '@/lib/hooks/useListing'
import { calculatePrice } from '@/lib/utils/calculatePrice'
import { formatDateRange } from '@/lib/utils/formatDate'
import { Config } from '@/constants/config'

export default function BookingFlowScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>()
  const { listing, loading } = useListing(listingId ?? '')
  const [step, setStep] = useState(1)
  const [guestName, setGuestName] = useState(Config.useMock ? 'Test User' : '')
  const [guestPhone, setGuestPhone] = useState(Config.useMock ? '+36701234567' : '')
  const [guestEmail, setGuestEmail] = useState(Config.useMock ? 'test@example.com' : '')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)

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
    if (!guestName.trim() || !guestPhone.trim()) {
      Alert.alert('Missing info', 'Please fill in your name and phone number.')
      return
    }
    setProcessing(true)
    await new Promise(r => setTimeout(r, 1500))
    setProcessing(false)
    router.replace(`/(consumer)/booking/confirmation/mock-booking-001`)
  }

  const steps = ['Trip details', 'Review & Pay', 'Confirmed']

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(s => s - 1) : router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>Step {step} of 2</Text>
      </View>

      <View style={styles.progressRow}>
        {[1, 2].map(s => (
          <View key={s} style={[styles.stepDot, s <= step && styles.stepDotActive, s < step && styles.stepDotDone]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Trip Details</Text>

            <Card style={{ marginBottom: Spacing.base }}>
              <Text style={styles.vehicleTitle}>{listing.title}</Text>
              <Text style={styles.dates}>{formatDateRange(startDate, endDate)} · {totalDays} days</Text>
            </Card>

            <PriceBreakdown calculation={priceCalc} />

            <Text style={styles.formTitle}>Guest Information</Text>
            <Input label="Full name *" value={guestName} onChangeText={setGuestName} placeholder="John Smith" />
            <Input label="Phone number *" value={guestPhone} onChangeText={setGuestPhone} placeholder="+34 600 000 000" keyboardType="phone-pad" />
            <Input label="Email" value={guestEmail} onChangeText={setGuestEmail} placeholder="john@example.com" keyboardType="email-address" />
            <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Special requests..." multiline numberOfLines={3} />

            <Button
              title="Continue →"
              onPress={() => setStep(2)}
              fullWidth
              style={{ marginTop: Spacing.md }}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>Review & Pay</Text>

            <Card style={{ marginBottom: Spacing.base }}>
              <Text style={styles.vehicleTitle}>{listing.title}</Text>
              <Text style={styles.dates}>{formatDateRange(startDate, endDate)} · {totalDays} days</Text>
            </Card>

            <PriceBreakdown calculation={priceCalc} />

            <Card style={{ marginTop: Spacing.base, alignItems: 'center' }}>
              <Text style={styles.stripeNote}>💳 Payment powered by Stripe</Text>
              <Text style={styles.stripeNote2}>Card processing will happen at checkout</Text>
            </Card>

            <Button
              title={`Pay ${(priceCalc.total / 100).toFixed(2)} EUR`}
              onPress={handlePayment}
              loading={processing}
              fullWidth
              style={{ marginTop: Spacing.xl }}
            />
            <Text style={styles.secureNote}>🔒 Secure payment via Stripe</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  back: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  stepLabel: { fontSize: 13, color: Colors.textSecondary },
  progressRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  stepDot: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
  },
  stepDotActive: { backgroundColor: Colors.primaryLight },
  stepDotDone: { backgroundColor: Colors.primary },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  stepTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: Spacing.xl },
  vehicleTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  dates: { fontSize: 13, color: Colors.textSecondary },
  formTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: Spacing.base, marginTop: Spacing.xl },
  stripeNote: { fontSize: 16, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  stripeNote2: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: 4 },
  secureNote: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.sm },
})
