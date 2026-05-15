import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Share, Platform, Linking, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { differenceInDays } from 'date-fns'
import { formatDateRange } from '@/lib/utils/formatDate'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ListingCarousel } from '@/components/listing/ListingCarousel'
import { ListingFeatures } from '@/components/listing/ListingFeatures'
import { DatePickerSheet } from '@/components/booking/DatePickerSheet'
import { OperatorCard } from '@/components/listing/OperatorCard'
import { ReviewCard } from '@/components/listing/ReviewCard'
import { StarRating } from '@/components/ui/StarRating'
import { Divider } from '@/components/ui/Divider'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { useListing } from '@/lib/hooks/useListing'
import { calculatePrice } from '@/lib/utils/calculatePrice'
import { formatEUR, formatEURDecimal } from '@/lib/utils/formatCurrency'
import { getCategoryEmoji, getCategoryLabel } from '@/constants/categories'
import { getCancellationPolicyEmoji, getCancellationPolicyLabel } from '@/lib/utils/cancellation'
import { Config } from '@/constants/config'
import { MOCK_REVIEWS, MOCK_LISTINGS } from '@/lib/mockData'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { CancellationPolicy } from '@/types'

const { height: screenHeight } = Dimensions.get('window')
const HERO_HEIGHT = Math.round(screenHeight * 0.52)

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { listing, loading, error } = useListing(id ?? '')
  const { language } = useAuthStore()
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showFullDesc, setShowFullDesc] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const insets = useSafeAreaInsets()

  if (loading) return <View style={styles.container}><SkeletonCard /></View>
  if (error || !listing) return <ErrorState message={error ?? 'Listing not found'} />

  const totalDays = startDate && endDate ? Math.max(1, differenceInDays(endDate, startDate)) : null
  const priceCalc = totalDays
    ? calculatePrice(listing.price_per_day, totalDays, listing.deposit_amount, listing.price_per_week)
    : null

  const weeklyPrice = listing.price_per_week
  const weeklySavings = weeklyPrice
    ? Math.round((1 - (weeklyPrice / (listing.price_per_day * 7))) * 100)
    : 0

  const dateLabel = startDate && endDate
    ? `${formatDateRange(startDate, endDate)} · ${totalDays} ${t('days', language)}`
    : t('checkInOut', language)

  const policy = (listing.cancellation_policy ?? 'moderate') as CancellationPolicy

  const isHostListing = listing.owner_type === 'host'

  const { user } = useAuthStore()

  const handleReport = () => {
    const reasons = [
      { label: language === 'hu' ? 'Hamis hirdetés' : 'Fake listing', value: 'fake_listing' },
      { label: language === 'hu' ? 'Illegális jármű' : 'Illegal vehicle', value: 'illegal_vehicle' },
      { label: language === 'hu' ? 'Félrevezető információ' : 'Misleading info', value: 'misleading_info' },
      { label: language === 'hu' ? 'Egyéb' : 'Other', value: 'other' },
    ]
    Alert.alert(
      language === 'hu' ? 'Hirdetés bejelentése' : 'Report listing',
      language === 'hu' ? 'Válaszd ki a bejelentés okát:' : 'Select a reason:',
      [
        ...reasons.map(r => ({
          text: r.label,
          onPress: async () => {
            try {
              const { supabase: sb } = await import('@/lib/supabase')
              await sb.from('rentivo_reports').insert({
                reporter_id: user?.id ?? null,
                listing_id: listing.id,
                operator_id: listing.operator_id ?? null,
                reason: r.value,
              })
              Alert.alert(
                language === 'hu' ? 'Köszönjük' : 'Thank you',
                language === 'hu'
                  ? 'Bejelentésedet megkaptuk. 24 órán belül megvizsgáljuk. DSA 16. cikk.'
                  : 'We received your report. We will review it within 24 hours. DSA Article 16.',
              )
            } catch {
              Alert.alert(
                language === 'hu' ? 'Hiba' : 'Error',
                language === 'hu' ? 'Nem sikerült bejelenteni.' : 'Could not submit report.',
              )
            }
          },
        })),
        { text: language === 'hu' ? 'Mégse' : 'Cancel', style: 'cancel' },
      ],
    )
  }

  const similarListings = Config.useMock
    ? MOCK_LISTINGS.filter(l => {
        if (l.id === listing.id) return false
        if (isHostListing) return l.host_id === listing.host_id && l.id !== listing.id
        return l.operator_id === listing.operator_id
      }).slice(0, 3)
    : []

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <View style={{ height: HERO_HEIGHT, position: 'relative' }}>
          <ListingCarousel images={listing.images} height={HERO_HEIGHT} />

          <View style={styles.heroGradient} pointerEvents="none" />

          <View style={styles.heroBottom} pointerEvents="none">
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>
                {getCategoryEmoji(listing.category)} {getCategoryLabel(listing.category)}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{listing.title}</Text>
            {listing.operator && (
              <View style={styles.heroLocation}>
                <Ionicons name="location" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroLocationText}>
                  {listing.operator.city}, {listing.operator.country}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>

          <View style={[styles.actionBtns, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                void Share.share({
                  title: listing.title,
                  message: `Check out ${listing.title} on Rentivo — ${formatEUR(listing.price_per_day)}/day`,
                })
              }}
              accessibilityLabel="Share this listing"
              accessibilityRole="button"
            >
              <Ionicons name="share-outline" size={18} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                setFavorited(v => !v)
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              }}
              accessibilityLabel={favorited ? 'Remove from favorites' : 'Add to favorites'}
              accessibilityRole="button"
            >
              <Ionicons
                name={favorited ? 'heart' : 'heart-outline'}
                size={18}
                color={favorited ? Colors.error : Colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleReport}
              accessibilityLabel={language === 'hu' ? 'Hirdetés bejelentése' : 'Report this listing'}
              accessibilityRole="button"
            >
              <Ionicons name="flag-outline" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content card */}
        <View style={styles.contentCard}>
          {(listing.operator || listing.host) && (
            <View style={styles.opRow}>
              <View style={styles.opInfo}>
                <Text style={styles.opName}>
                  {isHostListing ? listing.host?.name : listing.operator?.name}
                </Text>
                {(isHostListing ? listing.host?.verified : listing.operator?.verified) && (
                  <View style={styles.verifiedPill}>
                    <Text style={styles.verifiedText}>✓ Verified</Text>
                  </View>
                )}
                {isHostListing ? (
                  <View style={[styles.verifiedPill, styles.hostPill]}>
                    <Text style={[styles.verifiedText, styles.hostPillText]}>👤 Private host</Text>
                  </View>
                ) : (
                  <View style={[styles.verifiedPill, styles.bizPill]}>
                    <Text style={[styles.verifiedText, styles.bizPillText]}>✓ Verified Business</Text>
                  </View>
                )}
              </View>
              <StarRating rating={listing.rating} reviewCount={listing.review_count} size={13} />
            </View>
          )}

          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.priceMain}>{formatEUR(listing.price_per_day)}</Text>
              <Text style={styles.priceUnit}>/day</Text>
            </View>
            {weeklyPrice && weeklySavings > 5 && (
              <Text style={styles.weeklyPrice}>
                {formatEURDecimal(weeklyPrice)}/week · save {weeklySavings}%
              </Text>
            )}
          </View>

          <View style={styles.infoChips}>
            {listing.year ? <View style={styles.infoChip}><Text style={styles.infoChipText}>🚗 {listing.year}</Text></View> : null}
            {listing.color ? <View style={styles.infoChip}><Text style={styles.infoChipText}>⚫ {listing.color}</Text></View> : null}
            {listing.capacity ? <View style={styles.infoChip}><Text style={styles.infoChipText}>👥 {listing.capacity} seats</Text></View> : null}
          </View>

          <Divider />

          {listing.features.length > 0 && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('whatsIncluded', language)}</Text>
                <ListingFeatures features={listing.features} />
              </View>
              <Divider />
            </>
          )}

          {/* Insurance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('insurance', language)}</Text>
            <View style={styles.insuranceBox}>
              <Text style={styles.insuranceIcon}>🛡️</Text>
              <View style={styles.insuranceInfo}>
                <Text style={styles.insuranceTitle}>{t('insuranceIncluded', language)}</Text>
                <Text style={styles.insuranceText}>
                  Third-party liability up to €500,000. Vehicle damage excess €500 (reducible with deposit waiver).
                </Text>
              </View>
            </View>
          </View>

          <Divider />

          {/* Cancellation policy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('cancellationPolicy', language)}</Text>
            <View style={styles.policyBadge}>
              <Text style={styles.policyBadgeText}>
                {getCancellationPolicyEmoji(policy)} {getCancellationPolicyLabel(policy)}
              </Text>
            </View>
          </View>

          <Divider />

          {/* Date selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('selectYourDates', language)}</Text>
              <Ionicons name="calendar-outline" size={16} color={Colors.textTertiary} />
            </View>
            <TouchableOpacity
              style={[styles.datePicker, startDate && styles.datePickerActive]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.datePickerText, startDate && styles.datePickerTextActive]}>
                {dateLabel}
              </Text>
            </TouchableOpacity>
          </View>

          {priceCalc && totalDays && (
            <>
              <Divider />
              <View style={[styles.section, styles.priceBreakdown]}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{formatEUR(listing.price_per_day)} × {totalDays} days</Text>
                  <Text style={styles.breakdownValue}>{formatEURDecimal(priceCalc.subtotal)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Service fee (2.5%)</Text>
                  <Text style={styles.breakdownValue}>{formatEURDecimal(priceCalc.platformFee)}</Text>
                </View>
                <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                  <Text style={styles.breakdownTotalLabel}>Total</Text>
                  <Text style={styles.breakdownTotalValue}>{formatEURDecimal(priceCalc.total)}</Text>
                </View>
                {listing.deposit_amount > 0 && (
                  <View style={styles.depositNote}>
                    <Text style={styles.depositNoteText}>
                      🔒 + {formatEURDecimal(listing.deposit_amount)} security deposit hold
                    </Text>
                    <Text style={styles.depositNoteSubtext}>
                      Released automatically 7 days after return if no damage reported.
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

          <Divider />

          {listing.description && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('aboutThisRental', language)}</Text>
                <Text style={styles.desc} numberOfLines={showFullDesc ? undefined : 4}>
                  {listing.description}
                </Text>
                <TouchableOpacity onPress={() => setShowFullDesc(v => !v)}>
                  <Text style={styles.showMore}>{showFullDesc ? t('showLess', language) : t('showMore', language)}</Text>
                </TouchableOpacity>
              </View>
              <Divider />
            </>
          )}

          {listing.rules && (
            <>
              <View style={styles.section}>
                <View style={styles.rulesBox}>
                  <Text style={styles.rulesText}>⚠️ {listing.rules}</Text>
                </View>
              </View>
              <Divider />
            </>
          )}

          {listing.review_count > 0 && (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('reviews', language)}</Text>
                  <StarRating rating={listing.rating} reviewCount={listing.review_count} size={14} />
                </View>
                {Config.useMock && MOCK_REVIEWS.map((r, i) => (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    userName={i === 0 ? 'James K.' : i === 1 ? 'Sophie L.' : 'Carlos M.'}
                  />
                ))}
                {listing.review_count > 2 && (
                  <TouchableOpacity style={styles.seeAllReviews}>
                    <Text style={styles.seeAllReviewsText}>See all {listing.review_count} reviews →</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Divider />
            </>
          )}

          {isHostListing && listing.host && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('aboutTheHost', language)}</Text>
                <View style={styles.hostCard}>
                  <View style={styles.hostCardTop}>
                    <View style={styles.hostAvatar}>
                      <Text style={styles.hostAvatarText}>{listing.host.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                        <Text style={styles.hostName}>{listing.host.name}</Text>
                        {listing.host.verified && (
                          <Text style={styles.hostVerifiedBadge}>✓ Verified</Text>
                        )}
                      </View>
                      <Text style={styles.hostMeta}>
                        ★ {listing.host.rating} · {listing.host.review_count} rentals
                      </Text>
                      <Text style={styles.hostMeta}>
                        {t('respondsIn', language)}{listing.host.response_time}
                      </Text>
                      <Text style={styles.hostMeta}>
                        {t('memberSinceLabel', language)} {new Date(listing.host.member_since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                  </View>
                  {listing.host.bio && (
                    <Text style={styles.hostBio}>"{listing.host.bio}"</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.askQuestionBtn}
                  onPress={() => router.push(`/(consumer)/bookings/chat/bk-001`)}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
                  <Text style={styles.askQuestionText}>{t('messageHost', language)}</Text>
                </TouchableOpacity>
              </View>
              <Divider />
            </>
          )}
          {!isHostListing && listing.operator && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('aboutTheOperator', language)}</Text>
                <OperatorCard operator={listing.operator} />
                <View style={styles.operatorActions}>
                  <TouchableOpacity
                    style={styles.askQuestionBtn}
                    onPress={() => router.push(`/(consumer)/bookings/chat/bk-001`)}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
                    <Text style={styles.askQuestionText}>Ask a question</Text>
                  </TouchableOpacity>
                  {listing.operator.phone ? (
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => Linking.openURL(`tel:${listing.operator!.phone}`)}
                    >
                      <Ionicons name="call-outline" size={16} color={Colors.success} />
                      <Text style={styles.callBtnText}>Call</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <Divider />
            </>
          )}

          {/* Pickup location */}
          {(listing.pickup_address || (listing.latitude && listing.longitude)) && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('pickupLocation', language)}</Text>
                <View style={styles.locationCard}>
                  <View style={styles.locationMapPreview}>
                    <Text style={styles.locationMapIcon}>📍</Text>
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationAddress} numberOfLines={2}>
                      {listing.pickup_address ?? `${listing.operator?.city}, ${listing.operator?.country}`}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        const lat = listing.latitude ?? listing.operator?.latitude
                        const lng = listing.longitude ?? listing.operator?.longitude
                        if (lat && lng) {
                          const url = Platform.OS === 'ios'
                            ? `maps:?q=${lat},${lng}`
                            : `geo:${lat},${lng}?q=${lat},${lng}`
                          void Linking.openURL(url)
                        }
                      }}
                    >
                      <Text style={styles.locationDirections}>{t('getDirections', language)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <Divider />
            </>
          )}

          {/* Similar listings */}
          {similarListings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                More from {isHostListing ? listing.host?.name : listing.operator?.name}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarScroll}>
                {similarListings.map(sim => (
                  <TouchableOpacity
                    key={sim.id}
                    style={styles.similarCard}
                    onPress={() => router.push(`/(consumer)/listing/${sim.id}`)}
                  >
                    <View style={styles.similarImgPlaceholder}>
                      <Text style={styles.similarEmoji}>{getCategoryEmoji(sim.category)}</Text>
                    </View>
                    <Text style={styles.similarTitle} numberOfLines={1}>{sim.title}</Text>
                    <Text style={styles.similarPrice}>{formatEUR(sim.price_per_day)}/day</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Sticky booking bar */}
      <View style={[styles.bookingBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <View style={styles.bookingBarLeft}>
          <Text style={styles.bookingBarPrice}>{formatEUR(listing.price_per_day)}<Text style={styles.bookingBarUnit}>{t('perDay', language)}</Text></Text>
          {priceCalc && totalDays ? (
            <Text style={styles.bookingBarSub}>{totalDays} {t('days', language)} · {formatEURDecimal(priceCalc.total)}</Text>
          ) : (
            <Text style={styles.bookingBarTrust}>🔒 {t('securePayment', language)} · ✓ {t('noHiddenFees', language)}</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.bookNowBtn, !startDate && styles.bookNowBtnDimmed]}
          onPress={() => {
            if (startDate && endDate) {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push(`/(consumer)/booking/${listing.id}`)
            } else {
              setShowDatePicker(true)
            }
          }}
          accessibilityLabel={startDate ? `Book ${listing.title}` : 'Select rental dates'}
          accessibilityRole="button"
        >
          <Text style={styles.bookNowBtnText}>
            {startDate ? t('bookNow', language) : t('selectDates', language)}
          </Text>
        </TouchableOpacity>
      </View>

      <DatePickerSheet
        visible={showDatePicker}
        startDate={startDate}
        endDate={endDate}
        onApply={(s, e) => { setStartDate(s); setEndDate(e) }}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  heroGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0, height: '55%',
    backgroundColor: 'transparent',
  },
  heroBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: Spacing.base,
    paddingBottom: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  catBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  catBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  heroTitle: { fontSize: 24, fontWeight: '800', color: Colors.white, marginBottom: 6 },
  heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroLocationText: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  backBtn: {
    position: 'absolute',
    left: Spacing.base,
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  actionBtns: {
    position: 'absolute',
    right: Spacing.base,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  contentCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    padding: Spacing.xl,
  },

  opRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  opInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  opName: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  verifiedPill: { backgroundColor: Colors.successSurface, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  verifiedText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  hostPill: { backgroundColor: Colors.primarySurface, borderWidth: 1, borderColor: Colors.primaryLight },
  hostPillText: { color: Colors.primaryDark },
  bizPill: { backgroundColor: Colors.infoSurface, borderWidth: 1, borderColor: Colors.info },
  bizPillText: { color: Colors.info },

  hostCard: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hostCardTop: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  hostAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarText: { fontSize: 22, fontWeight: '700', color: Colors.primary },
  hostName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  hostVerifiedBadge: { fontSize: 12, fontWeight: '700', color: Colors.success },
  hostMeta: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  hostBio: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },

  priceSection: { marginBottom: Spacing.base },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  priceMain: { fontSize: 28, fontWeight: '800', color: Colors.primary },
  priceUnit: { fontSize: 14, color: Colors.textSecondary },
  weeklyPrice: { fontSize: 13, color: Colors.success, marginTop: 4 },

  infoChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  infoChip: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  section: { marginVertical: Spacing.base },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  seeAllReviews: { marginTop: Spacing.sm, alignSelf: 'flex-start' },
  seeAllReviewsText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  sectionTitle: {
    fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },

  insuranceBox: { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.successSurface, borderRadius: Radius.lg, padding: Spacing.md },
  insuranceIcon: { fontSize: 22 },
  insuranceInfo: { flex: 1 },
  insuranceTitle: { fontSize: 14, fontWeight: '700', color: Colors.success, marginBottom: 4 },
  insuranceText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  policyBadge: { backgroundColor: Colors.surfaceWarm, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  policyBadgeText: { fontSize: 14, color: Colors.text, fontWeight: '600' },

  datePicker: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  datePickerActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  datePickerText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  datePickerTextActive: { color: Colors.primaryDark, fontWeight: '600' },

  priceBreakdown: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  breakdownLabel: { fontSize: 14, color: Colors.textSecondary },
  breakdownValue: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginBottom: 0,
  },
  breakdownTotalLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  breakdownTotalValue: { fontSize: 15, fontWeight: '800', color: Colors.text },
  depositNote: { marginTop: Spacing.sm, backgroundColor: Colors.infoSurface, borderRadius: Radius.md, padding: Spacing.sm },
  depositNoteText: { fontSize: 12, color: Colors.info, fontWeight: '600' },
  depositNoteSubtext: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },

  desc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  showMore: { color: Colors.primary, fontWeight: '600', marginTop: Spacing.sm, fontSize: 14 },
  rulesBox: { backgroundColor: Colors.warningSurface, borderRadius: Radius.lg, padding: Spacing.md },
  rulesText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

  operatorActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexWrap: 'wrap',
  },
  askQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  askQuestionText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.successSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  callBtnText: { fontSize: 14, color: Colors.success, fontWeight: '600' },

  locationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationMapPreview: {
    width: 90,
    backgroundColor: Colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationMapIcon: { fontSize: 36 },
  locationInfo: { flex: 1, padding: Spacing.md, justifyContent: 'center' },
  locationAddress: { fontSize: 13, color: Colors.text, fontWeight: '500', lineHeight: 19, marginBottom: Spacing.xs },
  locationDirections: { fontSize: 13, color: Colors.primary, fontWeight: '700' },

  similarScroll: { marginTop: Spacing.sm },
  similarCard: {
    width: 140,
    marginRight: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  similarImgPlaceholder: {
    height: 90,
    backgroundColor: Colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarEmoji: { fontSize: 36 },
  similarTitle: { fontSize: 13, fontWeight: '600', color: Colors.text, padding: Spacing.sm, paddingBottom: 2 },
  similarPrice: { fontSize: 12, color: Colors.primary, fontWeight: '700', paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },

  bookingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  bookingBarLeft: { flex: 1 },
  bookingBarPrice: { fontSize: 18, fontWeight: '700', color: Colors.text },
  bookingBarUnit: { fontSize: 13, fontWeight: '400', color: Colors.textSecondary },
  bookingBarSub: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  bookingBarTrust: { fontSize: 11, color: Colors.success, marginTop: 2, fontWeight: '600' },
  bookNowBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  bookNowBtnDimmed: { backgroundColor: Colors.textTertiary, shadowOpacity: 0, elevation: 0 },
  bookNowBtnText: { color: Colors.textInverse, fontWeight: '700', fontSize: 15 },
})
