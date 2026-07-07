import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  View, Text, ScrollView, Animated, TouchableOpacity, StyleSheet, Dimensions, Share, Platform, Linking, Alert,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
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
import { formatEUR, formatEURDecimal, formatPricePerDay } from '@/lib/utils/formatCurrency'
import { getCategoryEmoji, getCategoryLabel } from '@/constants/categories'
import { getCancellationPolicyEmoji, getCancellationPolicyLabel } from '@/lib/utils/cancellation'
import { Config } from '@/constants/config'
import { MOCK_REVIEWS, MOCK_LISTINGS } from '@/lib/mockData'
import { useReviews } from '@/lib/hooks/useReviews'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useWishlistStore, toggleWishlistItem } from '@/lib/store/useWishlistStore'
import { useRecentlyViewedStore } from '@/lib/store/useRecentlyViewedStore'
import { useAvailability } from '@/lib/hooks/useAvailability'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import type { CancellationPolicy, Listing } from '@/types'

const { height: screenHeight } = Dimensions.get('window')
const HERO_HEIGHT = Math.round(screenHeight * 0.52)

export default function ListingDetailScreen() {
  // All hooks must be before any early returns — Rules of Hooks
  const C = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { listing, loading, error, refetch } = useListing(id ?? '')
  const { reviews: listingReviews } = useReviews(id ?? '')
  const { language, user } = useAuthStore()
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showFullDesc, setShowFullDesc] = useState(false)
  const [rentalType, setRentalType] = useState<'daily' | 'hourly'>('daily')
  const isWishlisted = useWishlistStore(s => s.isWishlisted)
  const trackViewed = useRecentlyViewedStore(s => s.track)
  const { blockedDates } = useAvailability(id ?? '')
  const insets = useSafeAreaInsets()
  const [similarListings, setSimilarListings] = useState<Listing[]>([])

  // Parallax hero — must be before early returns (rules of hooks)
  const scrollY = useRef(new Animated.Value(0)).current
  const parallaxScale = scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0],
    outputRange: [1.5, 1.08],
    extrapolate: 'clamp',
  })
  const parallaxTranslateY = scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0, HERO_HEIGHT],
    outputRange: [-HERO_HEIGHT * 0.3, 0, HERO_HEIGHT * 0.2],
    extrapolate: 'clamp',
  })

  // Must be before early returns — Rules of Hooks
  useEffect(() => {
    if (listing) trackViewed(listing)
  }, [listing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!listing) return
    const isHost = listing.owner_type === 'host'
    if (Config.useMock) {
      setSimilarListings(
        MOCK_LISTINGS.filter(l => {
          if (l.id === listing.id) return false
          if (isHost) return l.host_id === listing.host_id
          return l.operator_id === listing.operator_id
        }).slice(0, 3)
      )
      return
    }
    const col = isHost ? 'host_id' : 'operator_id'
    const val = isHost ? listing.host_id : listing.operator_id
    if (!val) return
    supabase
      .from('rentivo_listings')
      .select('id, title, category, price_per_day, cover_image_url')
      .eq(col, val)
      .neq('id', listing.id)
      .eq('is_active', true)
      .limit(3)
      .then(({ data }) => setSimilarListings((data as Listing[]) ?? []))
  }, [listing?.id, listing?.owner_type, listing?.host_id, listing?.operator_id])

  // Theme-reactive styles — recreated only when theme changes
  const styles = useMemo(() => makeStyles(C), [C])

  if (loading) return <View style={styles.container}><SkeletonCard /></View>
  if (error || !listing) return <ErrorState message={error ?? 'Listing not found'} onRetry={refetch} />

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

  const canContact = Boolean(user?.id)

  const handleContactHost = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (!canContact) {
      Alert.alert(
        t('ternLoginRequired', language),
        t('ternLoginToContactHost', language),
      )
      return
    }
    router.push({
      pathname: '/(consumer)/booking/[listingId]',
      params: { listingId: listing.id },
    })
  }

  const handleReport = () => {
    const reasons = [
      { label: t('ternFakeListing', language), value: 'fake_listing' },
      { label: t('ternIllegalVehicle', language), value: 'illegal_vehicle' },
      { label: t('ternMisleadingInfo', language), value: 'misleading_info' },
      { label: t('ternOther', language), value: 'other' },
    ]
    Alert.alert(
      t('ternReportListing', language),
      t('ternSelectReason', language),
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
                t('ternThankYou', language),
                t('ternReportReceived', language),
              )
            } catch {
              Alert.alert(
                t('opFleet2Error', language),
                t('ternCouldNotReport', language),
              )
            }
          },
        })),
        { text: t('cancel', language), style: 'cancel' },
      ],
    )
  }

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* Hero image with parallax */}
        <View style={{ height: HERO_HEIGHT, position: 'relative', overflow: 'hidden' }}>
          <Animated.View style={[StyleSheet.absoluteFill, {
            transform: [{ scale: parallaxScale }, { translateY: parallaxTranslateY }],
          }]}>
            <ListingCarousel images={listing.images} height={HERO_HEIGHT} />
          </Animated.View>

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

          <View style={[styles.backBtn, { top: insets.top + 8 }]}>
            <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              style={styles.backBtnInner}
            >
              {/* intentional: white text on dark overlay — theme-independent */}
              <Ionicons name="arrow-back" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>

          <View style={[styles.actionBtns, { top: insets.top + 8 }]}>
            <View style={styles.actionBtn}>
              <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
              <TouchableOpacity
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  void Share.share({
                    title: listing.title,
                    message: `Check out ${listing.title} on Rentivo — ${formatPricePerDay(listing.price_per_day, language)}`,
                  })
                }}
                accessibilityLabel="Share this listing"
                accessibilityRole="button"
                style={styles.backBtnInner}
              >
                {/* intentional: white text on dark overlay — theme-independent */}
                <Ionicons name="share-outline" size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>
            <View style={styles.actionBtn}>
              <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
              <TouchableOpacity
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  if (user?.id) void toggleWishlistItem(listing, user.id)
                }}
                accessibilityLabel={isWishlisted(listing.id) ? 'Remove from favorites' : 'Add to favorites'}
                accessibilityRole="button"
                style={styles.backBtnInner}
              >
                {/* intentional: white text on dark overlay — theme-independent */}
                <Ionicons
                  name={isWishlisted(listing.id) ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isWishlisted(listing.id) ? C.error : Colors.white}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.actionBtn}>
              <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
              <TouchableOpacity
                onPress={handleReport}
                accessibilityLabel={t('ternReportThisListing', language)}
                accessibilityRole="button"
                style={styles.backBtnInner}
              >
                {/* intentional: white text on dark overlay — theme-independent */}
                <Ionicons name="flag-outline" size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>
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
              <Text style={styles.priceMain}>{formatPricePerDay(listing.price_per_day, language)}</Text>
              {listing.instant_book === true && (
                <View style={styles.instantBadge}>
                  <Text style={styles.instantBadgeText}>⚡ {t('instantConfirmation', language)}</Text>
                </View>
              )}
            </View>
            {weeklyPrice && weeklySavings > 5 && (
              <Text style={styles.weeklyPrice}>
                {formatEURDecimal(weeklyPrice)}{t('perWeek', language)} · save {weeklySavings}%
              </Text>
            )}
          </View>

          {listing.hourly_rental_enabled && (
            <View style={styles.typeSelector}>
              {(['daily', 'hourly'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeBtn, rentalType === type && styles.typeBtnActive]}
                  onPress={() => setRentalType(type)}
                  accessibilityLabel={`${type} rental`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: rentalType === type }}
                >
                  <Text style={[styles.typeBtnText, rentalType === type && styles.typeBtnTextActive]}>
                    {type === 'daily' ? '📅 Daily' : '⏱ Hourly'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {listing.hourly_rental_enabled && rentalType === 'hourly' && listing.price_per_hour != null && (
            <Text style={styles.hourlyPrice}>
              {formatEUR(listing.price_per_hour)}/hour · min {listing.min_rental_hours ?? 2}h
            </Text>
          )}

          <View style={styles.infoChips}>
            {listing.year ? <View style={styles.infoChip}><Ionicons name="car-outline" size={13} color={C.textSecondary} /><Text style={styles.infoChipText}>{listing.year}</Text></View> : null}
            {listing.color ? <View style={styles.infoChip}><Ionicons name="color-palette-outline" size={13} color={C.textSecondary} /><Text style={styles.infoChipText}>{listing.color}</Text></View> : null}
            {listing.capacity ? <View style={styles.infoChip}><Ionicons name="people-outline" size={13} color={C.textSecondary} /><Text style={styles.infoChipText}>{listing.capacity} seats</Text></View> : null}
            {listing.cancellation_policy != null && (
              <View style={styles.infoChip}>
                <Text style={styles.infoChipText}>
                  {getCancellationPolicyEmoji(listing.cancellation_policy)} {getCancellationPolicyLabel(listing.cancellation_policy, language)}
                </Text>
              </View>
            )}
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
              <Ionicons name="shield-checkmark" size={22} color={C.success} />
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
                {getCancellationPolicyEmoji(policy)} {getCancellationPolicyLabel(policy, language)}
              </Text>
            </View>
          </View>

          <Divider />

          {/* Date selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('selectYourDates', language)}</Text>
              <Ionicons name="calendar-outline" size={16} color={C.textTertiary} />
            </View>
            <TouchableOpacity
              style={[styles.datePicker, startDate && styles.datePickerActive]}
              onPress={() => setShowDatePicker(true)}
              accessibilityLabel={dateLabel}
              accessibilityRole="button"
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
                  <Text style={styles.breakdownLabel}>Service fee ({(Config.platformCut * 100).toFixed(1)}%)</Text>
                  <Text style={styles.breakdownValue}>{formatEURDecimal(priceCalc.platformFee)}</Text>
                </View>
                <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                  <Text style={styles.breakdownTotalLabel}>Total</Text>
                  <Text style={styles.breakdownTotalValue}>{formatEURDecimal(priceCalc.total)}</Text>
                </View>
                {listing.deposit_amount > 0 && (
                  <View style={styles.depositNote}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="lock-closed" size={12} color={C.info} />
                      <Text style={styles.depositNoteText}>
                        + {formatEURDecimal(listing.deposit_amount)} {t('depositRefundableShort', language)}
                      </Text>
                    </View>
                    <Text style={styles.depositNoteSubtext}>
                      {t('depositPickupNote', language)}
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
                <TouchableOpacity
                  onPress={() => setShowFullDesc(v => !v)}
                  accessibilityLabel={showFullDesc ? t('showLess', language) : t('showMore', language)}
                  accessibilityRole="button"
                >
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

          {/* Ratings & Reviews */}
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('ratingsAndReviews', language)}</Text>

              {listing.review_count > 0 ? (
                <>
                  <View style={styles.ratingSummaryRow}>
                    <View style={styles.ratingHero}>
                      <Text style={styles.ratingBig}>
                        {listing.rating > 0 ? listing.rating.toFixed(1) : '—'}
                      </Text>
                      <StarRating rating={listing.rating} reviewCount={listing.review_count} size={16} />
                      <Text style={styles.reviewCountLabel}>
                        {listing.review_count} {t('reviews', language)}
                      </Text>
                    </View>
                  </View>

                  {(Config.useMock ? MOCK_REVIEWS.slice(0, 2) : listingReviews.slice(0, 2)).map((r, i) => {
                    const names = ['James K.', 'Sophie L.', 'Carlos M.']
                    return (
                      <ReviewCard
                        key={r.id}
                        review={r}
                        userName={Config.useMock ? names[i] ?? 'Guest' : `Guest`}
                      />
                    )
                  })}

                  {listing.review_count > 2 && (
                    <TouchableOpacity
                      style={styles.seeAllReviews}
                      onPress={() =>
                        router.push(
                          `/(consumer)/listing/reviews/${listing.id}` as Parameters<typeof router.push>[0]
                        )
                      }
                      accessibilityLabel={`See all ${listing.review_count} reviews`}
                      accessibilityRole="button"
                    >
                      <Text style={styles.seeAllReviewsText}>
                        {t('seeAllReviews', language)} ({listing.review_count}) →
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={styles.noReviewsBox}>
                  <Text style={styles.noReviewsIcon}>★</Text>
                  <Text style={styles.noReviewsTitle}>{t('noReviewsYet', language)}</Text>
                  <Text style={styles.noReviewsSub}>{t('noReviewsYetSub', language)}</Text>
                </View>
              )}
            </View>
            <Divider />
          </>

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
                  style={[styles.askQuestionBtn, !canContact && styles.askQuestionBtnDisabled]}
                  onPress={handleContactHost}
                  accessibilityLabel={canContact ? t('messageHost', language) : t('loginToContact', language)}
                  accessibilityRole="button"
                >
                  <Ionicons name="chatbubble-outline" size={16} color={canContact ? C.primary : C.textTertiary} />
                  <Text style={[styles.askQuestionText, !canContact && styles.askQuestionTextDisabled]}>
                    {canContact ? t('messageHost', language) : t('loginToContact', language)}
                  </Text>
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
                    style={[styles.askQuestionBtn, !canContact && styles.askQuestionBtnDisabled]}
                    onPress={handleContactHost}
                    accessibilityLabel={canContact ? t('contactOperator', language) : t('loginToContact', language)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="chatbubble-outline" size={16} color={canContact ? C.primary : C.textTertiary} />
                    <Text style={[styles.askQuestionText, !canContact && styles.askQuestionTextDisabled]}>
                      {canContact ? t('askQuestion', language) : t('loginToContact', language)}
                    </Text>
                  </TouchableOpacity>
                  {listing.operator.phone ? (
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => void Linking.openURL(`tel:${listing.operator!.phone}`)}
                      accessibilityLabel={`Call ${listing.operator.name}`}
                      accessibilityRole="button"
                    >
                      <Ionicons name="call-outline" size={16} color={C.success} />
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
                    <Ionicons name="location" size={36} color={C.primary} />
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
                      accessibilityLabel={t('getDirections', language)}
                      accessibilityRole="button"
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
                    accessibilityLabel={`${sim.title}, ${formatPricePerDay(sim.price_per_day, language)}`}
                    accessibilityRole="button"
                  >
                    {sim.cover_image_url ? (
                      <Image source={{ uri: sim.cover_image_url }} style={styles.similarImgPlaceholder} contentFit="cover" />
                    ) : (
                      <View style={styles.similarImgPlaceholder}>
                        <Text style={styles.similarFallbackText}>{sim.title.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.similarTitle} numberOfLines={1}>{sim.title}</Text>
                    <Text style={styles.similarPrice}>{formatPricePerDay(sim.price_per_day, language)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </Animated.ScrollView>

      {/* Sticky booking bar — glassmorphism */}
      <View style={[styles.bookingBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
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
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              router.push({
                pathname: '/(consumer)/booking/[listingId]',
                params: {
                  listingId: listing.id,
                  startDate: startDate.toISOString(),
                  endDate: endDate.toISOString(),
                  rentalType,
                },
              })
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
        blockedDates={blockedDates}
        pricePerDay={listing.price_per_day}
      />
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

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
    catBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
    heroTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
    heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    heroLocationText: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

    backBtn: {
      position: 'absolute',
      left: Spacing.base,
      width: 40, height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    backBtnInner: {
      width: '100%', height: '100%',
      alignItems: 'center', justifyContent: 'center',
    },
    actionBtns: {
      position: 'absolute',
      right: Spacing.base,
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionBtn: {
      width: 40, height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },

    contentCard: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      marginTop: -20,
      padding: Spacing.xl,
    },

    opRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    opInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    opName: { fontSize: 14, fontWeight: '600', color: C.textSecondary },
    verifiedPill: { backgroundColor: C.successSurface, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
    verifiedText: { fontSize: 11, fontWeight: '700', color: C.success },
    hostPill: { backgroundColor: C.primarySurface, borderWidth: 1, borderColor: C.primaryLight },
    hostPillText: { color: C.primaryDark },
    bizPill: { backgroundColor: C.infoSurface, borderWidth: 1, borderColor: C.info },
    bizPillText: { color: C.info },

    hostCard: {
      backgroundColor: C.surfaceWarm,
      borderRadius: Radius.xl,
      padding: Spacing.base,
      borderWidth: 1,
      borderColor: C.border,
    },
    hostCardTop: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
    hostAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: C.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hostAvatarText: { fontSize: 22, fontWeight: '700', color: C.primary },
    hostName: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 2 },
    hostVerifiedBadge: { fontSize: 12, fontWeight: '700', color: C.success },
    hostMeta: { fontSize: 12, color: C.textSecondary, marginBottom: 2 },
    hostBio: {
      fontSize: 13,
      color: C.textSecondary,
      fontStyle: 'italic',
      lineHeight: 20,
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingTop: Spacing.sm,
    },

    priceSection: { marginBottom: Spacing.base },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
    priceMain: { fontSize: 28, fontWeight: '800', color: C.primary },
    priceUnit: { fontSize: 14, color: C.textSecondary },
    weeklyPrice: { fontSize: 13, color: C.success, marginTop: 4 },
    instantBadge: {
      backgroundColor: C.successSurface,
      borderRadius: Radius.full,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: C.success,
    },
    instantBadgeText: { fontSize: 11, fontWeight: '700', color: C.success },

    infoChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
    infoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: C.surfaceWarm,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderWidth: 1,
      borderColor: C.border,
    },
    infoChipText: { fontSize: 12, color: C.textSecondary, fontWeight: '500' },

    section: { marginVertical: Spacing.base },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    seeAllReviews: { marginTop: Spacing.sm, alignSelf: 'flex-start' },
    seeAllReviewsText: { fontSize: 14, fontWeight: '600', color: C.primary },
    sectionTitle: {
      fontSize: 12, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 0.8,
      color: C.textTertiary,
      marginBottom: Spacing.sm,
    },

    insuranceBox: { flexDirection: 'row', gap: Spacing.md, backgroundColor: C.successSurface, borderRadius: Radius.lg, padding: Spacing.md },
    insuranceIcon: { fontSize: 22 },
    insuranceInfo: { flex: 1 },
    insuranceTitle: { fontSize: 14, fontWeight: '700', color: C.success, marginBottom: 4 },
    insuranceText: { fontSize: 13, color: C.textSecondary, lineHeight: 19 },

    policyBadge: { backgroundColor: C.surfaceWarm, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.border },
    policyBadgeText: { fontSize: 14, color: C.text, fontWeight: '600' },

    datePicker: {
      backgroundColor: C.surfaceWarm,
      borderRadius: Radius.xl,
      padding: Spacing.base,
      borderWidth: 1.5,
      borderColor: C.border,
    },
    datePickerActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
    datePickerText: { fontSize: 14, color: C.textSecondary, textAlign: 'center' },
    datePickerTextActive: { color: C.primaryDark, fontWeight: '600' },

    priceBreakdown: {
      backgroundColor: C.surfaceWarm,
      borderRadius: Radius.lg,
      padding: Spacing.base,
      borderWidth: 1,
      borderColor: C.border,
    },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
    breakdownLabel: { fontSize: 14, color: C.textSecondary },
    breakdownValue: { fontSize: 14, color: C.text, fontWeight: '500' },
    breakdownTotal: {
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingTop: Spacing.sm,
      marginBottom: 0,
    },
    breakdownTotalLabel: { fontSize: 15, fontWeight: '700', color: C.text },
    breakdownTotalValue: { fontSize: 15, fontWeight: '800', color: C.text },
    depositNote: { marginTop: Spacing.sm, backgroundColor: C.infoSurface, borderRadius: Radius.md, padding: Spacing.sm },
    depositNoteText: { fontSize: 12, color: C.info, fontWeight: '600' },
    depositNoteSubtext: { fontSize: 11, color: C.textTertiary, marginTop: 2 },

    desc: { fontSize: 14, color: C.textSecondary, lineHeight: 22 },
    showMore: { color: C.primary, fontWeight: '600', marginTop: Spacing.sm, fontSize: 14 },
    rulesBox: { backgroundColor: C.warningSurface, borderRadius: Radius.lg, padding: Spacing.md },
    rulesText: { fontSize: 13, color: C.textSecondary, lineHeight: 20 },

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
      backgroundColor: C.primarySurface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: C.primary,
    },
    askQuestionText: { fontSize: 14, color: C.primary, fontWeight: '600' },
    askQuestionBtnDisabled: { backgroundColor: C.surfaceWarm, borderColor: C.border, opacity: 0.6 },
    askQuestionTextDisabled: { color: C.textTertiary },
    callBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      backgroundColor: C.successSurface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: C.success,
    },
    callBtnText: { fontSize: 14, color: C.success, fontWeight: '600' },

    locationCard: {
      flexDirection: 'row',
      backgroundColor: C.surfaceWarm,
      borderRadius: Radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
    },
    locationMapPreview: {
      width: 90,
      backgroundColor: C.surfaceWarm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationMapIcon: { fontSize: 36 },
    locationInfo: { flex: 1, padding: Spacing.md, justifyContent: 'center' },
    locationAddress: { fontSize: 13, color: C.text, fontWeight: '500', lineHeight: 19, marginBottom: Spacing.xs },
    locationDirections: { fontSize: 13, color: C.primary, fontWeight: '700' },

    similarScroll: { marginTop: Spacing.sm },
    similarCard: {
      width: 140,
      marginRight: Spacing.md,
      backgroundColor: C.surface,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
    },
    similarImgPlaceholder: {
      width: '100%',
      height: 90,
      backgroundColor: C.surfaceWarm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    similarFallbackText: { fontSize: 32, fontWeight: '700', color: C.textTertiary },
    similarTitle: { fontSize: 13, fontWeight: '600', color: C.text, padding: Spacing.sm, paddingBottom: 2 },
    similarPrice: { fontSize: 12, color: C.primary, fontWeight: '700', paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },

    typeSelector: { flexDirection: 'row', gap: 8, marginBottom: Spacing.base },
    typeBtn: {
      flex: 1, padding: 12, borderRadius: Radius.sm, borderWidth: 1,
      borderColor: C.border, alignItems: 'center',
      minHeight: 44, justifyContent: 'center',
    },
    typeBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    typeBtnText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
    typeBtnTextActive: { color: C.background },
    hourlyPrice: { color: C.primary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.base },

    bookingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.base,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      overflow: 'hidden',
    },
    bookingBarLeft: { flex: 1 },
    bookingBarPrice: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
    bookingBarUnit: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.7)' },
    bookingBarSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
    bookingBarTrust: { fontSize: 11, color: C.success, marginTop: 2, fontWeight: '600' },
    bookNowBtn: {
      backgroundColor: C.primary,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
    bookNowBtnDimmed: { backgroundColor: C.textTertiary, shadowOpacity: 0, elevation: 0 },
    bookNowBtnText: { color: C.textInverse, fontWeight: '700', fontSize: 15 },

    ratingSummaryRow: {
      flexDirection: 'row',
      gap: Spacing.base,
      marginBottom: Spacing.base,
    },
    ratingHero: {
      width: 88,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
    },
    ratingBig: {
      fontSize: 40,
      fontWeight: '800',
      color: C.text,
      lineHeight: 44,
    },
    reviewCountLabel: {
      fontSize: 12,
      color: C.textTertiary,
      marginTop: 2,
    },
    breakdownCategories: {
      flex: 1,
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    categoryLabel: {
      fontSize: 12,
      color: C.textSecondary,
      width: 88,
    },
    progressTrack: {
      flex: 1,
      height: 4,
      backgroundColor: C.border,
      borderRadius: Radius.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: C.primary,
      borderRadius: Radius.full,
    },
    categoryScore: {
      fontSize: 12,
      color: C.textSecondary,
      fontWeight: '600',
      width: 28,
      textAlign: 'right',
    },
    noReviewsBox: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      gap: Spacing.sm,
    },
    noReviewsIcon: {
      fontSize: 32,
      color: C.textTertiary,
    },
    noReviewsTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: C.textSecondary,
    },
    noReviewsSub: {
      fontSize: 13,
      color: C.textTertiary,
      textAlign: 'center',
    },
  })
}
