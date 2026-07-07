# Rentivo — Fix Report (2026-05-28)

A TECH_AUDIT.md kódból, biztonságosan megoldható blokkolóinak javítása.
Verifikáció: `npx tsc --noEmit` → **0 hiba**; Metro dev boot → **tiszta indulás** DSN és valódi Stripe kulcs nélkül.

---

## 1. SDK 54 verzió-illesztés
**Cél:** SDK 55-ös csomagok SDK 54-es projektben → build-meglepetés.

- `expo-splash-screen`: `^55.0.21` → `~31.0.13` (`npx expo install`)
- `babel-preset-expo`: `^55.0.21` → `~54.0.10` (expo install nem frissítette automatikusan, explicit `npm install babel-preset-expo@~54.0.10`)

**Fájlok:** `package.json`, `package-lock.json`

**Megjegyzés:** `npx expo install --check` további, NEM scope-beli mismatch-eket jelez, amiket szándékosan NEM nyúltam: `react-native-reanimated@3.16.0` (a CLAUDE.md kifejezetten v3-on pin-eli a worklets kompatibilitás miatt — v4-re NEM frissítettem), `react-native-svg`, `expo-linear-gradient`. Ezek külön döntést igényelnek.

## 2. expo-updates (OTA hotfix)
- `expo-updates` telepítve: `~29.0.17` (`npx expo install`)
- `app.json`: `updates` blokk hozzáadva (`url: https://u.expo.dev/YOUR_EAS_PROJECT_ID`, `fallbackToCacheTimeout: 0`). A `runtimeVersion: { policy: "appVersion" }` már megvolt.
- `eas.json`: `"channel": "production"` a production profilra, `"channel": "preview"` a preview profilra.

**Fájlok:** `package.json`, `app.json`, `eas.json`

**FIGYELEM — Roli manuális lépése:** az `updates.url` jelenleg a `YOUR_EAS_PROJECT_ID` placeholderre mutat. Valódi `eas init` (projectId) után aktiválódik. Az `eas update:configure` és a tényleges `eas update` futtatás EAS login-t igényel — ezt NEM futtattam.

## 3. Globális ErrorBoundary
**Cél:** kezeletlen JS kivétel = fehér képernyő, nincs recovery.

