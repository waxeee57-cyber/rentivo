export const DarkColors = {
  // Backgrounds — deepened base with clear surface steps so cards separate
  // from the page without heavy shadows (2026 dark-mode recipe)
  background:     '#0A1220',
  surface:        '#141D2E',
  surfaceWarm:    '#1D2839',
  surfaceHover:   '#223048',

  // Primary — the brand coral, lifted for dark surfaces.
  //
  // This was amber #F0B15C, which meant the product had TWO brand hues: coral
  // (H≈17°) in light mode, gold (H≈38°) in dark. app.json pins
  // `userInterfaceStyle: "dark"`, and `Colors` below aliases DarkColors — so
  // gold was the colour every user actually saw, and the colour every
  // un-themed call site inherited. Gold-on-navy is the luxury cue the
  // positioning no longer trades on; deleting the word while shipping the
  // pigment changes nothing.
  //
  // Same hue as the light primary, lifted in value so it clears AA on dark.
  // Measured: textInverse #0A1220 on this fill = 7.25:1 (Button 'primary'
  // renders its label in textInverse). As text: 7.25:1 on background,
  // 6.53:1 on surface, 5.12:1 on surfaceHover.
  primary:        '#FF7A45',
  // Held strictly darker so the pressed ramp still reads as "deeper";
  // textInverse on it is still 5.19:1.
  primaryDark:    '#E05E2E',
  primarySurface: 'rgba(255,122,69,0.12)',
  primarySubtle:  'rgba(255,122,69,0.12)',

  // Text
  text:           '#F2F0EB',
  textSecondary:  '#A8B0BE',
  // 6.36:1 on background, 5.73:1 on surface, 5.04:1 on surfaceWarm,
  // 4.50:1 on surfaceHover #223048 (WCAG AA). Was #677182 — only 2.69:1 on
  // surfaceHover; this token carries real body copy, not decoration.
  textTertiary:   '#8C97AB',
  textInverse:    '#0A1220',

  // Borders — visible hairlines (cards used to melt into the navy)
  border:         '#26334A',
  borderWarm:     '#324159',
  // Renamed from the old gold-named border token. The light palette's value
  // had been coral for a while, so the name was already false there — and
  // here it was still pigment gold, putting a gold hairline on cards,
  // vouchers, the date picker and onboarding in the theme users actually run.
  borderAccent:   'rgba(255,122,69,0.30)',
  // WCAG 1.4.11 needs 3:1 for meaningful UI boundaries, and `border` only
  // manages 1.04:1 on surfaceHover — fine for a decorative divider, not for
  // something you must locate (input outlines, focusable cards). Use this
  // instead in those cases; `border` stays the quiet hairline.
  // 4.60:1 on background, 4.14:1 on surface, 3.64:1 on surfaceWarm,
  // 3.25:1 on surfaceHover.
  borderStrong:   '#727F90',

  // Status
  success:        '#4ECB8D',
  successSurface: 'rgba(78,203,141,0.14)',
  error:          '#F27E72',
  errorSurface:   'rgba(242,126,114,0.14)',
  // Stays amber on purpose. It used to be byte-identical to `primary`, which
  // made a caution state indistinguishable from a call to action; now that
  // primary is coral, amber is free to mean only "caution".
  warning:        '#F0B15C',
  warningSurface: 'rgba(240,177,92,0.14)',
  info:           '#5FA8EE',
  infoSurface:    'rgba(95,168,238,0.14)',

  // Platform colors (affiliate badges)
  airbnb:         '#FF5A5F',
  booking:        '#003580',
  turo:           '#00A699',
  vrbo:           '#1B68B3',

  // Special
  overlay:        'rgba(10,22,40,0.85)',
  overlayLight:   'rgba(10,22,40,0.5)',
  transparent:    'transparent',
  white:          '#FFFFFF',
  black:          '#000000',

  // Deep navy — the ink anchor; CTA fill in light mode
  navy:           '#0A1628',

  // Tier / loyalty gold. SCOPE: the Gold rung of the loyalty ladder and the
  // top operator tier — nothing else. A Gold tier is a rank name, the way it
  // is for every airline; it is not brand chrome. Do not reach for this token
  // for CTAs, borders or glows: that is what `primary` is for, and reaching
  // for gold is how the app ended up with a gold theme in the first place.
  //
  // Lives in the palette so it themes — it used to be a
  // fourth brand orange hardcoded outside both palettes (operator-tier.ts,
  // loyalty.ts), which meant it never adapted to light mode.
  // 8.78:1 on background, 7.90:1 on surface, 6.96:1 on surfaceWarm,
  // 6.21:1 on surfaceHover — it renders as label text, so AA applies.
  gold:           '#E8A44A',

  // Backward-compat aliases
  primaryLight:   '#FF9A70',
  surfaceCard:    '#1D2839',
  borderLight:    '#26334A',
  dark:           '#0A1220',
  darkSurface:    '#141D2E',
}

