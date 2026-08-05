import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Fonts, Spacing, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { useWishlistStore } from '@/lib/store/useWishlistStore'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { t } from '@/constants/i18n'
import { Config } from '@/constants/config'
import type { Listing } from '@/types'

type Lang = 'en' | 'es' | 'hu'
type Colors = ReturnType<typeof useColors>

/**
 * The shortlist, side by side.
 *
 * Deciding is a COLUMN task: you read one attribute ACROSS the candidates, not
 * one candidate top to bottom. So the attribute labels are a fixed strip and
 * only the vehicles scroll sideways past them — two siblings in a row, a static
 * label column and a horizontal ScrollView, never one wide scroller. Shortlist
 * four and the fourth column starts off-screen; in a single scroller the labels
 * would leave with it, and a column of bare numbers with nothing naming them is
 * exactly the state this screen exists to prevent.
 *
 * Both halves are laid out on the same fixed HEAD_H / ROW_H grid, so their
 * hairlines meet across the seam without measuring anything. Drift of two
 * pixels here puts a deposit figure on the "Seats" line.
 */

const LABEL_W = 104
const COL_W = 148
const PHOTO_H = 64
const HEAD_H = 116
const ROW_H = 46

// The pinned column, top to bottom. Every vehicle column below builds its cells
// in this same order and the two must stay in lockstep — the labels are the only
// thing telling you what the number to their right is.
const ROW_KEYS = [
  'feedRowPerDay', 'feedRowDays', 'feedRowTotal', 'feedRowDeposit',
  'feedRowSeats', 'feedRowRating', 'feedRowBooking',
] as const

type RowKey = (typeof ROW_KEYS)[number]

const TABLE_H = HEAD_H + ROW_H * ROW_KEYS.length

// A dash, not a translated "unknown": a blank cell reads as a rendering fault,
// and a word would be the only prose sitting in a column of figures.
const ABSENT = '–'

interface Cell {
  key: RowKey
  text: string
  /** Money, counts and scores get tabular figures so the columns line up. */
  numeric: boolean
  /** Lowest in its row, and only ever set when there is something to be lower than. */
  low: boolean
}

interface Column {
  listing: Listing
  cells: Cell[]
}

export interface CompareSheetProps {
  visible: boolean
  onClose: () => void
  lang: Lang
  days: number
  onOpen: (listing: Listing) => void
}

