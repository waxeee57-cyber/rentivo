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
import { Colors, Spacing, Radius, Fonts, Typography } from '@/constants/colors'
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
import { getCategoryLabel } from '@/constants/categories'
import { getCancellationPolicyLabel } from '@/lib/utils/cancellation'
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
      // `is_active` does not exist on rentivo_listings; the column is
      // `available`. PostgREST rejected the whole query, so "More from this
      // owner" was permanently empty on every listing page.
      .eq('available', true)
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
            <View style={styles.heroBadgeRow}>
              <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>
                  {getCategoryLabel(listing.category)}
                </Text>
              </View>
              {listing.images && listing.images.length > 1 && (
                <View style={styles.photoCountChip}>
                  <Ionicons name="images-outline" size={11} color="#FFFFFF" />
                  <Text style={styles.photoCountText}>{listing.images.length}</Text>
                </View>
              )}
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
                {isHostListing ? (
                  <View style={[styles.verifiedPill, styles.hostPill]}>
                    <Ionicons name="person-outline" size={10} color={C.info} />
                    <Text style={[styles.verifiedText, styles.hostPillText]}>Private host</Text>
                  </View>
                ) : (
                  <View style={[styles.verifiedPill, styles.bizPill]}>
                    <Ionicons name="shield-checkmark" size={10} color={C.success} />
                    <Text style={[styles.verifiedText, styles.bizPillText]}>Verified Business</Text>
                  </View>
                )}
              </View>
              <StarRating rating={listing.rating} reviewCount={listing.review_count} size={13} />
            </View>
          )}

          {/* Trust line — the moment the €2000 decision is made. A review-less
              listing must say WHY it can still be trusted, not say nothing. */}
          {(listing.review_count ?? 0) === 0 && (
            <View style={styles.trustLine}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.success} />
              <Text style={styles.trustLineText}>
                New listing · {(isHostListing ? listing.host?.verified : listing.operator?.verified)
                  ? 'Identity & payout verified'
                  : 'Payments held securely until pickup'}
              </Text>
            </View>
          )}

          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.priceMain}>{formatPricePerDay(listing.price_per_day, language)}</Text>
              {listing.instant_book === true && (
                <View style={styles.instantBadge}>
                  <Ionicons name="flash" size={10} color={C.success} />
                  <Text style={styles.instantBadgeText}>{t('instantConfirmation', language)}</Text>
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
                    {type === 'daily' ? 'Daily' : 'Hourly'}
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
            {/* Single source for the cancellation policy — it belongs at the
                decision point, next to the price. Uses `policy` (which defaults
                to 'moderate'), the one thing the deleted standalone
                CANCELLATION POLICY section added over this chip. */}
            <View
              style={styles.infoChip}
              accessibilityLabel={`${t('cancellationPolicy', language)}: ${getCancellationPolicyLabel(policy, language)}`}
            >
              <Ionicons name="refresh-outline" size={13} color={C.textSecondary} />
              <Text style={styles.infoChipText}>
                {getCancellationPolicyLabel(policy, language)}
              </Text>
            </View>
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

          {/* Damage waiver. The body copy was a hardcoded English claim of
              "TPL up to €500,000 / €500 excess" — no insurer underwrites it and
              Rentivo is not a registered intermediary (IDD 2016/97), so it is
              replaced by a translated, factual note with no cover ceiling. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('insurance', language)}</Text>
            <View style={styles.insuranceBox}>
              <Ionicons name="shield-checkmark" size={22} color={C.success} />
              <View style={styles.insuranceInfo}>
                <Text style={styles.insuranceTitle}>{t('insuranceIncluded', language)}</Text>
                <Text style={styles.insuranceText}>{t('insuranceCoverageNote', language)}</Text>
              </View>
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
                  <Ionicons name="warning-outline" size={14} color={C.warning} style={styles.rulesIcon} importantForAccessibility="no" />
                  <Text style={styles.rulesText}>{listing.rules}</Text>
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

      {/* Sticky booking bar — solid surface, single-line trust copy.
          (Was a dark BlurView with wrapping green microcopy — read as broken
          exactly where the user decides to pay.) */}
      <View style={[styles.bookingBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <View style={styles.bookingBarLeft}>
          <Text style={styles.bookingBarPrice}>{formatEUR(listing.price_per_day)}<Text style={styles.bookingBarUnit}> {t('perDay', language)}</Text></Text>
          {priceCalc && totalDays ? (
            <Text style={styles.bookingBarSub} numberOfLines={1}>{totalDays} {t('days', language)} · {formatEURDecimal(priceCalc.total)}</Text>
          ) : (
            <View style={styles.bookingBarTrustRow}>
              <Ionicons name="lock-closed" size={10} color={C.textTertiary} />
              <Text style={styles.bookingBarTrust} numberOfLines={1}>
                {t('securePayment', language)} · {t('noHiddenFees', language)}
              </Text>
            </View>
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
          <Text style={[styles.bookNowBtnText, !startDate && { color: '#FFFFFF' }]}>
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
    catBadgeText: { fontSize: 11, fontFamily: Fonts.bold, color: '#FFFFFF' },
    heroTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 28, letterSpacing: -0.6, color: '#FFFFFF', marginBottom: 6 },
    heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    heroLocationText: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)' },

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
    opInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
    opName: { fontSize: 14, fontFamily: Fonts.semibold, color: C.textSecondary, flexShrink: 1 },
    verifiedPill: {
      backgroundColor: C.successSurface, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 2,
      flexDirection: 'row', alignItems: 'center', gap: 3,
    },
    verifiedText: { fontSize: 11, fontFamily: Fonts.bold, color: C.success },
    hostPill: { backgroundColor: C.infoSurface, borderWidth: 1, borderColor: C.info },
    hostPillText: { color: C.info },
    trustLine: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.successSurface,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      marginBottom: Spacing.md,
    },
    trustLineText: { fontSize: 12, fontFamily: Fonts.semibold, color: C.success, flexShrink: 1 },
    heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    photoCountChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: Radius.pill,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    photoCountText: { fontSize: 11, fontFamily: Fonts.bold, color: '#FFFFFF' },
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
      // Identity chip, not an action — neutral ink pair, brand accent reserved
      // for the primary CTA / active tab.
      backgroundColor: C.surfaceWarm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hostAvatarText: { fontSize: 22, fontFamily: Fonts.bold, color: C.text },
    hostName: { fontSize: 16, fontFamily: Fonts.bold, color: C.text, marginBottom: 2 },
    hostVerifiedBadge: { fontSize: 12, fontFamily: Fonts.bold, color: C.success },
    hostMeta: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary, marginBottom: 2 },
    hostBio: {
      fontFamily: Fonts.regular, fontSize: 13,
      color: C.textSecondary,
      fontStyle: 'italic',
      lineHeight: 20,
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingTop: Spacing.sm,
    },

    priceSection: { marginBottom: Spacing.base },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
    // Price in ink, tabular — the brand orange stays reserved for the CTA
    priceMain: { fontFamily: 'Manrope_800ExtraBold', fontSize: 26, letterSpacing: -0.5, color: C.text, fontVariant: ['tabular-nums'] },
    priceUnit: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary },
    weeklyPrice: { fontFamily: Fonts.regular, fontSize: 13, color: C.success, marginTop: 4 },
    instantBadge: {
      backgroundColor: C.successSurface,
      borderRadius: Radius.full,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: C.success,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    instantBadgeText: { fontSize: 11, fontFamily: Fonts.bold, color: C.success },

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
    infoChipText: { fontSize: 12, color: C.textSecondary, fontFamily: Fonts.medium },

    section: { marginVertical: Spacing.base },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    seeAllReviews: { marginTop: Spacing.sm, alignSelf: 'flex-start' },
    seeAllReviewsText: { fontSize: 14, fontFamily: Fonts.semibold, color: C.primary },
    sectionTitle: {
      fontSize: 12, fontFamily: Fonts.bold,
      textTransform: 'uppercase', letterSpacing: 0.8,
      color: C.textTertiary,
      marginBottom: Spacing.sm,
    },

    insuranceBox: { flexDirection: 'row', gap: Spacing.md, backgroundColor: C.successSurface, borderRadius: Radius.lg, padding: Spacing.md },
    insuranceIcon: { fontFamily: Fonts.regular, fontSize: 22 },
    insuranceInfo: { flex: 1 },
    insuranceTitle: { fontSize: 14, fontFamily: Fonts.bold, color: C.success, marginBottom: 4 },
    insuranceText: { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, lineHeight: 19 },

    policyBadge: { backgroundColor: C.surfaceWarm, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.border },
    policyBadgeText: { fontSize: 14, color: C.text, fontFamily: Fonts.semibold },

    datePicker: {
      backgroundColor: C.surfaceWarm,
      borderRadius: Radius.xl,
      padding: Spacing.base,
      borderWidth: 1.5,
      borderColor: C.border,
    },
    datePickerActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
    datePickerText: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, textAlign: 'center' },
    datePickerTextActive: { color: C.primaryDark, fontFamily: Fonts.semibold },

    priceBreakdown: {
      backgroundColor: C.surfaceWarm,
      borderRadius: Radius.lg,
      padding: Spacing.base,
      borderWidth: 1,
      borderColor: C.border,
    },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
    breakdownLabel: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary },
    breakdownValue: { fontSize: 14, color: C.text, fontFamily: Fonts.medium },
    breakdownTotal: {
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingTop: Spacing.sm,
      marginBottom: 0,
    },
    breakdownTotalLabel: { fontSize: 15, fontFamily: Fonts.bold, color: C.text },
    breakdownTotalValue: { fontSize: 15, fontFamily: Fonts.extrabold, color: C.text },
    depositNote: { marginTop: Spacing.sm, backgroundColor: C.infoSurface, borderRadius: Radius.md, padding: Spacing.sm },
    depositNoteText: { fontSize: 12, color: C.info, fontFamily: Fonts.semibold },
    depositNoteSubtext: { fontFamily: Fonts.regular, fontSize: 11, color: C.textTertiary, marginTop: 2 },

    desc: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, lineHeight: 22 },
    showMore: { color: C.primary, fontFamily: Fonts.semibold, marginTop: Spacing.sm, fontSize: 14 },
    rulesBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.warningSurface, borderRadius: Radius.lg, padding: Spacing.md },
    rulesIcon: { marginRight: Spacing.sm, marginTop: 2 },
    rulesText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, lineHeight: 20 },

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
    askQuestionText: { fontSize: 14, color: C.primary, fontFamily: Fonts.semibold },
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
    callBtnText: { fontSize: 14, color: C.success, fontFamily: Fonts.semibold },

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
    locationMapIcon: { fontFamily: Fonts.regular, fontSize: 36 },
    locationInfo: { flex: 1, padding: Spacing.md, justifyContent: 'center' },
    locationAddress: { fontSize: 13, color: C.text, fontFamily: Fonts.medium, lineHeight: 19, marginBottom: Spacing.xs },
    locationDirections: { fontSize: 13, color: C.primary, fontFamily: Fonts.bold },

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
    similarFallbackText: { fontSize: 32, fontFamily: Fonts.bold, color: C.textTertiary },
    similarTitle: { fontSize: 13, fontFamily: Fonts.semibold, color: C.text, padding: Spacing.sm, paddingBottom: 2 },
    // Price in ink on the shared price scale (tabular numerals), never brand orange.
    similarPrice: { ...Typography.priceS, color: C.text, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },

    typeSelector: { flexDirection: 'row', gap: 8, marginBottom: Spacing.base },
    typeBtn: {
      flex: 1, padding: 12, borderRadius: Radius.sm, borderWidth: 1,
      borderColor: C.border, alignItems: 'center',
      minHeight: 44, justifyContent: 'center',
    },
    typeBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    typeBtnText: { color: C.textSecondary, fontSize: 14, fontFamily: Fonts.semibold },
    typeBtnTextActive: { color: C.background },
    // Price in ink on the shared price scale (tabular numerals), never brand orange.
    hourlyPrice: { ...Typography.price, color: C.text, textAlign: 'center', marginBottom: Spacing.base },

    bookingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.base,
      backgroundColor: C.surface,
      borderTopWidth: 1,
      borderTopColor: C.border,
      shadowColor: '#0A1628',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 8,
    },
    bookingBarLeft: { flex: 1, minWidth: 0 },
    bookingBarPrice: { fontSize: 18, fontFamily: Fonts.bold, letterSpacing: -0.3, color: C.text, fontVariant: ['tabular-nums'] },
    bookingBarUnit: { fontSize: 13, fontFamily: Fonts.regular, color: C.textSecondary },
    bookingBarSub: { fontFamily: Fonts.regular, fontSize: 12, color: C.textSecondary, marginTop: 2, fontVariant: ['tabular-nums'] },
    bookingBarTrustRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    bookingBarTrust: { fontSize: 11, color: C.textTertiary, fontFamily: Fonts.medium, flexShrink: 1 },
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
    // "Select dates" is a real action (opens the picker) — navy actionable
    // state, not disabled-gray. Orange stays reserved for the Book moment.
    bookNowBtnDimmed: {
      backgroundColor: C.navy, shadowOpacity: 0, elevation: 2,
      borderWidth: 1, borderColor: C.borderWarm,
    },
    bookNowBtnText: { color: C.textInverse, fontFamily: Fonts.bold, fontSize: 15 },

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
      fontFamily: Fonts.extrabold,
      color: C.text,
      lineHeight: 44,
    },
    reviewCountLabel: {
      fontFamily: Fonts.regular, fontSize: 12,
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
      fontFamily: Fonts.regular, fontSize: 12,
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
      fontFamily: Fonts.semibold,
      width: 28,
      textAlign: 'right',
    },
    noReviewsBox: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      gap: Spacing.sm,
    },
    noReviewsIcon: {
      fontFamily: Fonts.regular, fontSize: 32,
      color: C.textTertiary,
    },
    noReviewsTitle: {
      fontSize: 15,
      fontFamily: Fonts.bold,
      color: C.textSecondary,
    },
    noReviewsSub: {
      fontFamily: Fonts.regular, fontSize: 13,
      color: C.textTertiary,
      textAlign: 'center',
    },
  })
}
