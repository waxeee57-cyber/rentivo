import React, { useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics'
import { Fonts, Radius, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { useWishlistStore } from '@/lib/store/useWishlistStore'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { t } from '@/constants/i18n'
import type { Listing } from '@/types'

type Lang = 'en' | 'es' | 'hu'

/**
 * The scanning surface: many vehicles at once, for the moment before you know
 * what you want.
 *
 * A uniform matrix of identical cards is banned here, and not on taste grounds:
 * when every tile is the same size nothing is being recommended, the eye has no
 * entry point, and the screen reads as inventory rather than as an edit. So the
 * first listing runs full width at a landscape ratio and the rest fall into
 * pairs underneath it.
 *
 * STRUCTURE — one single-column FlatList over ROWS we assemble ourselves, not
 * `numColumns={2}` with the lead tile as ListHeaderComponent. numColumns cannot
 * span an item across both columns at all, and the header escape hatch is worse
 * than it looks: a header is never virtualised away, so the largest image on the
 * screen would stay mounted for the entire scroll, and the lead tile would live
 * outside the recycling window every other tile lives in. Rows give one item
 * type, one measurement path, one key space.
 */

const PAD = Spacing.base
const GUTTER = Spacing.sm + 2

type Row =
  | { kind: 'lead'; key: string; item: Listing }
  | { kind: 'pair'; key: string; left: Listing; right: Listing | null }

export interface DensityGridProps {
  listings: Listing[]
  lang: Lang
  onOpen: (listing: Listing) => void
  headerHeight?: number
  bottomInset?: number
}

function DensityGridImpl({
  listings, lang, onOpen, headerHeight = 0, bottomInset = 0,
}: DensityGridProps) {
  const C = useColors()

  const rows = useMemo<Row[]>(() => {
    if (listings.length === 0) return []
    const [lead, ...rest] = listings
    const out: Row[] = [{ kind: 'lead', key: `lead-${lead.id}`, item: lead }]
    for (let i = 0; i < rest.length; i += 2) {
      const left = rest[i]
      out.push({ kind: 'pair', key: `pair-${left.id}`, left, right: rest[i + 1] ?? null })
    }
    return out
  }, [listings])

  const renderRow = useCallback(({ item }: { item: Row }) => (
    item.kind === 'lead' ? (
      <GridTile listing={item.item} lang={lang} onOpen={onOpen} lead />
    ) : (
      <View style={styles.pair}>
        <GridTile listing={item.left} lang={lang} onOpen={onOpen} />
        {item.right ? (
          <GridTile listing={item.right} lang={lang} onOpen={onOpen} />
        ) : (
          // An odd tail keeps its empty column. Without the spacer the last
          // tile grows to fill the row, and a lone tile that is quietly a
          // different size from its twins reads as a layout bug.
          <View style={styles.spacer} />
        )}
      </View>
    )
  ), [lang, onOpen])

  return (
    <FlatList
      testID="density-grid"
      data={rows}
      keyExtractor={row => row.key}
      renderItem={renderRow}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + PAD, paddingBottom: bottomInset + PAD },
        rows.length === 0 && styles.contentEmpty,
      ]}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="car-outline" size={30} color={C.textTertiary} />
          <Text style={[styles.emptyTitle, { color: C.text }]}>{t('feedEmpty', lang)}</Text>
          <Text style={[styles.emptyHint, { color: C.textSecondary }]}>{t('feedEmptyHint', lang)}</Text>
        </View>
      }
    />
  )
}

interface GridTileProps {
  listing: Listing
  lang: Lang
  onOpen: (listing: Listing) => void
  lead?: boolean
}

