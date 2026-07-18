# Rentivo (mobil app)

## MI EZ
React Native + Expo mobil app: rövidtávú bérlés-piactér három szereplővel —
TRAVELER (bérel), HOST (magánszemély, C2C kiadás), OPERATOR (profi vállalkozó, B2C).
Backend Supabase (Postgres + Edge Functions), fizetés Stripe Connect.
A DomRol flagship termék mobil fele; a webes párja: `C:\projects\rentivo-web`.

## STACK (mérve: package.json, 2026-07-18)
- expo@~54.0.33 (SDK 54)
- expo-router@~6.0.23
- react-native@0.81.5
- react@19.1.0 / react-dom@19.1.0
- typescript@~5.9.2 (devDep), @types/react@~19.1.0
- @supabase/supabase-js@^2.105.4
- @stripe/stripe-react-native@0.50.3
- @sentry/react-native@~7.2.0
- zustand@^5.0.13 (state), zod@^4.4.3 (validáció)
- react-hook-form@^7.75.0 + @hookform/resolvers@^5.2.2
- react-native-reanimated@~4.1.1 + react-native-worklets@0.5.1
- react-native-maps@1.20.1, react-native-webview@13.15.0, react-native-svg@15.12.1
- date-fns@^4.1.0
- Deploy: EAS Build (bizonyíték: `eas.json` — `preview` és `production` profil,
  channel: preview/production; iOS store distribution, Android app-bundle).
  Submit profil: iOS `appleId`/`ascAppId`/`appleTeamId` még placeholder
  ("YOUR_APPLE_ID"), Android `google-play-service-account.json` alapján.

## FUTTATÁS
```bash
npm start              # expo start
npm run android        # expo start --android
npm run ios            # expo start --ios
npm run web            # expo start --web

npm run test:e2e           # maestro test .maestro/flows/
npm run test:e2e:smoke     # maestro test .maestro/flows/ --include-tags=smoke
npm run test:e2e:critical  # maestro test .maestro/flows/ --include-tags=critical
npm run test:e2e:single    # maestro test
npm run test:e2e:record    # maestro record

npm run itest:payments     # tsx scripts/itest-payments.ts
npm run test:booking       # tsx scripts/test-booking-flow.ts

npx tsc --noEmit           # kötelező minden change után (globális szabály)
```

## STRUKTÚRA
```
app/            expo-router útvonalak: (admin) (consumer) (host) (operator) auth/ onboarding/ + _layout.tsx, index.tsx (role-alapú redirect)
components/     újrahasznált UI komponensek
constants/      config.ts — az összes EXPO_PUBLIC_ env egy helyen (Config objektum)
lib/            api/ (listings, bookings, payments…), store/ (Zustand), hooks/, utils/ + supabase.ts, stripe.ts, sentry.ts, mockData.ts, ical.ts, contract.ts, loyalty.ts, analytics.ts
services/       ai_agent/
supabase/       functions/ (20 Edge Function), migrations/ (57 migráció), config.toml, schema_dump.sql
scripts/        tsx integrációs tesztscriptek (itest-payments, test-booking-flow)
assets/         favicon, splash
stubs/          modul stubok
types/          megosztott TypeScript típusok
docs/           audits/, ops/, requirements.md
.maestro/       E2E flow-k (maestro)
.claude/        agent config: CLAUDE.md, rules/, skills/, agents/, hooks/, templates/
```

## KONVENCIÓK
- TypeScript strict — 0 error mindig; `npx tsc --noEmit` minden change után
- Mock mód: `EXPO_PUBLIC_USE_MOCK=true` → `Config.useMock` (constants/config.ts),
  `lib/mockData.ts`; backend nélkül is fusson
- Env: minden kliensoldali kulcs `EXPO_PUBLIC_` prefixszel, központilag a
  `constants/config.ts` `Config` objektumában olvasva
