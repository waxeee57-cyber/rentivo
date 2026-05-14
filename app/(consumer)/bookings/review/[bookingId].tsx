import React, { useState, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { useBooking } from '@/lib/hooks/useBookings'
import { Config } from '@/constants/config'
import { supabase } from '@/lib/supabase'

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const scales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current

  const handlePress = (star: number) => {
    onChange(star)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Animated.sequence([
      Animated.timing(scales[star - 1], { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.spring(scales[star - 1], { toValue: 1, useNativeDriver: true }),
    ]).start()
  }

  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity key={star} onPress={() => handlePress(star)}>
          <Animated.Text style={[starStyles.star, { transform: [{ scale: scales[star - 1] }] }]}>
            {star <= value ? '★' : '☆'}
          </Animated.Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  star: { fontSize: 44, color: Colors.primary },
})

export default function ReviewScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const id = Config.useMock ? (bookingId ?? 'bk-004') : (bookingId ?? '')
  const { booking } = useBooking(id)

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const canSubmit = rating > 0 && comment.trim().length >= 10

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      if (!Config.useMock) {
        const { error } = await supabase.from('rentivo_reviews').insert({
          booking_id: id,
          listing_id: booking?.listing_id ?? '',
          operator_id: booking?.operator_id ?? '',
          user_id: null,
          rating,
          comment: comment.trim(),
        })
        if (error) throw error
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setDone(true)
    } catch (e) {
      Alert.alert('Error', 'Failed to submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <Text style={styles.confetti}>🎉</Text>
          <Text style={styles.successTitle}>Thank you!</Text>
          <Text style={styles.successSubtitle}>
            Your review helps others choose the right rental.
          </Text>
          <Button
            title="Back to Bookings"
            onPress={() => router.replace('/(consumer)/bookings')}
            fullWidth
            style={{ marginTop: Spacing.xl }}
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Leave a Review" />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {booking && (
          <View style={styles.vehicleCard}>
            <Text style={styles.vehicleTitle}>{booking.listing?.title ?? 'Your Rental'}</Text>
            <Text style={styles.vehicleOp}>{booking.operator?.name}</Text>
            <Text style={styles.vehicleDates}>
              {booking.start_date} – {booking.end_date} · {booking.total_days} days
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Overall Rating</Text>
        <StarPicker value={rating} onChange={setRating} />
        {rating > 0 && (
          <Text style={styles.ratingLabel}>
            {rating === 5 ? 'Excellent!' : rating === 4 ? 'Very good' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
          </Text>
        )}

        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Your Review</Text>
        <TextInput
          style={styles.reviewInput}
          multiline
          numberOfLines={5}
          placeholder="Tell others about your experience..."
          placeholderTextColor={Colors.textTertiary}
          value={comment}
          onChangeText={setComment}
          maxLength={1000}
        />
        <Text style={styles.charCount}>{comment.length}/1000 · min 10 characters</Text>

        <Button
          title={submitting ? 'Submitting...' : 'Submit Review'}
          onPress={handleSubmit}
          fullWidth
          disabled={!canSubmit || submitting}
          style={styles.submitBtn}
        />

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  vehicleCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
  },
  vehicleTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  vehicleOp: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },
  vehicleDates: { fontSize: 12, color: Colors.textTertiary },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.base,
    textAlign: 'center',
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  reviewInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    fontSize: 14,
    color: Colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
    lineHeight: 22,
  },
  charCount: { fontSize: 12, color: Colors.textTertiary, textAlign: 'right', marginTop: Spacing.xs },
  submitBtn: { marginTop: Spacing.xl },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  confetti: { fontSize: 72, marginBottom: Spacing.xl },
  successTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  successSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
})