function CompareSheetImpl({ visible, onClose, lang, days, onOpen }: CompareSheetProps) {
  const C = useColors()
  const insets = useSafeAreaInsets()
  // The shortlist is read here rather than passed in: the sheet is opened from a
  // toolbar that has no reason to know what is in it, and a removal made inside
  // the sheet has to land in the same store the hearts elsewhere read from.
  const items = useWishlistStore(s => s.items)
  const remove = useWishlistStore(s => s.remove)

  const columns = useMemo<Column[]>(() => {
    const money = items.map(l => {
      const subtotal = l.price_per_day * days
      return {
        perDay: l.price_per_day,
        total: subtotal + Math.round(subtotal * Config.platformCut),
        deposit: l.deposit_amount ?? 0,
      }
    })

    // Compared against the row MINIMUM, not against the first column, so every
    // vehicle tied for cheapest is marked — marking one of two identical prices
    // claims a difference that is not there. One column is lowest of nothing.
    const lows = money.length > 1
      ? {
        perDay: Math.min(...money.map(m => m.perDay)),
        total: Math.min(...money.map(m => m.total)),
        deposit: Math.min(...money.map(m => m.deposit)),
      }
      : null

    return items.map((listing, i) => {
      const m = money[i]
      return {
        listing,
        cells: [
          { key: 'feedRowPerDay', text: formatEUR(m.perDay, lang), numeric: true, low: lows !== null && m.perDay === lows.perDay },
          { key: 'feedRowDays', text: String(days), numeric: true, low: false },
          { key: 'feedRowTotal', text: formatEUR(m.total, lang), numeric: true, low: lows !== null && m.total === lows.total },
          { key: 'feedRowDeposit', text: formatEUR(m.deposit, lang), numeric: true, low: lows !== null && m.deposit === lows.deposit },
          { key: 'feedRowSeats', text: listing.capacity === null ? ABSENT : String(listing.capacity), numeric: true, low: false },
          { key: 'feedRowRating', text: `${listing.rating.toFixed(1)} (${listing.review_count})`, numeric: true, low: false },
          // Not a number, so never marked: "cheapest booking policy" is not a thing.
          { key: 'feedRowBooking', text: listing.instant_book ? t('instantBook', lang) : t('feedOnRequest', lang), numeric: false, low: false },
        ],
      }
    })
  }, [items, days, lang])

  return (
    // React Native's Modal, not a Reanimated translateY sheet: this surface has to
    // sit above the tab bar and take the Android hardware back button, and Modal is
    // the only one of the two that does both without a portal and a key listener.
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: C.overlay }]} testID="compare-sheet">
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t('closeSheet', lang)}
          onPress={onClose}
        />

        <View
          style={[styles.sheet, {
            backgroundColor: C.background,
            borderTopColor: C.border,
            marginTop: insets.top + Spacing.xxl,
            paddingBottom: insets.bottom + Spacing.base,
          }]}
        >
          <View style={styles.header}>
            <Text style={[styles.heading, { color: C.text }]} numberOfLines={1}>
              {t('feedCompareTitle', lang)}
            </Text>
            <Pressable
              testID="compare-close"
              accessibilityRole="button"
              accessibilityLabel={t('closeSheet', lang)}
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => [styles.close, {
                borderColor: C.borderStrong,
                backgroundColor: pressed ? C.surfaceHover : 'transparent',
              }]}
            >
              <Ionicons name="close" size={18} color={C.text} />
            </Pressable>
          </View>

          {columns.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={30} color={C.textTertiary} />
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>
                {t('feedCompareEmpty', lang)}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
            >
              <View style={styles.table}>
                {/* Sibling of the horizontal scroller, not a child of it. */}
                <View style={[styles.labelCol, { backgroundColor: C.background, borderRightColor: C.border }]}>
                  <View style={styles.labelHeadSpacer} />
                  {ROW_KEYS.map(key => (
                    <View key={key} style={[styles.labelCell, { borderBottomColor: C.border }]}>
                      <Text style={[styles.label, { color: C.textTertiary }]} numberOfLines={2}>
                        {t(key, lang)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* `flex: 1` is load-bearing, not cosmetic: unbounded, this scroller
                    would size itself to the full width of every column and simply be
                    clipped by the sheet, which is the unreachable-last-column bug
                    the pinned layout exists to solve. */}
                <ScrollView
                  horizontal
                  style={styles.stripBox}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.strip}
                >
                  {columns.map(column => (
                    <CompareColumn
                      key={column.listing.id}
                      column={column}
                      lang={lang}
                      C={C}
                      onOpen={onOpen}
                      onRemove={remove}
                    />
                  ))}
                </ScrollView>
              </View>
            </ScrollView>
          )}

          {/* The note explains the green marks and the fee inside the total, so it
              is withheld when there is no table for it to be about. */}
          {columns.length > 0 ? (
            <Text style={[styles.note, { color: C.textTertiary }]}>{t('feedCompareNote', lang)}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

interface CompareColumnProps {
  column: Column
  lang: Lang
  C: Colors
  onOpen: (listing: Listing) => void
  onRemove: (id: string) => void
}

function CompareColumnImpl({ column, lang, C, onOpen, onRemove }: CompareColumnProps) {
  const { listing, cells } = column
  const uri = listing.cover_image_url ?? listing.images?.[0] ?? null
  // `Listing` carries no city of its own; it belongs to whoever owns the vehicle.
  const city = listing.operator?.city ?? listing.host?.city ?? ''

  return (
    <View style={[styles.col, { borderRightColor: C.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${listing.title}${city ? `, ${city}` : ''}`}
        onPress={() => onOpen(listing)}
        style={styles.head}
      >
        <View style={[styles.photo, { backgroundColor: C.surfaceWarm }]}>
          {uri ? (
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={180}
              recyclingKey={listing.id}
            />
          ) : null}
        </View>
        <Text style={[styles.colTitle, { color: C.text }]} numberOfLines={2}>{listing.title}</Text>
      </Pressable>

      {/* Floats over the photo instead of taking a line of its own: the head sits
          on the same fixed grid as the pinned labels, so nothing may add height.
          It also carries its own backing — a bare glyph vanishes over a bright sky. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('feedShortlist', lang)}
        accessibilityState={{ selected: true }}
        hitSlop={8}
        onPress={() => onRemove(listing.id)}
        style={styles.remove}
      >
        <Ionicons name="close" size={13} color={C.white} />
      </Pressable>

      {cells.map(cell => (
        <View key={cell.key} style={[styles.cell, { borderBottomColor: C.border }]}>
          <Text
            style={[cell.numeric ? styles.valueNum : styles.value, { color: cell.low ? C.success : C.text }]}
            numberOfLines={1}
          >
            {cell.text}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    flex: 1,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.base,
  },
  heading: { fontFamily: Fonts.extrabold, fontSize: 24, letterSpacing: -0.8, flexShrink: 1 },
  close: {
    width: 36, height: 36, borderRadius: Radius.full, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  // Bounded so the table scrolls inside the sheet rather than growing past it and
  // shoving the footer note off the bottom edge on a short screen.
  sheetScroll: { flex: 1 },
  body: { paddingBottom: Spacing.sm },
  // Height is stated, not measured: it is what keeps the pinned labels and the
  // scrolling cells on one grid, and it lets the horizontal ScrollView stretch
  // to the label column instead of settling a frame later.
  table: { flexDirection: 'row', height: TABLE_H },
  labelCol: { width: LABEL_W, paddingLeft: Spacing.lg, borderRightWidth: 1 },
  labelHeadSpacer: { height: HEAD_H },
  labelCell: { height: ROW_H, justifyContent: 'center', paddingRight: Spacing.sm, borderBottomWidth: 1 },
  label: { fontFamily: Fonts.bold, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase' },
  stripBox: { flex: 1 },
  // Only trailing padding: the strip must run off the right edge, since a column
  // clipped mid-width is the cue that there is more of it to reach.
  strip: { paddingRight: Spacing.lg },
  col: { width: COL_W, borderRightWidth: 1 },
  head: { height: HEAD_H, paddingHorizontal: Spacing.md, paddingTop: Spacing.xs },
  photo: { height: PHOTO_H, borderRadius: Radius.sm, overflow: 'hidden' },
  colTitle: { fontFamily: Fonts.bold, fontSize: 13.5, lineHeight: 17, letterSpacing: -0.2, marginTop: Spacing.sm },
  remove: {
    position: 'absolute', top: Spacing.sm, right: Spacing.base,
    width: 22, height: 22, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,18,32,0.55)',
  },
  cell: { height: ROW_H, justifyContent: 'center', paddingHorizontal: Spacing.md, borderBottomWidth: 1 },
  value: { fontFamily: Fonts.medium, fontSize: 13.5 },
  valueNum: { fontFamily: Fonts.bold, fontSize: 14.5, fontVariant: ['tabular-nums'] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
  emptyText: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  note: { fontFamily: Fonts.regular, fontSize: 11.5, lineHeight: 16, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
})

// Memoised per column: removing one vehicle should not redraw the photos of the
// others, and those are the most expensive thing on the sheet.
const CompareColumn = React.memo(CompareColumnImpl)

export const CompareSheet = React.memo(CompareSheetImpl)
