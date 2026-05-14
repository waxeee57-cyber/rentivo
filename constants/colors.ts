export const Colors = {
  // Backgrounds
  background:     '#0A1628',
  surface:        '#111E33',
  surfaceWarm:    '#162038',
  surfaceHover:   '#1A2845',

  // Primary
  primary:        '#E8A44A',
  primaryDark:    '#C8842A',
  primarySurface: 'rgba(232,164,74,0.12)',
  primarySubtle:  'rgba(232,164,74,0.12)',

  // Text
  text:           '#F5F0E8',
  textSecondary:  '#8A9BB5',
  textTertiary:   '#4A5E78',
  textInverse:    '#0A1628',

  // Borders
  border:         '#1E3050',
  borderWarm:     '#2A3F60',
  borderGold:     'rgba(232,164,74,0.3)',

  // Status
  success:        '#2D9B6F',
  successSurface: 'rgba(45,155,111,0.12)',
  error:          '#E05252',
  errorSurface:   'rgba(224,82,82,0.12)',
  warning:        '#E8A44A',
  warningSurface: 'rgba(232,164,74,0.12)',
  info:           '#4A9EE8',
  infoSurface:    'rgba(74,158,232,0.12)',

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

  // Backward-compat aliases (existing screens reference these)
  primaryLight:   '#F5C878',
  surfaceCard:    '#162038',
  borderLight:    '#1E3050',
  dark:           '#0A1628',
  darkSurface:    '#111E33',
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
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  full: 999,
  pill: 999,  // backward-compat alias
}

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  gold: {
    shadowColor: '#E8A44A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
}

export const Typography = {
  display: { fontSize: 32, fontWeight: '800' as const, lineHeight: 38 },
  h1:      { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2:      { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  h3:      { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  h4:      { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  body:    { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyM:   { fontSize: 15, fontWeight: '500' as const, lineHeight: 22 },
  bodyS:   { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label:   { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.8 },
  caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 14 },
  price:   { fontSize: 22, fontWeight: '800' as const, lineHeight: 26 },
  priceS:  { fontSize: 18, fontWeight: '700' as const, lineHeight: 22 },
}