export const LightColors = {
  // Backgrounds — warm off-white page, pure-white cards: instant depth
  // without shadow effort
  background:     '#FAF9F7',
  surface:        '#FFFFFF',
  surfaceWarm:    '#F3F1ED',
  surfaceHover:   '#ECE9E3',

  // Primary — deepened coral. #FF6B35 was 2.9:1 on white; #E8500F fixed the
  // text case but as the PRIMARY BUTTON FILL it gave white 15px/600 labels only
  // 3.76:1, still failing AA. Same brand hue (H≈9°, S≈88%), darkened just past
  // the threshold: white text on primary = 5.14:1 (WCAG AA).
  primary:        '#C4400A',
  // Held strictly darker than `primary` so the pressed/hover ramp still reads
  // as "deeper" — white text 6.84:1.
  primaryDark:    '#A33508',
  primarySurface: 'rgba(196,64,10,0.08)',
  primarySubtle:  'rgba(196,64,10,0.08)',

  // Text — near-black ink, warm-grey hierarchy
  text:           '#1A1F2B',
  textSecondary:  '#5C6470',
  // 5.45:1 on surface #FFFFFF, 5.18:1 on background #FAF9F7,
  // 4.83:1 on surfaceWarm #F3F1ED, 4.50:1 on surfaceHover #ECE9E3 (WCAG AA).
  // Was #9AA1AB — 2.61:1 on white, 2.15:1 on surfaceHover. This is the lightest
  // value that still clears 4.5:1 against all four light surfaces; it is used
  // for real body copy in ~164 places, so AA applies, not the 3:1 UI rule.
  textTertiary:   '#646A73',
  textInverse:    '#FFFFFF',

  // Borders — warm hairlines
  border:         '#E8E4DE',
  borderWarm:     '#DDD8D0',
  borderAccent:   'rgba(196,64,10,0.25)',
  // WCAG 1.4.11 needs 3:1 for meaningful UI boundaries, and `border` only
  // manages 1.27:1 on white — fine for a decorative divider, not for something
  // you must be able to locate (input outlines, focusable cards). Use this
  // instead in those cases; `border` stays the quiet hairline.
  // 3.98:1 on surface, 3.78:1 on background, 3.53:1 on surfaceWarm,
  // 3.28:1 on surfaceHover.
  borderStrong:   '#847F76',

  // Status
  success:        '#1E7F4F',
  successSurface: 'rgba(30,127,79,0.09)',
  error:          '#C2372E',
  errorSurface:   'rgba(194,55,46,0.09)',
  // Deepened so the semantic warning ink clears AA on its own tinted chip —
  // Badge's warning/pending variants now use this pair instead of the CTA
  // orange. 5.70:1 on the 10% tint over surface, 4.74:1 over surfaceHover;
  // 6.61:1 for white text when used as a fill. #B25E09 only reached 4.10:1.
  warning:        '#8F4B07',
  warningSurface: 'rgba(143,75,7,0.10)',
  info:           '#0B62C4',
  infoSurface:    'rgba(11,98,196,0.09)',

  // Platform colors (same)
  airbnb:         '#FF5A5F',
  booking:        '#003580',
  turo:           '#00A699',
  vrbo:           '#1B68B3',

  // Special
  overlay:        'rgba(0,0,0,0.45)',
  overlayLight:   'rgba(0,0,0,0.25)',
  transparent:    'transparent',
  white:          '#FFFFFF',
  black:          '#000000',

  // Deep navy — the ink anchor; CTA fill in light mode
  navy:           '#0A1628',

  // Tier / loyalty gold — light-mode counterpart of DarkColors.gold. The dark
  // value (#E8A44A) is only 2.13:1 on white, and this is rendered as a small
  // caps label (TierBadge), so it is darkened to the same hue at AA strength.
  // 5.48:1 on surface, 5.21:1 on background, 4.86:1 on surfaceWarm,
  // 4.52:1 on surfaceHover.
  gold:           '#945D13',

  // Backward-compat aliases
  primaryLight:   '#FF6B35',
  surfaceCard:    '#FFFFFF',
  borderLight:    '#E8E4DE',
  dark:           '#FAF9F7',
  darkSurface:    '#F3F1ED',
}