- Supabase kulcs-migráció: a kliens a ÚJ `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`-t
  preferálja, fallback a legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY`-re
- Edge Functionben a `SUPABASE_` prefix fenntartott → az új secretek `SB_SECRET_KEY` /
  `SB_PUBLISHABLE_KEY` néven, fallback-lánccal a legacy nevekre
- Maps gate: `EXPO_PUBLIC_MAPS_ENABLED` — default false, mert a `<MapView>` natív
  Google Maps API key nélkül mount-kor hard crashel (fail-safe: lista/placeholder)
- Platform jutalék: kliensen `EXPO_PUBLIC_PLATFORM_CUT`, Edge Functionben `PLATFORM_CUT`
  (mindkettő default '0.10')
- Globális DomRol szabályok, amik itt érvényesek: RLS minden Supabase táblán;
  minden ár EUR-ban tárolva; i18n EN/HU/ES a translations rendszeren át;
  min 44×44px touch target; SafeAreaView + proper padding minden képernyőn;
  `console.log` tilos production kódban; `.env` soha nem commitolható
- Domain-specifikus szabályok (forrás: `.claude/CLAUDE.md`):
  `user_id` (NEM `traveler_id`) a bookings táblában; push_token nullázás
  `.eq('auth_id', userId)`; `DELETED_USER_ID = '00000000-0000-0000-0000-000000000001'`

## HOL TART
- Utolsó commit: 2026-07-15 — `fix(payments): surface real edge-function error instead of generic Payment failed`
- Branch: `feat/payments-deposit-model-b`
- Uncommitted: 0
- Ismert korlátok (forrás: `.claude/CLAUDE.md`):
  - expo-router v6: tab name = mappa neve (`/index` nélkül)
  - Expo Go natív route overlay — production EAS buildben nem jelenik meg
  - `operator/fleet/[id].tsx` ~147. sor: `setTimeout(600)` mock-szag a KYC ágban
    (a fő mentés valódi, csak ez az ág) — NEM javítva, scope-on kívül
  - `supabase/functions/stripe-webhook | ical-export | ical-import`: léteznek és nem
    üres placeholderek, de funkcionális end-to-end ellenőrzés még ajánlott

## FIGYELEM
- **`.claude/CLAUDE.md` elavult ponton**: azt írja "Reanimated v3 (nem v4 —
  worklets kompatibilitás)", de a package.json tényleges verziója
  `react-native-reanimated@~4.1.1` + `react-native-worklets@0.5.1`.
  A doksi és a kód ellentmond — a kód a mérvadó. Tisztázni kell.
- **⚠️ HALOTT KÓDÁG: a Booking.com „live" hívás sosem tud authentikálni.**
  (Mérve 2026-07-18, kód szerint — nem javítva, mert biztonságos javítás csak
  szerveroldali proxyval lehetséges.)

  **Mit mértem:**
  - `lib/api/unifiedSearch.ts:21` → `const apiToken = process.env.BOOKING_API_TOKEN ?? ''`
  - A Metro/Expo bundler **kizárólag** az `EXPO_PUBLIC_*` prefixű env-változókat
    inline-olja a kliens bundle-be. `BOOKING_API_TOKEN` prefix nélküli →
    a bundle-ben **mindig `undefined`**, tehát `apiToken` **mindig `''`**.
  - `booking-affiliate.ts:144` és `:181` ezt küldi:
    `'Authorization': 'Bearer ' + apiToken` → a wire-on `Bearer ` (üres) → **401**.
  - `unifiedSearch.ts` a külső ágat `.catch((): AnyListing[] => [])`-tel zárja →
    a 401 **csendben elnyelődik**, a külső találatok üresen térnek vissza.
    Nincs log, nincs hibajelzés — ezért nem tűnt fel eddig.

  **Mock mód: RENDBEN, nem érinti.** `booking-affiliate.ts:136` és `:173` a
  függvény ELSŐ sorában `if (process.env.EXPO_PUBLIC_USE_MOCK === 'true')` →
  azonnal `MOCK_BOOKING_RESULTS` / `MOCK_BOOKING_CAR_RESULTS`, az `apiToken`-t
  el sem éri. Tehát mock módban a keresés helyesen működik; kizárólag a
  `USE_MOCK=false` + valós `affiliateId` kombináció halott.
  (Megjegyzés: a `hasCredentials` az `affiliateId`-től és a mock flagtől függ,
  az `apiToken`-től **nem** — ezért indul el egyáltalán a halott ág.)

  **❌ NE tedd rá az `EXPO_PUBLIC_` prefixet!** Az „megjavítaná" a tünetet, de
  a Booking.com API tokent **beleégetné a publikus kliens bundle-be** — bárki
  kibányászhatná az APK/IPA-ból. Ez server-only titok.

  **✅ Helyes megoldás:** Supabase Edge Function proxy
  (pl. `supabase/functions/booking-search`), ami szerveroldalon tartja a
  `BOOKING_API_TOKEN`-t (Supabase secret), és a kliens csak a proxyt hívja.
  A `searchBookingAccommodations` / `searchBookingCarRentals` hívásokat kell
  átirányítani rá. Amíg ez nincs meg, **maradjon `EXPO_PUBLIC_USE_MOCK=true`**,
  különben a külső találatok némán eltűnnek.
- **`.claude/CLAUDE.md` vs `.env.example` ellentmondás**: a doksi szerint
  "Config.useMock = false (live mód)", a `.env.example` viszont
  `EXPO_PUBLIC_USE_MOCK=true`-t ad. Az EAS preview/production profil `false`-ra állítja.
- **Didit KYC már kódban van** (`supabase/functions/didit-create-session`,
  `didit-webhook`), miközben a globális `CLAUDE.md` és a `.env.example`
  még "jövőbeni kapu"-ként listázza. A kód előrébb tart a doksinál.
- Repo-higiénia: a gyökérben `stripe.exe`, `main.py`, `test_agent.py`, `__pycache__/`,
  `build-log.txt`, `.env.stash-backup`, valamint egy `.next/` mappa (Next.js artifact
  egy Expo projektben) hever. A `.gitignore` fedi az `*.exe`/`__pycache__`/`.next/`-et,
  de a `.env.stash-backup`-ot a `.env.*` szabály fogja — ellenőrizd, hogy tényleg
  nincs-e trackelve.
- `git status` tiszta, de a branch **nem** `main`/`master`: `feat/payments-deposit-model-b`.
- node_modules jelen van (a repo telepített állapotú).

> TODO: ismeretlen — pótolni: tesztek tényleges zöld/piros státusza (a maestro E2E
> és az itest scriptek futási eredményét nem mértem, csak a létezésüket).
