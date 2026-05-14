import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { differenceInDays } from 'date-fns'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ListingCarousel } from '@/components/listing/ListingCarousel'
import { ListingFeatures } from '@/components/listing/ListingFeatures'
import { AvailabilityCalendar } from '@/components/listing/AvailabilityCalendar'
import { BookingBar } from '@/components/listing/BookingBar'
import { OperatorCard } from '@/components/listing/OperatorCard'
import { ReviewCard } from '@/components/listing/ReviewCard'
import { StarRating } from '@/components/ui/StarRating'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { useListing } from '@/lib/hooks/useListing'
import { calculatePrice } from '@/lib/utils/calculatePrice'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { getCategoryEmoji, getCategoryLabel } from '@/constants/categories'
import { Config } from '@/constants/config'
import { MOCK_REVIEWS } from '@/lib/mockData'

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { listing, loading, error } = useListing(id ?? '')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showFullDesc, setShowFullDesc] = useState(false)

  if (loading) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>
  if (error || !listing) return <ErrorState message={error ?? 'Listing not found'} />

  const totalDays = startDate && endDate ? Math.max(1, differenceInDays(endDate, startDate)) : null
  const priceCalc = totalDays
    ? calculatePrice(listing.price_per_day, totalDays, listing.deposit_amount, listing.price_per_week)
    : null

  const weeklyPrice = listing.price_per_week
  const weeklySavings = weeklyPrice
    ? Math.round((1 - (weeklyPrice / (listing.price_per_day * 7))) * 100)
    : 0

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <ListingCarousel images={listing.images} height={280} />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {listing.operator && (
            <View style={styles.opRow}>
              <Text style={styles.opName}>{listing.operator.name}</Text>
              {listing.operator.verified && <Text style={styles.verified}> ✓</Text>}
              <StarRating rating={listing.rating} reviewCount={listing.review_count} size={13} />
            </View>
          )}

          <Text style={styles.title}>{listing.title}</Text>

          <View style={styles.metaRow}>
            <Badge label={`${getCategoryEmoji(listing.category)} ${getCategoryLabel(listing.category)}`} variant="neutral" />
            <Text style={styles.location}> {listing.operator?.city}, {listing.operator?.country}</Text>
          </View>

          {(listing.make || listing.model) && (
            <Text style={styles.makeModel}>
              {[listing.make, listing.model, listing.year, listing.color].filter(Boolean).join(' · ')}
            </Text>
          )}

          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.priceMain}>{formatEURDecimal(listing.price_per_day)}</Text>
              <Text style={styles.priceUnit}> / day</Text>
            </View>
            {weeklyPrice && weeklySavings > 5 && (
              <Text style={styles.weeklyPrice}>
                {formatEURDecimal(weeklyPrice)} / week (save {weeklySavings}%)
              </Text>
            )}
            {listing.deposit_amount > 0 && (
              <Text style={styles.deposit}>
                Security deposit: {formatEURDecimal(listing.deposit_amount)} (refundable)
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.dateSelector}
            onPress={() => setShowCalendar(!showCalendar)}
          >
            <Text style={styles.dateSelectorIcon}>📅</Text>
            <Text style={styles.dateSelectorText}>
              {startDate && endDate
                ? `${startDate.toLocaleDateString('en-GB')} → ${endDate.toLocaleDateString('en-GB')}`
                : 'Select dates'}
            </Text>
          </TouchableOpacity>

          {showCalendar && (
            <View style={styles.calendarContainer}>
              <AvailabilityCalendar
                onRangeSelect={(s, e) => { setStartDate(s); setEndDate(e) }}
                selectedStart={startDate}
                selectedEnd={endDate}
              />
              {priceCalc && (
                <View style={styles.pricePreview}>
                  <Text style={styles.pricePreviewText}>
                    {totalDays} days · {formatEURDecimal(priceCalc.subtotal)} + {formatEURDecimal(priceCalc.platformFee)} fee = {formatEURDecimal(priceCalc.total)}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            <ListingFeatures features={listing.features} />
          </View>

          {listing.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.desc} numberOfLines={showFullDesc ? undefined : 4}>
                {listing.description}
              </Text>
              <TouchableOpacity onPress={() => setShowFullDesc(v => !v)}>
                <Text style={styles.showMore}>{showFullDesc ? 'Show less' : 'Show more'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {listing.rules && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rules</Text>
              <View style={styles.rulesBox}>
                <Text style={styles.rulesText}>⚠️ {listing.rules}</Text>
              </View>
            </View>
          )}

          {listing.review_count > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              <StarRating rating={listing.rating} reviewCount={listing.review_count} size={16} />
              {Config.useMock && MOCK_REVIEWS.map(r => (
                <ReviewCard key={r.id} review={r} userName="Test User" />
              ))}
            </View>
          )}

          {listing.operator && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About the operator</Text>
              <OperatorCard operator={listing.operator} />
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <BookingBar
        pricePerDay={listing.price_per_day}
        totalDays={totalDays ?? undefined}
        totalAmount={priceCalc?.total}
        disabled={!startDate || !endDate}
        onPress={() => {
          if (startDate && endDate) {
            router.push(`/(consumer)/booking/${listing.id}`)
          } else {
            setShowCalendar(true)
          }
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  imageContainer: { position: 'relative' },
  backBtn: {
    position: 'absolute',
    top: 44,
    left: Spacing.base,
    backgroundColor: Colors.overlay,
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: Colors.textInverse, fontSize: 18, fontWeight: '700' },
  content: { padding: Spacing.base },
  opRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  opName: { fontSize: 13, color: Colors.textSecondary, marginRight: 2 },
  verified: { color: Colors.success, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  location: { fontSize: 13, color: Colors.textTertiary },
  makeModel: { fontSize: 13, color: Colors.textTertiary, marginBottom: Spacing.base },
  priceSection: { marginBottom: Spacing.base },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceMain: { fontSize: 26, fontWeight: '800', color: Colors.text },
  priceUnit: { fontSize: 15, color: Colors.textSecondary },
  weeklyPrice: { fontSize: 13, color: Colors.success, marginTop: 4 },
  deposit: { fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: Colors.primarySurface,
  },
  dateSelectorIcon: { fontSize: 18, marginRight: Spacing.sm },
  dateSelectorText: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  calendarContainer: { marginBottom: Spacing.base },
  pricePreview: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  pricePreviewText: { fontSize: 14, color: Colors.primaryDark, fontWeight: '600', textAlign: 'center' },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: Colors.textTertiary, marginBottom: Spacing.md },
  desc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  showMore: { color: Colors.primary, fontWeight: '600', marginTop: Spacing.xs, fontSize: 14 },
  rulesBox: { backgroundColor: Colors.warningSurface, borderRadius: Radius.lg, padding: Spacing.md },
  rulesText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
})