function GridTileImpl({ listing, lang, onOpen, lead }: GridTileProps) {
  const C = useColors()
  // A selector that CALLS the predicate, not one that returns it: subscribing
  // to `isWishlisted` itself would subscribe to a reference that never changes,
  // so the heart would only catch up on some later unrelated render.
  const saved = useWishlistStore(s => s.isWishlisted(listing.id))
  const toggle = useWishlistStore(s => s.toggle)

  const uri = listing.cover_image_url ?? listing.images?.[0] ?? null
  // `Listing` carries no city of its own — the place belongs to whoever owns
  // the vehicle — so it comes through the joined owner, and is dropped rather
  // than rendered as a blank line when neither side was fetched.
  const city = listing.operator?.city ?? listing.host?.city ?? ''
  const rate = formatEUR(listing.price_per_day, lang)
  const unit = t('perDay', lang)

  const heart = useCallback(() => {
    void impactAsync(ImpactFeedbackStyle.Light)
    toggle(listing)
  }, [listing, toggle])

  return (
    <Pressable
      testID="grid-tile"
      accessibilityRole="button"
      // Composed by hand: left to itself the tile would be announced as three
      // loose fragments, and the price — the thing being compared — would land
      // last and detached from the vehicle it belongs to.
      accessibilityLabel={`${listing.title}${city ? `, ${city}` : ''}, ${rate} ${unit}`}
      onPress={() => onOpen(listing)}
      style={[
        styles.tile,
        lead ? styles.tileLead : styles.tileHalf,
        { backgroundColor: C.surfaceWarm, borderColor: C.border },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          recyclingKey={listing.id}
        />
      ) : null}

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(10,18,32,0)', 'rgba(10,18,32,0.34)', 'rgba(10,18,32,0.92)']}
        locations={[0.34, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* The scrim never reaches the top corner, so the heart brings its own
          backing — over a bright sky a bare white glyph disappears. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('feedShortlist', lang)}
        accessibilityState={{ selected: saved }}
        hitSlop={10}
        onPress={heart}
        style={styles.heart}
      >
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? C.primary : C.white} />
      </Pressable>

      {/* Pinned to white, not to C.text: the scrim under this type is a fixed
          dark navy in both themes, so light-mode ink would be black on black. */}
      <View style={styles.caption}>
        <Text style={[lead ? styles.titleLead : styles.title, { color: C.white }]} numberOfLines={2}>
          {listing.title}
        </Text>
        {city ? (
          <Text style={[styles.city, { color: C.white }]} numberOfLines={1}>{city}</Text>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: C.white }]} numberOfLines={1}>{rate}</Text>
          <Text style={[styles.priceUnit, { color: C.white }]} numberOfLines={1}>{unit}</Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: PAD },
  contentEmpty: { flexGrow: 1, justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: GUTTER },
  spacer: { flex: 1 },
  // Sized by aspectRatio off a flexed width rather than off a measured window:
  // rotation, split screen and the tablet breakpoint then need no re-measure
  // and no second render to settle.
  tile: { borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, marginBottom: GUTTER },
  tileLead: { aspectRatio: 16 / 10 },
  tileHalf: { flex: 1, aspectRatio: 3 / 4 },
  heart: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
    width: 30, height: 30, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,18,32,0.45)',
  },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.md },
  titleLead: { fontFamily: Fonts.extrabold, fontSize: 22, lineHeight: 25, letterSpacing: -0.7 },
  title: { fontFamily: Fonts.bold, fontSize: 14.5, lineHeight: 18, letterSpacing: -0.3 },
  city: { fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 2, opacity: 0.82 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 },
  price: { fontFamily: Fonts.extrabold, fontSize: 15.5, fontVariant: ['tabular-nums'] },
  priceUnit: { fontFamily: Fonts.medium, fontSize: 11, opacity: 0.78 },
  empty: { alignItems: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: Fonts.bold, fontSize: 16, textAlign: 'center' },
  emptyHint: { fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
})

// Memoised per tile, not just per grid: a heart toggle changes one listing's
// saved state, and without this every visible tile re-renders to redraw one glyph.
const GridTile = React.memo(GridTileImpl)

export const DensityGrid = React.memo(DensityGridImpl)
