import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { MOCK_HOST, MOCK_HOST_LISTING, MOCK_BOOKINGS } from '@/lib/mockData'
import { formatEURDecimal } from '@/lib/utils/formatCurrency'
import { formatDateRange } from '@/lib/utils/formatDate'
import { Config } from '@/constants/config'

export default function HostDashboardScreen() {
  const { host } = useAuthStore()
  const hostData = Config.useMock ? MOCK_HOST : host
  const firstName = hostData?.name?.split(' ')[0] ?? 'Host'

  const monthlyEarnings = Config.useMock ? 42000 : 0
  const upcomingPickups = Config.useMock ? 2 : 0
  const activeRentals = Config.useMock ? 1 : 0
  const rating = Config.useMock ? MOCK_HOST.rating : (host?.rating ?? 0)

  const recentBookings = Config.useMock ? MOCK_BOOKINGS.slice(0, 3) : []

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>Hi {firstName} 👋</Text>

        {/* Quick stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Text style={styles.statValue}>{formatEURDecimal(monthlyEarnings)}</Text>
            <Text style={styles.statLabelLight}>Earned this month</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{upcomingPickups}</Text>
            <Text style={styles.statLabel}>Upcoming pickups</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeRentals}</Text>
            <Text style={styles.statLabel}>Active rentals</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>★{rating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Earnings overview */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsTitle}>Earnings overview</Text>
          <View style={styles.earningsRow}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsAmount}>{formatEURDecimal(monthlyEarnings)}</Text>
              <Text style={styles.earningsLabel}>This month</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              <Text style={styles.earningsAmount}>{formatEURDecimal(Config.useMock ? 38500 : 0)}</Text>
              <Text style={styles.earningsLabel}>Last month</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              <Text style={styles.earningsAmount}>{formatEURDecimal(Config.useMock ? 420000 : 0)}</Text>
              <Text style={styles.earningsLabel}>All time</Text>
            </View>
          </View>
        </View>

        {/* Your listings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your listings</Text>
            <TouchableOpacity onPress={() => router.push('/(host)/listings')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>

          {Config.useMock ? (
            <TouchableOpacity
              style={styles.listingCard}
              onPress={() => router.push(`/(consumer)/listing/${MOCK_HOST_LISTING.id}`)}
            >
              <View style={styles.listingEmoji}>
                <Text style={{ fontSize: 32 }}>🚗</Text>
              </View>
              <View style={styles.listingInfo}>
                <Text style={styles.listingTitle} numberOfLines={1}>{MOCK_HOST_LISTING.title}</Text>
                <Text style={styles.listingPrice}>
                  {formatEURDecimal(MOCK_HOST_LISTING.price_per_day)}/day
                </Text>
                <View style={styles.listingStats}>
                  <Text style={styles.listingStatText}>📅 {MOCK_HOST_LISTING.booking_count} bookings</Text>
                  <Text style={styles.listingStatText}>★ {MOCK_HOST_LISTING.rating}</Text>
                </View>
              </View>
              <View style={styles.listingBadge}>
                <Text style={styles.listingBadgeText}>Live</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyListings}>
              <Text style={styles.emptyEmoji}>🚗</Text>
              <Text style={styles.emptyText}>No listings yet</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(host)/listings/new')}
          >
            <Text style={styles.addBtnText}>+ Add listing</Text>
          </TouchableOpacity>
        </View>

        {/* Recent bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent bookings</Text>
            <TouchableOpacity onPress={() => router.push('/(host)/bookings')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>

          {recentBookings.length === 0 ? (
            <View style={styles.emptyListings}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyText}>No bookings yet</Text>
            </View>
          ) : recentBookings.map(b => (
            <TouchableOpacity
              key={b.id}
              style={styles.bookingRow}
              onPress={() => router.push(`/(host)/bookings/${b.id}`)}
            >
              <View style={styles.bookingAvatar}>
                <Text style={styles.bookingAvatarText}>{b.guest_name[0]}</Text>
              </View>
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingGuest}>{b.guest_name}</Text>
                <Text style={styles.bookingDates}>
                  {formatDateRange(b.start_date, b.end_date)}
                </Text>
              </View>
              <View style={[
                styles.bookingStatusBadge,
                b.status === 'confirmed' && styles.statusConfirmed,
                b.status === 'pending' && styles.statusPending,
                b.status === 'active' && styles.statusActive,
                b.status === 'completed' && styles.statusCompleted,
              ]}>
                <Text style={styles.bookingStatusText}>{b.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tips for better ratings</Text>
          <View style={styles.tipsBox}>
            {[
              { emoji: '📸', tip: 'Add more photos for higher booking rates' },
              { emoji: '⚡', tip: 'Respond to guests within 1 hour' },
              { emoji: '📅', tip: 'Keep your calendar updated' },
            ].map(({ emoji, tip }) => (
              <View key={tip} style={styles.tipRow}>
                <Text style={styles.tipEmoji}>{emoji}</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xl,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCardPrimary: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  statLabel: { fontSize: 12, color: Colors.textSecondary },
  statLabelLight: { fontSize: 12, color: Colors.primaryDark, fontWeight: '600' },

  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seeAll: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  listingEmoji: {
    width: 64,
    height: 64,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingInfo: { flex: 1 },
  listingTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  listingPrice: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginBottom: 4 },
  listingStats: { flexDirection: 'row', gap: Spacing.md },
  listingStatText: { fontSize: 12, color: Colors.textSecondary },
  listingBadge: {
    backgroundColor: Colors.successSurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  listingBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.success },

  emptyListings: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  emptyEmoji: { fontSize: 32, marginBottom: Spacing.sm },
  emptyText: { fontSize: 14, color: Colors.textTertiary },

  addBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  addBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '700' },

  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bookingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingAvatarText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  bookingInfo: { flex: 1 },
  bookingGuest: { fontSize: 14, fontWeight: '600', color: Colors.text },
  bookingDates: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  bookingStatusBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: Colors.surfaceWarm,
  },
  statusConfirmed: { backgroundColor: Colors.successSurface },
  statusPending: { backgroundColor: Colors.warningSurface },
  statusActive: { backgroundColor: Colors.infoSurface },
  statusCompleted: { backgroundColor: Colors.surfaceWarm },
  bookingStatusText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  tipsBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  tipEmoji: { fontSize: 20, width: 28 },
  tipText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

  earningsCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  earningsTitle: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  earningsRow: { flexDirection: 'row', alignItems: 'center' },
  earningsItem: { flex: 1, alignItems: 'center' },
  earningsAmount: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  earningsLabel: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },
  earningsDivider: { width: 1, height: 36, backgroundColor: Colors.border },
})
