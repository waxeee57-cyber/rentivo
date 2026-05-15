import React, { useState, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { useBooking } from '@/lib/hooks/useBookings'
import { useToastStore } from '@/lib/store/useToastStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { formatDateRange } from '@/lib/utils/formatDate'
import { supabase } from '@/lib/supabase'

const RATING_LABELS = ['', 'Terrible', 'Poor', 'OK', 'Good', 'Excellent!']

const REVIEW_TAGS = [
  { key: 'clean', label: 'Clean ✓' },
  { key: 'fast_response', label: 'Fast response ✓' },
  { key: 'as_described', label: 'As described ✓' },
  { key: 'good_value', label: 'Good value ✓' },
  { key: 'great_host', label: 'Great host ✓' },
  { key: 'perfect_car', label: 'Perfect car ✓' },
]

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const scales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current

  const handlePress = (star: number) => {
    onChange(star)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Animated.sequence([
      Animated.timing(scales[star - 1], { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.spring(scales[star - 1], { toValue: 1.0, useNativeDriver: true }),
    ]).start()
  }

  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity
          key={star}
          onPress={() => handlePress(star)}
          accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
          accessibilityRole="button"
        >
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
  const { showToast } = useToastStore()
  const user = useAuthStore(s => s.user)

  const [rating, setRating] = useState(0)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const canSubmit = rating > 0

  const toggleTag = (key: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedTags(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key],
    )
  }

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    if (!user) {
      showToast({ message: 'You must be logged in to submit a review.', type: 'error' })
      return
    }
    setSubmitting(true)
    try {
      if (!Config.useMock) {
        const fullComment = [
          selectedTags.map(t => REVIEW_TAGS.find(r => r.key === t)?.label ?? '').join(', '),
          comment.trim(),
        ].filter(Boolean).join('\n\n')

        const { error } = await supabase.from('rentivo_reviews').insert({
          booking_id: id,
          listing_id: booking?.listing_id ?? '',
          operator_id: booking?.operator_id ?? '',
          user_id: user.id,
          rating,
          comment: fullComment || null,
        })
        if (error) throw error
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setDone(true)
      showToast({ message: 'Review submitted! ⭐', type: 'success' })
    } catch {
      showToast({ message: 'Failed to submit review. Please try again.', type: 'error' })
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
              {formatDateRange(booking.start_date, booking.end_date)} · {booking.total_days} days
            </Text>
          </View>
        )}

        {/* Step 1: Star rating */}
        <Text style={styles.sectionTitle}>Overall Rating</Text>
        <StarPicker value={rating} onChange={setRating} />
        {rating > 0 && (
          <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
        )}

        {/* Step 2: Category tags */}
        {rating > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
              What was great? (optional)
            </Text>
            <View style={styles.tagsGrid}>
              {REVIEW_TAGS.map(tag => {
                const selected = selectedTags.includes(tag.key)
                return (
                  <TouchableOpacity
                    key={tag.key}
                    style={[styles.tagChip, selected && styles.tagChipActive]}
                    onPress={() => toggleTag(tag.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <Text style={[styles.tagChipText, selected && styles.tagChipTextActive]}>
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
        )}

        {/* Step 3: Written review */}
        {rating > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
              Tell others about your experience (optional)
            </Text>
            <TextInput
              style={styles.reviewInput}
              multiline
              numberOfLines={5}
              placeholder="Describe your experience..."
              placeholderTextColor={Colors.textTertiary}
              value={comment}
              onChangeText={setComment}
              maxLength={500}
              accessibilityLabel="Written review"
            />
            <Text style={styles.charCount}>{comment.length}/500</Text>
          </>
        )}

        <Button
          title={submitting ? 'Submitting...' : 'Submit Review ⭐'}
          onPress={() => void handleSubmit()}
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
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.xl,
  },
  vehicleTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  vehicleOp: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },
  vehicleDates: { fontSize: 12, color: Colors.textTertiary },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: Spacing.base, textAlign: 'center',
  },
  ratingLabel: {
    fontSize: 16, fontWeight: '700', color: Colors.primary,
    textAlign: 'center', marginTop: Spacing.sm,
  },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
  tagChip: {
    paddingHorizontal: 14, paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tagChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tagChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tagChipTextActive: { color: Colors.textInverse },
  reviewInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.base, fontSize: 14, color: Colors.text,
    minHeight: 120, textAlignVertical: 'top',
    borderWidth: 1, borderColor: Colors.border, lineHeight: 22,
  },
  charCount: { fontSize: 12, color: Colors.textTertiary, textAlign: 'right', marginTop: Spacing.xs },
  submitBtn: { marginTop: Spacing.xl },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  confetti: { fontSize: 72, marginBottom: Spacing.xl },
  successTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  successSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
})