- Új komponens: `components/ErrorBoundary.tsx` — class component, user-facing fallback (🌴 + cím + leírás + „Újra" gomb ami reseteli a state-et), NEM nyers stack a usernek. EN/HU/ES szöveg, nyelv az auth store-ból defenzíven (try/catch fallback `en`-re). 44px touch target, accessibility label.
- `componentDidCatch` → `Sentry.captureException` (4. taszk wrapper-én keresztül).
- `app/_layout.tsx`: a `RootLayout` átnevezve `RootLayoutInner`-re; az új default export `RootLayout` becsomagolja `<ErrorBoundary>`-be → mind a layout render-, mind a screen-hibákat elkapja.

**Fájlok:** `components/ErrorBoundary.tsx` (új), `app/_layout.tsx`

## 4. Sentry — telepítés + scaffold (DSN env-ből, NEM wizard)
- `@sentry/react-native`: `7.2.0` telepítve (`npx expo install`).
- A config plugin (`@sentry/react-native`) az `app.json` `plugins` tömbjébe automatikusan bekerült.
- Új wrapper: `lib/sentry.ts` — `initSentry()` a DSN-t `process.env.EXPO_PUBLIC_SENTRY_DSN`-ből olvassa; **ha üres/hiányzik, az init csendben kihagyódik** (az app DSN nélkül is indul). `captureException()` helper, ami init nélkül dev-warningot ad.
- **Replay és user-feedback szándékosan KIKAPCSOLVA** (SDK 54 iOS build-inkompatibilitás) — csak error monitoring + 0.2 traces sample.
- `initSentry()` modul szinten hívva az `app/_layout.tsx`-ben.
- `.env.example`: `EXPO_PUBLIC_SENTRY_DSN=` és `SENTRY_AUTH_TOKEN=` hozzáadva (érték nélkül).

**Fájlok:** `lib/sentry.ts` (új), `app/_layout.tsx`, `app.json`, `.env.example`, `package.json`

**Megjegyzés:** a Sentry expo config plugin a boot során figyelmeztet: „Missing config for organization, project. Environment variables will be used as a fallback during the build." Ez NEM verzió-ütközés, csak a hiányzó Sentry org/project — Roli tölti ki (a fiókja). Az app boot ettől tiszta volt. Nem erőltettem semmit.

## 5. PAYOUT GUARD — néma pénzügyi landmine
**Cél:** ha az operátor nincs Stripe-onboardolva, a payment intent csendben transfer nélküli lett → a pénz a platform számlájára ment, az operátor sosem kapta meg.

- **Kliens** (`app/(consumer)/booking/[listingId].tsx`): új `operatorCanReceivePayments` flag (mock módban mindig true; live módban `operator.stripe_onboarded === true && operator.stripe_account_id` kell). Ha false → teljes képernyős early-return blokk („Ez a hirdetés jelenleg nem foglalható", EN/HU/ES) a meglévő identity-guard mintáját követve. A fizetési flow el sem indul.
- **Edge Function** (`supabase/functions/create-payment-intent/index.ts`, defense-in-depth): ha nincs érvényes `operator_stripe_account_id` (hiányzik, nem string, vagy nem `acct_`-tal kezdődik) → **400** „Operator is not set up to receive payments". A `transfer_data` + `application_fee_amount` mostantól mindig kötelező — soha nem jön létre transferless intent csendben.

**Fájlok:** `app/(consumer)/booking/[listingId].tsx`, `supabase/functions/create-payment-intent/index.ts`

## 6. .env tisztítás + Stripe kulcs dev guard
**Cél:** a `.env` egy nem létező `mk_…` formátumú kulcsot tartalmazott → `confirmPayment()` csendben hibázott.

- `.env`: a bogus `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` értéke törölve (üres). **Valódi kulcsot NEM írtam be.**
- `lib/stripe.ts`: dev-only startup guard — ha a publishable key nem `pk_`-val kezdődik, `console.warn` („Invalid or missing... payments will fail"). Csak `__DEV__`, production crash NINCS. A kód már eddig is `process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`-ből olvasott.
- `.env.example`: Stripe komment pontosítva (érvényes `pk_test_`/`pk_live_` formátum), érték nélkül.

**Fájlok:** `.env`, `lib/stripe.ts`, `.env.example`

---

## Verifikáció
- `npx tsc --noEmit` → **0 hiba** ✓
- `npx expo start` (CI mód) → Metro tisztán elindult; üres Stripe kulcs + nincs Sentry DSN mellett sem crash (a guardok miatt) ✓

---

## NE CSINÁLD — ROLI MANUÁLIS LÉPÉSEI (auth / titok / döntés)
Ezeket szándékosan NEM hajtottam végre:

1. `eas init` → valódi `projectId` az `app.json`-ba (`extra.eas.projectId` + `updates.url`) — EAS login kell
2. Valódi `pk_test_…` Stripe publishable key + matching `STRIPE_SECRET_KEY` (mindkettő TEST mód TestFlighthez) → EAS Secrets
3. Sentry fiók + projekt → `EXPO_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` → EAS Secrets; a config plugin org/project kitöltése
4. Apple ASC app ID, Team ID, Apple ID + Google Play service account JSON → `eas.json` submit blokk
5. App Store screenshots + demo account (review-hoz)
6. Stripe Connect live aktiválás — külön kapu, csak valódi pénzbevételnél (nem most)
7. `eas update:configure` + tényleges `eas update` futtatás channel-aktiváláshoz — EAS login kell
8. (Opcionális, NEM blokkoló) git history `.env` tisztítás — a benne lévő érték csak `EXPO_PUBLIC_` (eleve publikus, binary-be kerül); history-rewrite tiltott volt
