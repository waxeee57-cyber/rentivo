# Rentivo — Tech Audit (2026-05-28)

Read-only audit: EAS config · Stripe · Monitoring · OTA · Hardening · Build

---

## A) Prioritált találati tábla

| Találat | Hol (fájl/útvonal) | Miért számít | Tengely | Súlyosság | Javasolt technika/lépés |
|---|---|---|---|---|---|
| `eas.projectId = "YOUR_EAS_PROJECT_ID"` | `app.json:69` | EAS build futtatáskor "project not found" hibával meghal, semmiféle éles build nem indítható | Élesítés | **BLOKKOLÓ** | `eas init` futtatása a valódi projekt ID beillesztésére |
| Apple submit config placeholder-ek | `eas.json:54-57` | `YOUR_APPLE_ID`, `YOUR_APP_STORE_CONNECT_APP_ID`, `YOUR_TEAM_ID` — `eas submit` ütközik | Élesítés | **BLOKKOLÓ** | ASC-ből kitölteni; Google Play service account JSON szintén hiányzik |
| Stripe publishable key érvénytelen formátum | `.env:3` | `mk_1TVZrn1i6DHpae6ZKVNBO8Ul` — `mk_` prefix nem létező Stripe key típus (csak `pk_test_` / `pk_live_` érvényes); `StripeProvider` csöndesen hibásodik | Élesítés | **BLOKKOLÓ** | Valódi `pk_live_...` key beillesztése; EAS Secrets-ben tárolni, nem .env-ben |
| `expo-updates` csomag hiányzik | `package.json` (teljes hiány) | `runtimeVersion` policy be van állítva app.json-ban, de az `expo-updates` package nélkül OTA update NEM működik — minden JS bugfix App Store beadást igényel (1-2 nap review delay) | Javítás | **FONTOS** | `npx expo install expo-updates`, `eas update:configure` |
| Nincs Error Boundary az app gyökerén | `app/_layout.tsx` (hiányzik) | Bármely nem kezelt JS runtime kivétel fehér képernyőre viszi az egész appot; nincs recovery gomb, nincs hibaüzenet | Működtetés | **FONTOS** | `class ErrorBoundary extends React.Component` a `_layout.tsx` gyökerén |
| Nincs crash / error monitoring | `package.json` (hiányzik) | Éles appon keletkező hibák semmilyen csatornán nem jelennek meg; invisible production outage | Működtetés | **FONTOS** | `@sentry/react-native` + Sentry.init az `_layout.tsx`-ben |
| `expo-splash-screen ^55.0.21` vs `expo ~54.0.33` | `package.json:39` | Expo SDK 55 csomag SDK 54 projektben — `npx expo prebuild` vagy natív build meglepetést okozhat | Élesítés | **FONTOS** | `npx expo install expo-splash-screen` (SDK 54-hez passzoló verzió) |
| `babel-preset-expo ^55.0.21` vs `expo ~54.0.33` | `package.json:61` | Ugyanaz — devDependency version mismatch Metro bundler szinten | Élesítés | **FONTOS** | `npx expo install --dev babel-preset-expo` |
| Operator `stripe_account_id = null` esetén booking nem blokkolt | `app/(consumer)/booking/[listingId].tsx:280` + `supabase/functions/create-payment-intent/index.ts:53` | Ha az operator nem fejezte be Stripe onboardingot (`stripe_onboarded = false`), a booking lefuthat — a pénz a platform direct accountjába kerül, transfer nem megy az operátornak. Nincs user-facing figyelmeztetés, nincs booking-block | Működtetés | **FONTOS** | A listing detail / booking screen ellenőrizze `listing.operator.stripe_onboarded`, ha false → banner + booking letiltás |
| `.env` commitolva git history-ban | `git log -- .env` (3 commit: `bfb128e`, `b0c8ca7`, `6d4827f`) | A commitolt tartalom csak `EXPO_PUBLIC_` értékeket tartalmaz (anon key, app URL) — nem server-side secret, de elvileg minden project clone megkapja | Javítás | **FONTOS** | `git filter-repo` vagy BFG Repo Cleaner; jövőben csak `.env.example`-t commit-olni |
| Edge Functions CORS `*` (nem autentikált endpointokon) | Összes `supabase/functions/*/index.ts` | JWT auth + Stripe signature véd, de `ical-export` publikusan hívható listing_id-vel; belső admin funkciók (`broadcast-push`) wide-open | Működtetés | **NICE** | `ical-export`-ra rate limit / listing ownership check; admin funkciókon origin whitelist |
| Edge Functions strukturált logging hiánya | Összes `supabase/functions/` | Csak implicit Deno stdout; nincs request_id, nincs structured JSON log, `stripe-webhook` error handler: `return new Response('Handler error', { status: 500 })` — semmi context | Javítás | **NICE** | `console.error(JSON.stringify({ fn, event, error }))` pattern minden catch ágban |
| TypeScript — 0 hiba | `npx tsc --noEmit` | Tiszta | — | OK | — |
| Privacy/Terms page | `rentivo-web/app/legal/privacy/page.tsx` + `.../terms/page.tsx` | Mindkét oldal létezik | — | OK | — |
| App Store metadata | `.claude/APP_STORE_SUBMISSION.md`, `.claude/APP_STORE_LISTING.md` | Dokumentálva van (screenshots és demo login még hiányzik) | Élesítés | NICE | Screenshot-ok elkészítése; demo@rentivo.com account létrehozása |
| Stripe Connect onboarding flow | `supabase/functions/create-stripe-account-link/index.ts` + `app/auth/operator-stripe.tsx` | Implementálva; webhook `account.updated` → `stripe_onboarded = true` | — | OK | — |
| `create-payment-intent` Edge Function | `supabase/functions/create-payment-intent/index.ts` | Teljes implementáció, Connect transfer_data kezeléssel | — | OK | — |
| `ical-export` / `ical-import` | `supabase/functions/ical-*/index.ts` | Mindkettő teljesen implementálva (nem placeholder) | — | OK | — |

---

## B) Top 5 következő lépés (kritikus út sorrendben)

1. **Stripe publishable key csere** — `.env:3` javítása érvényes `pk_live_...` kulcsra, EAS Secrets-be migrálás. Amíg ez nincs meg, az app egyetlen valódi fizetést sem tud feldolgozni.

2. **EAS project ID + Apple/Google submit config** — `eas init` futtatása, ASC-ből `appleId` + `ascAppId` + `appleTeamId` beillesztése `eas.json`-ba; Google Play service account JSON elkészítése. Ezek nélkül sem iOS build sem submit nem futtatható.

3. **`expo-splash-screen` és `babel-preset-expo` verziók kijavítása** — `npx expo install expo-splash-screen babel-preset-expo` az SDK 54-nek megfelelő verzióra. Blokkolhatja a produkciós natív buildet.

4. **`expo-updates` telepítése + EAS Update konfig** — `npx expo install expo-updates && eas update:configure`. Kritikus path az OTA bugfix képességhez; nélküle minden javítás = App Store review.

5. **Error Boundary + Sentry** — `@sentry/react-native` install + `ErrorBoundary` az `_layout.tsx` gyökerén. Éles indítás után 24 órán belül az első crashing bug vaknak találja a csapatot, ha ez nincs.

---

## C) Verdikt

**Nem élesíthető a jelenlegi állapotban.**

Két valódi blokkoló: (1) az `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` érvénytelen `mk_` prefixű kulcs — az app egyetlen éles Stripe tranzakciót sem tud elvégezni; (2) az EAS `projectId` és az Apple submit config tele van placeholderrel — EAS build és submit fizikailag nem futtatható.
