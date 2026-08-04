import React, { useEffect } from 'react'
import { StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Radius, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { useThemeStore } from '@/lib/store/useThemeStore'

interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export function Skeleton({ width = '100%', height = 16, borderRadius = Radius.md, style }: SkeletonProps) {
  const C = useColors()
  const isDark = useThemeStore(s => s.isDark)
  // Read inside the component, not at module scope: a module-level
  // Dimensions.get() is frozen at import time, so after a rotation the
  // shimmer swept the wrong distance (short on landscape, overshot on the
  // way back). useWindowDimensions re-renders us with the live width.
  const { width: screenW } = useWindowDimensions()

  // Reanimated rather than RN Animated: the sweep is driven entirely from the
  // UI thread, so it keeps moving while JS is busy fetching the data this
  // skeleton is standing in for — which is exactly when it is on screen.
  const shimmerX = useSharedValue(-screenW)

  useEffect(() => {
    shimmerX.value = -screenW
    shimmerX.value = withRepeat(
      withTiming(screenW, { duration: 1100, easing: Easing.linear }),
      -1,
      false,
    )
  }, [screenW, shimmerX])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }))

  const shimmerMiddle = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.6)'

  return (
    <View
      style={[
        { width: width as number, height, borderRadius, backgroundColor: C.border, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', shimmerMiddle, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, width: screenW * 0.5 }}
        />
      </Animated.View>
    </View>
  )
}

export function SkeletonCard() {
  const C = useColors()

  return (
    <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      <Skeleton height={160} borderRadius={12} style={{ marginBottom: 12 }} />
      <Skeleton height={16} width="70%" style={{ marginBottom: 8 }} />
      <Skeleton height={12} width="50%" style={{ marginBottom: 8 }} />
      <Skeleton height={14} width="40%" />
    </View>
  )
}

/**
 * Card-shaped block used by the detail skeletons below. Mirrors `Card`'s
 * radius/border/padding so the real Card drops straight into its footprint.
 */
function SkeletonCardBlock({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const C = useColors()
  return (
    <View style={[styles.blockCard, { backgroundColor: C.surfaceCard, borderColor: C.border }, style]}>
      {children}
    </View>
  )
}

/**
 * Whole-screen loader for the listing detail screen.
 *
 * The screen used to render a small <SkeletonCard /> and then reflow into a
 * full page once data landed — the user watched a 200px card become a
 * 300px-hero scroll view. This mirrors the real layout (full-bleed hero, title
 * + rating, host row, feature rows, pinned bottom bar) so nothing moves when
 * the content swaps in.
 *
 * `heroHeight` matches the screen's HERO_HEIGHT; keep them in sync.
 */
export function ListingDetailSkeleton({ heroHeight = 300 }: { heroHeight?: number } = {}) {
  const C = useColors()

  return (
    <View
      style={[styles.screen, { backgroundColor: C.background }]}
      accessibilityLabel="Loading listing"
      accessibilityRole="progressbar"
    >
      {/* Full-bleed hero — borderRadius 0 because the real image is edge-to-edge. */}
      <Skeleton height={heroHeight} borderRadius={0} />

      <View style={styles.screenBody}>
        {/* Title + rating */}
        <Skeleton height={26} width="82%" style={{ marginBottom: Spacing.sm }} />
        <Skeleton height={14} width="46%" style={{ marginBottom: Spacing.lg }} />

        {/* Host row: avatar + name/subtitle */}
        <View style={styles.hostRow}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <View style={styles.hostRowText}>
            <Skeleton height={15} width="55%" style={{ marginBottom: 6 }} />
            <Skeleton height={12} width="34%" />
          </View>
        </View>

        {/* Feature rows — icon + label pairs */}
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.featureRow}>
            <Skeleton width={22} height={22} borderRadius={Radius.xs} />
            <Skeleton height={14} width={`${68 - i * 9}%`} style={{ marginLeft: Spacing.md }} />
          </View>
        ))}
      </View>

      {/* Pinned bottom bar: price block on the left, CTA on the right. */}
      <View style={[styles.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        <View style={styles.bottomBarPrice}>
          <Skeleton height={12} width="52%" style={{ marginBottom: 6 }} />
          <Skeleton height={20} width="38%" />
        </View>
        <Skeleton width={148} height={52} borderRadius={Radius.lg} />
      </View>
    </View>
  )
}

/**
 * Whole-screen loader for the booking detail screens (consumer + operator).
 * Mirrors their actual order: status banner, vehicle card, price card —
 * so the banner colour appears where the grey banner was, not 80px lower.
 */
export function BookingDetailSkeleton() {
  return (
    <View
      style={styles.bookingContent}
      accessibilityLabel="Loading booking"
      accessibilityRole="progressbar"
    >
      {/* Status banner — same height as the real one (Spacing.md padding + 15pt text). */}
      <Skeleton height={48} borderRadius={Radius.lg} style={{ marginBottom: Spacing.base }} />

      {/* Vehicle card: title / operator / dates */}
      <SkeletonCardBlock style={{ marginBottom: Spacing.base }}>
        <Skeleton height={20} width="72%" style={{ marginBottom: Spacing.sm }} />
        <Skeleton height={15} width="48%" style={{ marginBottom: Spacing.sm }} />
        <Skeleton height={14} width="62%" />
      </SkeletonCardBlock>

      {/* Price card: section label, label/value row, status badge */}
      <SkeletonCardBlock style={{ marginBottom: Spacing.base }}>
        <Skeleton height={12} width="30%" style={{ marginBottom: Spacing.md }} />
        <View style={styles.priceRow}>
          <Skeleton height={14} width="40%" />
          <Skeleton height={16} width="26%" />
        </View>
        <Skeleton height={22} width={82} borderRadius={Radius.full} style={{ marginTop: Spacing.md }} />
      </SkeletonCardBlock>

      {/* Trailing detail card (policy / insurance) */}
      <SkeletonCardBlock>
        <Skeleton height={12} width="34%" style={{ marginBottom: Spacing.md }} />
        <Skeleton height={14} width="90%" style={{ marginBottom: Spacing.sm }} />
        <Skeleton height={14} width="64%" />
      </SkeletonCardBlock>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  blockCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.base,
  },
  screen: { flex: 1 },
  screenBody: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  hostRowText: { flex: 1, marginLeft: Spacing.md },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
  },
  bottomBarPrice: { flex: 1 },
  bookingContent: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
})
