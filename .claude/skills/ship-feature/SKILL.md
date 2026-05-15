---
name: ship-feature
description: Új feature shippolása Rentivo-ban — migráció + backend + frontend + deploy sorrendben
---

# Ship Feature — Rentivo

Ha új feature-t kell shippolni, mindig ebben a sorrendben:

## 1. Supabase migráció (ha kell)
- Új fájl: supabase/migrations/NN_feature_name.sql
- RLS enabled
- Megfelelő policy-k
- npx supabase db push

## 2. Edge Function (ha kell)
- supabase/functions/function-name/index.ts
- CORS headers
- Auth header ellenőrzés
- npx supabase functions deploy function-name

## 3. API réteg
- lib/api/feature.ts
- Mock guard: if (Config.useMock) return mock
- Live Supabase hívás
- Proper error handling

## 4. Frontend
- app/(role)/screen.tsx
- Loading + Error + Empty state
- HU/EN i18n
- accessibilityLabel minden interaktív elemen
- SafeAreaView

## 5. TypeScript check
- npx tsc --noEmit
- 0 error kötelező

## 6. Commit
- git add .
- git commit -m "feat: ..."
- git push
