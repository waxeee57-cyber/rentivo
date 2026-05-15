---
paths: ["app/**/*.tsx", "components/**/*.tsx"]
---

# React Native Rules — Rentivo

## Kötelező minden képernyőn:
- useSafeAreaInsets() minden screen komponensben
- Loading state: ActivityIndicator, Colors.accent
- Error state: retry gombbal
- Empty state: illusztrációval vagy szöveggel
- Minden TouchableOpacity: accessibilityLabel + minHeight: 44
- Tab bar tartalom: paddingBottom: 100

## Tilos:
- console.log production kódban (csak // DEBUG: jelöléssel)
- service_role key client side-on
- MOCK_ adatok Config.useMock guard nélkül
- hardcoded €/day — mindig formatPricePerDay(price, language)

## I18n:
- useLanguageStore() minden szövegnél
- HU módban minden főképernyő magyarul

## Colors:
- background: Colors.background (#0A1628)
- accent: Colors.accent (#E8A44A)
- border: Colors.border (#1A2B45)
- text: Colors.text
- textSecondary: Colors.textSecondary
