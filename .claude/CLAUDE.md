# Rentivo — Claude Code Configuration

## Projekt
React Native + Expo app (C:\projects\Rentivo)
Supabase: xeyfsacbozucxrwlefro.supabase.co
Web: rentivo.domrol.com

## Gyors referencia
- Részletes szabályok: .claude/rules/ mappában
- Feature shippolás: /ship-feature skill
- RLS audit: /rls-audit skill
- Stripe debug: /stripe-debug skill
- Teljes audit: /full-audit skill

## Legfontosabb szabályok
- 0 TypeScript error minden commitnál
- Config.useMock = false (live mód)
- user_id (NEM traveler_id) a bookings táblában
- push_token nullázás: .eq('auth_id', userId)
- DELETED_USER_ID = '00000000-0000-0000-0000-000000000001'

## Három user típus
1. TRAVELER → bérel (consumer flows)
2. HOST → magánszemély aki kiad (C2C)
3. OPERATOR → profi vállalkozó (B2C)

## Architektúra
```
app/
  _layout.tsx           root layout
  index.tsx             role-based redirect
  (consumer)/           traveler flows
  (operator)/           operator flows
  (host)/               host flows (C2C)
  auth/                 login, role selection
components/ui/          Button, Card, Badge, Input...
lib/api/                API layer (listings, bookings, payments...)
lib/store/              Zustand stores
supabase/functions/     Edge Functions
supabase/migrations/    DB migrációk
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

## Bug-státusz (2026-06 audit alapján mérve)
JAVÍTVA (kódban igazolva):
- booking/[listingId].tsx: Stripe CardField + useStripe + confirmPayment MEGVAN
- booking/[listingId].tsx: startDate/endDate route-paramból jön (startDateParam/endDateParam), NEM +1/+4 hardcode
- bookings/review/[bookingId].tsx: user_id = user.id (NEM null) — RLS rendben
- operator/fleet/[id].tsx: handleSave hív updateListing-et + supabase.update-et (nem mock)
- host/listings/new.tsx: handlePublish hív createListing-et (Supabase)
- supabase/functions/create-payment-intent: létezik (~110 sor)
- supabase/functions/stripe-webhook | ical-export | ical-import: fájlok léteznek, nem üres placeholderek (67/68/118 sor) — funkcionális end-to-end ellenőrzés még ajánlott

NYITOTT PONT (NEM javítva, scope-on kívül):
- operator/fleet/[id].tsx ~147. sor: setTimeout(600) mock-szag a KYC ágban (a fő mentés valódi, csak ez az ág)

## Agents
- lead-orchestrator: fő koordinátor (opus)
- supabase-backend: DB + Edge Functions
- rn-frontend: UI + komponensek
- stripe-payments: fizetési flow
- code-reviewer: TypeScript + security
- marketing-seo: SEO + App Store
- test-runner: flow audit

## Tesztelés
`npx expo start --tunnel` → Expo Go QR kód
Mock mód: EXPO_PUBLIC_USE_MOCK=true

## Ismert korlátok
- expo-router v6: tab name = mappa neve (/index nélkül)
- Reanimated v3 (nem v4 — worklets kompatibilitás)
- Expo Go natív route overlay — production EAS buildben nem jelenik meg
