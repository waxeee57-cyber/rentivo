import React, { useState, useRef, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { useBooking } from '@/lib/hooks/useBookings'
import { useToastStore } from '@/lib/store/useToastStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import { Config } from '@/constants/config'
import { formatDateRange } from '@/lib/utils/formatDate'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/hooks/useColors'

const REVIEW_TAGS = [
  { key: 'clean', label: 'Clean ✓' },
  { key: 'fast_response', label: 'Fast response ✓' },
  { key: 'as_described', label: 'As described ✓' },
  { key: 'good_value', label: 'Good value ✓' },
  { key: 'great_host', label: 'Great host ✓' },
  { key: 'perfect_car', label: 'Perfect car ✓' },
]

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const C = useColors()
  const starStyles = useMemo(() => StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
    star: { fontFamily: Fonts.regular, fontSize: 44, color: C.primary },
  }), [C])
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

export default function ReviewScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const id = Config.useMock ? (bookingId ?? 'bk-004') : (bookingId ?? '')
  const { booking } = useBooking(id)
  const { showToast } = useToastStore()
  const { user, language } = useAuthStore()
  const RATING_LABELS = useMemo(
    () => ['', t('cbkRating1', language), t('cbkRating2', language), t('cbkRating3', language), t('cbkRating4', language), t('cbkRating5', language)],
    [language],
  )

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
      showToast({ message: t('cbkMustBeLoggedIn', language), type: 'error' })
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
      showToast({ message: t('cbkReviewSubmitted', language), type: 'success' })
    } catch {
      showToast({ message: t('cbkReviewSubmitFailed', language), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={72} color={C.success} style={styles.confetti} importantForAccessibility="no" />
          <Text style={styles.successTitle}>{t('cbkThankYou', language)}</Text>
          <Text style={styles.successSubtitle}>
            {t('cbkReviewHelps', language)}
          </Text>
          <Button
            title={t('cbkBackToBookings', language)}
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
      <ScreenHeader title={t('leaveReview', language)} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {booking && (
          <View style={styles.vehicleCard}>
            <Text style={styles.vehicleTitle}>{booking.listing?.title ?? t('cbkYourRental', language)}</Text>
            <Text style={styles.vehicleOp}>{booking.operator?.name}</Text>
            <Text style={styles.vehicleDates}>
              {formatDateRange(booking.start_date, booking.end_date)} · {booking.total_days} days
            </Text>
          </View>
        )}

        {/* Step 1: Star rating */}
        <Text style={styles.sectionTitle}>{t('cbkOverallRating', language)}</Text>
        <StarPicker value={rating} onChange={setRating} />
        {rating > 0 && (
          <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
        )}

        {/* Step 2: Category tags */}
        {rating > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
              {t('cbkWhatWasGreat', language)}
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
              {t('cbkTellOthers', language)}
            </Text>
            <TextInput
              style={styles.reviewInput}
              multiline
              numberOfLines={5}
              placeholder={t('cbkDescribeExperience', language)}
              placeholderTextColor={C.textTertiary}
              value={comment}
              onChangeText={setComment}
              maxLength={500}
              accessibilityLabel={t('cbkWrittenReview', language)}
            />
            <Text style={styles.charCount}>{comment.length}/500</Text>
          </>
        )}

        <Button
          title={submitting ? t('cbkSubmitting', language) : t('cbkSubmitReview', language)}
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

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  vehicleCard: {
    backgroundColor: C.surface, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.xl,
  },
  vehicleTitle: { fontSize: 17, fontFamily: Fonts.bold, color: C.text, marginBottom: 4 },
  vehicleOp: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, marginBottom: 2 },
  vehicleDates: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary },
  sectionTitle: {
    fontSize: 12, fontFamily: Fonts.bold, color: C.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: Spacing.base, textAlign: 'center',
  },
  ratingLabel: {
    fontSize: 16, fontFamily: Fonts.bold, color: C.primary,
    textAlign: 'center', marginTop: Spacing.sm,
  },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
  tagChip: {
    paddingHorizontal: 14, paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface,
  },
  tagChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  tagChipText: { fontSize: 13, fontFamily: Fonts.semibold, color: C.textSecondary },
  tagChipTextActive: { color: C.textInverse },
  reviewInput: {
    backgroundColor: C.surface, borderRadius: Radius.lg,
    padding: Spacing.base, fontFamily: Fonts.regular, fontSize: 14, color: C.text,
    minHeight: 120, textAlignVertical: 'top',
    borderWidth: 1, borderColor: C.border, lineHeight: 22,
  },
  charCount: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, textAlign: 'right', marginTop: Spacing.xs },
  submitBtn: { marginTop: Spacing.xl },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  confetti: { marginBottom: Spacing.xl },
  successTitle: { fontSize: 28, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.md },
  successSubtitle: { fontFamily: Fonts.regular, fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22 },
  })
}
