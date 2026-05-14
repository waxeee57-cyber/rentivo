# Rentivo App — Claude Code Constitution

## Mi ez
Rentivo mobil marketplace app.
Turisták bérelhetnek autót, csónakot, villát, bringát
helyi operátoroktól (B2C) és magánszemélyektől (C2C).

## Stack
- Expo SDK 54 + expo-router v6
- TypeScript strict
- Supabase (auth, db, realtime, storage)
- Stripe Connect (payments, operator payouts)
- Zustand (state)
- react-native-maps (Apple Maps)
- react-native-reanimated v3.16 (szándékosan downgrade)
- @expo/vector-icons Ionicons
- date-fns, zod, react-hook-form

## Három user típus
1. TRAVELER  → bérel (consumer flows)
2. HOST      → magánszemély aki kiad (C2C)
3. OPERATOR  → profi vállalkozó (B2C)

## Architektúra
```
app/
  _layout.tsx           root layout
  index.tsx             role-based redirect
  (consumer)/           traveler flows
  (operator)/           operator flows
  (host)/               host flows (C2C)
  auth/                 login, role selection
components/
  ui/                   Button, Card, Badge, Input...
  map/                  térkép komponensek
  listing/              listing kártyák, calendar
  booking/              foglalás flow
  damage/               kárfelmérés
  operator/             operator UI
lib/
  supabase.ts
  stripe.ts
  storage.ts
  contract.ts
  notifications.ts
  store/                Zustand stores
  hooks/                custom hooks
  api/                  API layer
  utils/                helpers
types/index.ts           minden TypeScript type
constants/
  colors.ts             Dark Mediterranean theme
  i18n.ts               EN/ES/HU fordítások
  categories.ts
  config.ts
```

## Design — Dark Mediterranean
```
Background:   #0A1628  deep ocean blue
Surface:      #1A2942  dark blue card
Primary:      #E8A44A  Mediterranean gold
Text:         #F5F0E8  warm white
TextSecondary:#8A9BB5  muted blue-gray
Border:       #1E3050
```

## Szabályok
1. Minden szín Colors.* konstansból — soha hardcode
2. Minden string t() i18n funkción keresztül
3. Minden screen: loading state + error state
4. Minden kép: fallback ha betöltés sikertelen
5. Mock mód: EXPO_PUBLIC_USE_MOCK=true mindig működik
6. TypeScript strict — 0 hiba
7. Tab nevek: expose/search/bookings/profile (no /index suffix)
8. Visszagomb: ScreenHeader komponens minden nem-tab screenen

## Ismert működési szabályok
- initialRouteName NEM kerül a Tabs komponensbe
- expo-router v6: tab name = mappa neve (/index nélkül)
- Reanimated v3 — nem v4 (worklets kompatibilitás)
- Dark map style: customMapStyle prop a MapView-n

## Fontos fájlok
- constants/colors.ts    design tokens
- constants/i18n.ts      fordítások (EN/ES/HU)
- lib/mockData.ts        minden mock adat
- types/index.ts         minden type
- lib/store/useAuthStore role + session kezelés

## Tesztelés
`npx expo start --tunnel` → Expo Go QR kód
Mock mód: minden Supabase + Stripe hívás mockolt

## Debug Toolbar
Az Expo Go natív route overlay nem távolítható el React Native kóddal.
Production EAS buildben (TestFlight, App Store) NEM jelenik meg.
A bemutató Expo Go-ban zajlik — ez ismert korlát, nem bug.