// Backward-compatible default (dark theme)
export const Colors = DarkColors

export function getColors(isDark: boolean): typeof DarkColors {
  return isDark ? DarkColors : LightColors
}

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
}

export const Radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   24,
  xxl:  28,
  full: 999,
  pill: 999,  // backward-compat alias
}

// One whisper-soft elevation recipe (2026 style): large blur, low opacity,
// navy-tinted. Elevated surfaces should ALSO carry a hairline border —
// in dark mode separation comes from surface steps + borders, not shadows.
export const Shadow = {
  sm: {
    shadowColor: '#0A1628',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  md: {
    shadowColor: '#0A1628',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 5,
  },
  lg: {
    shadowColor: '#0A1628',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 9,
  },
  accent: {
    // Renamed from `gold` and re-sourced from `primary`. Its two call sites
    // are the selected map pin and a home-screen card — both of which fill
    // with C.primary, so a shadow sourced from `gold` put a gold glow under a
    // coral bubble. Brand glow follows the brand colour; `gold` is tiers only.
    shadowColor: DarkColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
}

// Brand type: Manrope (loaded in app/_layout via @expo-google-fonts/manrope).
// Custom font on every heading + price is what separates "designed product"
// from "system-font Android app".
//
// The token existed but was referenced in only 24 places against 342
// heading-weight text styles — i.e. the app shipped in Roboto and the brand
// face was decorative. Every text style is now pinned to a face (see the
// one-shot codemod in the 2026-08-04 pass), body included: a Manrope headline
// over a Roboto subtitle reads as an accident, not a pairing.
//
// IMPORTANT: set `fontFamily` INSTEAD of `fontWeight`, never both. Naming a
// specific face and a weight makes Android synthesise faux-bold on top of an
// already-bold face.
export const Fonts = {
  regular:   'Manrope_400Regular',
  medium:    'Manrope_500Medium',
  semibold:  'Manrope_600SemiBold',
  bold:      'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',

  // DISPLAY face, for headline moments only - the feed card title and the
  // rate, nothing else. Archivo is a signage grotesque, and at 40px against a
  // full-bleed photograph that is exactly the job: Manrope is a fine interface
  // face but it has almost no voice at display size. Same face the marketing
  // site uses, so the front door and the product finally read as one brand.
  //
  // Do NOT reach for this on body copy or labels. A display face used
  // everywhere stops being a display face.
  display:     'Archivo_800ExtraBold',
  displayBold: 'Archivo_700Bold',
}

// Type scale with negative tracking on display sizes (default tracking on
// large bold text is the #1 "undesigned" tell). Prices are tabular.
export const Typography = {
  display: { fontFamily: Fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -1.0 },
  h1:      { fontFamily: Fonts.extrabold, fontSize: 26, lineHeight: 33, letterSpacing: -0.6 },
  h2:      { fontFamily: Fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.4 },
  h3:      { fontFamily: Fonts.bold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  h4:      { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  body:    { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyM:   { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 22 },
  bodyS:   { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
  label:   { fontFamily: Fonts.semibold, fontSize: 11, lineHeight: 15, letterSpacing: 0.8 },
  caption: { fontFamily: Fonts.regular, fontSize: 11, lineHeight: 14 },
  price:   { fontFamily: Fonts.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.3, fontVariant: ['tabular-nums' as const] },
  priceS:  { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22, letterSpacing: -0.3, fontVariant: ['tabular-nums' as const] },
}
