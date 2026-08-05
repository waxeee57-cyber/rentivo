import React, { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, FlatList, useWindowDimensions,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Fonts, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { formatEUR } from '@/lib/utils/formatCurrency'
import { t } from '@/constants/i18n'
import { Config } from '@/constants/config'
import type { Listing } from '@/types'

type Lang = 'en' | 'es' | 'hu'
type Colors = ReturnType<typeof useColors>

/**
 * One vehicle, one viewport.
 *
 * THE RULE: the footer is a SIBLING of the horizontal rail, never a child of
 * it. Title, rate, total, deposit, host and the reserve bar stay pinned while
 * the media scrolls sideways underneath. Put the footer inside the rail and
 * you get the card we were shown as a reference, where swiping to a second
 * photo loses sight of the price you are deciding on.
 *
 * The sideways axis goes DEEPER, not wider: photos, then the inclusions and
 * the money breakdown. "Show me another one" is the vertical axis; mixing the
 * two makes the surface mean nothing.
 */

const RECEIPT = '__receipt__'

export interface FeedCardProps {
  listing: Listing
  days: number
  lang: Lang
  saved: boolean
  onToggleSave: (listing: Listing) => void
  onReserve: (listing: Listing) => void
  onShare: (listing: Listing) => void
  /** Only the visible card and its neighbours decode at high priority. */
  active: boolean
}

function FeedCardImpl({
  listing, days, lang, saved, onToggleSave, onReserve, onShare, active,
}: FeedCardProps) {
  const C = useColors()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [pane, setPane] = useState(0)

  const photos = (listing.images?.length ? listing.images : [listing.cover_image_url])
    .filter((u): u is string => Boolean(u))
    .slice(0, 5)
  const panes: string[] = [...photos, RECEIPT]

  const subtotal = listing.price_per_day * days
  const fee = Math.round(subtotal * Config.platformCut)
  const total = subtotal + fee
  const deposit = listing.deposit_amount ?? 0
  const owner = listing.host?.name ?? listing.operator?.name ?? ''
  const ownerKind = listing.owner_type === 'host'
    ? t('feedPrivateHost', lang)
    : t('feedVerifiedOperator', lang)

  const onRailScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    setPane(p => (p === i ? p : i))
  }, [width])

  const save = useCallback(() => {
    void impactAsync(ImpactFeedbackStyle.Light)
    onToggleSave(listing)
  }, [listing, onToggleSave])

  return (
    <View style={[styles.card, { width, height, backgroundColor: C.background }]} testID="feed-card">
      <FlatList
        data={panes}
        keyExtractor={(_, i) => `${listing.id}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onRailScroll}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}
        renderItem={({ item }) => item === RECEIPT ? (
          <View style={{ width, height, paddingTop: insets.top + 74, paddingHorizontal: 22 }}>
            <Text style={[styles.eyebrow, { color: C.primary }]}>{t('feedWhatYouGet', lang)}</Text>
            <View style={{ marginTop: 10 }}>
              {(listing.features ?? []).slice(0, 4).map(f => (
                <View key={f} style={[styles.incRow, { borderBottomColor: C.border }]}>
                  <View style={[styles.incDot, { backgroundColor: C.primary }]} />
                  <Text style={[styles.incText, { color: C.text }]}>{f}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.eyebrow, { color: C.primary, marginTop: 22 }]}>
              {t('feedMoneyGoes', lang)}
            </Text>
            <View style={{ marginTop: 8 }}>
              <ReceiptRow
                label={`${formatEUR(listing.price_per_day, lang)} × ${days}`}
                value={formatEUR(subtotal, lang)} C={C}
              />
              <ReceiptRow label={t('feedServiceFee', lang)} value={formatEUR(fee, lang)} C={C} />
              <ReceiptRow label={t('feedYouPay', lang)} value={formatEUR(total, lang)} C={C} strong />
            </View>
            <Text style={[styles.fine, { color: C.textTertiary }]}>
              {deposit === 0
                ? t('feedDepositZero', lang)
                : t('feedDepositHeld', lang, { amount: formatEUR(deposit, lang) })}
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: item }}
            style={{ width, height }}
            contentFit="cover"
            transition={220}
            priority={active ? 'high' : 'low'}
            recyclingKey={item}
          />
        )}
      />

      {/* The scrim exists only to make type legible over photographs, so it
          must not sit on the receipt pane and fog it. */}
      {pane < photos.length ? (
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(10,18,32,0.88)', 'rgba(10,18,32,0.26)', 'rgba(10,18,32,0)',
            'rgba(10,18,32,0.92)', C.background,
          ]}
          locations={[0, 0.12, 0.26, 0.48, 0.6]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={[styles.dots, { top: insets.top + 52 }]} pointerEvents="none">
        {panes.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === pane && styles.dotOn,
              { backgroundColor: i === pane ? C.text : C.borderStrong },
            ]}
          />
        ))}
      </View>

      <View style={[styles.foot, { paddingBottom: insets.bottom + 104 }]} pointerEvents="box-none">
        <Text style={[styles.eyebrow, { color: C.primary }]}>{listing.category}</Text>
        <Text style={[styles.title, { color: C.text }]} numberOfLines={2}>{listing.title}</Text>

        <View style={styles.specs}>
          {listing.capacity ? (
            <Text style={[styles.spec, { color: C.textSecondary }]}>
              {t('feedSeatsN', lang, { n: String(listing.capacity) })}
            </Text>
          ) : null}
          {listing.year ? (
            <Text style={[styles.spec, { color: C.textSecondary }]}>{String(listing.year)}</Text>
          ) : null}
          <Text style={[styles.spec, { color: C.textSecondary }]}>
            {`★ ${listing.rating.toFixed(1)} (${listing.review_count})`}
          </Text>
        </View>

        {/* The money block is the argument. No struck-through price, no
            percentage badge: the rate you compare on, the total you actually
            pay, and the deposit every competitor hides until the counter. */}
        <View style={[styles.money, { borderTopColor: C.border }]}>
          <View>
            <Text style={[styles.rate, { color: C.text }]}>{formatEUR(listing.price_per_day, lang)}</Text>
            <Text style={[styles.rateUnit, { color: C.textSecondary }]}>{t('perDay', lang)}</Text>
          </View>
          <View style={[styles.moneyCell, { borderLeftColor: C.border }]}>
            <Text style={[styles.moneyLabel, { color: C.textTertiary }]}>
              {t('feedDaysN', lang, { n: String(days) })}
            </Text>
            <Text style={[styles.moneyValue, { color: C.text }]}>{formatEUR(total, lang)}</Text>
          </View>
          <View style={[styles.moneyCell, { borderLeftColor: C.border }]}>
            <Text style={[styles.moneyLabel, { color: C.textTertiary }]}>{t('deposit', lang)}</Text>
            <Text style={[styles.moneyValue, { color: deposit === 0 ? C.success : C.text }]}>
              {formatEUR(deposit, lang)}
            </Text>
          </View>
        </View>

        {owner ? (
          <View style={styles.host}>
            <View style={[styles.avatar, { backgroundColor: C.primary }]}>
              <Text style={[styles.avatarText, { color: C.textInverse }]}>{owner.slice(0, 1)}</Text>
            </View>
            <Text style={[styles.hostName, { color: C.text }]} numberOfLines={1}>{owner}</Text>
            <Text style={[styles.hostKind, { color: C.textTertiary }]} numberOfLines={1}>{ownerKind}</Text>
          </View>
        ) : null}

        <View style={styles.cta}>
          <Pressable
            testID="feed-reserve"
            accessibilityRole="button"
            onPress={() => onReserve(listing)}
            style={({ pressed }) => [
              styles.reserve, { backgroundColor: pressed ? C.primaryDark : C.primary },
            ]}
          >
            <Text style={[styles.reserveText, { color: C.textInverse }]} numberOfLines={1}>
              {t('feedReserveFor', lang, { amount: formatEUR(total, lang) })}
            </Text>
          </Pressable>

          <Pressable
            testID="feed-save"
            accessibilityRole="button"
            accessibilityLabel={t('feedShortlist', lang)}
            onPress={save}
            style={[styles.ghost, {
              borderColor: saved ? C.primary : C.borderStrong,
              backgroundColor: saved ? C.primary : 'transparent',
            }]}
          >
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={19} color={saved ? C.textInverse : C.text} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('feedShare', lang)}
            onPress={() => onShare(listing)}
            style={[styles.ghost, { borderColor: C.borderStrong }]}
          >
            <Ionicons name="arrow-redo-outline" size={19} color={C.text} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

function ReceiptRow({ label, value, C, strong }: {
  label: string; value: string; C: Colors; strong?: boolean
}) {
  return (
    <View style={[styles.recRow, { borderBottomColor: C.border }]}>
      <Text style={[strong ? styles.recLabelStrong : styles.recLabel,
        { color: strong ? C.text : C.textSecondary }]}>{label}</Text>
      <Text style={[strong ? styles.recValueStrong : styles.recValue, { color: C.text }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 99 },
  dotOn: { width: 16 },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 22 },
  eyebrow: { fontFamily: Fonts.bold, fontSize: 10.5, letterSpacing: 1.8, textTransform: 'uppercase' },
  // Deliberately bolder than the web card, and set in the DISPLAY face: on a
  // phone the title is the only thing competing with a full-bleed photograph,
  // so it has to win outright. Manrope is a good interface face with almost no
  // voice at 40px; Archivo is a signage grotesque, which is the job here.
  title: { fontFamily: Fonts.display, fontSize: 42, lineHeight: 42, letterSpacing: -1.9, marginTop: 8 },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  spec: { fontFamily: Fonts.medium, fontSize: 12.5 },
  money: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 16, borderTopWidth: 1, paddingTop: 14 },
  // The rate is the second display moment. Same face as the title so the two
  // numbers a renter actually decides on share a voice.
  rate: { fontFamily: Fonts.display, fontSize: 42, letterSpacing: -1.9, fontVariant: ['tabular-nums'] },
  rateUnit: { fontFamily: Fonts.medium, fontSize: 12 },
  moneyCell: { paddingLeft: 16, borderLeftWidth: 1 },
  moneyLabel: { fontFamily: Fonts.bold, fontSize: 9.5, letterSpacing: 1.3, textTransform: 'uppercase' },
  moneyValue: { fontFamily: Fonts.extrabold, fontSize: 19, marginTop: 3, fontVariant: ['tabular-nums'] },
  host: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  avatar: { width: 24, height: 24, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Fonts.extrabold, fontSize: 11 },
  hostName: { fontFamily: Fonts.bold, fontSize: 12.5, maxWidth: 130 },
  hostKind: { fontFamily: Fonts.regular, fontSize: 12.5, flexShrink: 1 },
  cta: { flexDirection: 'row', gap: 8, marginTop: 16 },
  reserve: { flex: 1, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  reserveText: { fontFamily: Fonts.extrabold, fontSize: 15.5 },
  ghost: { width: 52, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  incRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  incDot: { width: 7, height: 7, borderRadius: 99 },
  incText: { fontFamily: Fonts.medium, fontSize: 14, flex: 1 },
  recRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1 },
  recLabel: { fontFamily: Fonts.medium, fontSize: 14 },
  recLabelStrong: { fontFamily: Fonts.extrabold, fontSize: 16 },
  recValue: { fontFamily: Fonts.bold, fontSize: 14, fontVariant: ['tabular-nums'] },
  recValueStrong: { fontFamily: Fonts.extrabold, fontSize: 16, fontVariant: ['tabular-nums'] },
  fine: { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 18, marginTop: 12 },
})

export const FeedCard = React.memo(FeedCardImpl)
