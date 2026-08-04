/**
 * Shared expo-image defaults.
 *
 * Every remote image in the app was being rendered bare — no transition, no
 * placeholder, no cache policy — so photos popped in as hard rectangles and
 * FlatList rows flashed the previous row's photo while scrolling. These
 * constants are defined once here and imported, so the look stays identical
 * across the carousel, the cards and the map sheet.
 */

/**
 * Neutral warm-grey 4x3 blurhash (decodes to ~rgb(224,221,216)), deliberately
 * chosen to sit in the same family as `surfaceWarm` in the light palette and
 * to read as "empty surface" rather than "wrong photo". A subject-specific
 * blurhash would need to come from the backend per image; until then a
 * content-agnostic one avoids promising a colour the real photo won't have.
 */
export const NEUTRAL_BLURHASH = 'LJP%Fe-:fQ-:~qoffQofoffQfQfQ'

/** Ready-made `placeholder` prop value — avoids allocating a new object per render. */
export const IMAGE_PLACEHOLDER = { blurhash: NEUTRAL_BLURHASH } as const

/**
 * Standard cross-fade. 250ms is long enough to read as a fade and short
 * enough that it never feels like the image is loading slowly.
 */
export const IMAGE_TRANSITION = 250

/** Hero/full-bleed imagery gets a touch longer so the reveal feels deliberate. */
export const IMAGE_TRANSITION_HERO = 300

/**
 * memory-disk keeps photos across screen pops AND across app restarts.
 * Listing photos are immutable at their URL, so there is nothing to
 * invalidate — the only cost is disk, which expo-image bounds itself.
 */
export const IMAGE_CACHE_POLICY = 'memory-disk' as const
