# REGGEL — Rentivo éjszakai kör (2026-06-24)

Prioritás-sorrendben. Minden élesített dolog **reverzibilis** és **verzióval igazolt**.

## 1. Mi élesedett éjszaka (mind [DEPLOY] mérve)
- **create-booking** edge fn (`v1`, verify_jwt=true) — szerver-autoritatív booking: a kliens
  TÖBBÉ nem küld pénzt; a szerver számolja subtotal/fee/insurance/promo/total/deposit-et a
  listingből. A kliens (`lib/api/bookings.ts` + booking képernyő) átállt, **tsc zöld**.
- **create-payment-intent** `v8` — floor-ellenőrzés (defense-in-depth marad a create-booking mögött).
- **stripe-webhook** `v10` (verify_jwt=false) — redelivery idempotencia (paid_at nem íródik újra) +
  `account.updated` visszaállítja `stripe_onboarded=false`-t letiltott accountnál.
- **ical-import** `v8`, **operator-webhook-dispatch** `v3` — SSRF + tenant-guard / fail-closed gate.
- **LLM fn-ek**: rental-assistant `v4`, translate-message `v4`, damage-detector `v6`,
  pricing-suggestions `v5` — input-méret cap + rate_limits opportunista cleanup.
- **DB migrációk élesben**: operator/host privilege-guard, str_compliance security_invoker,
  rentivo_reports insert-check (advisor 4→3).

## 2. A 3 visszatartott fn — DEPLOY PARANCS (secret-feltétellel)
Ezek **fail-closed** secretre várnak; csak akkor élesítsd, ha a secret JELEN van (Dashboard →
Project Settings → Edge Functions → Secrets):
- `INTERNAL_FUNCTION_SECRET` és `ADMIN_BROADCAST_SECRET` meglétét ellenőrizd.
```bash
# CLI nincs telepítve a gépen — telepítés után, vagy Dashboardból deploy. Ha CLI van:
supabase functions deploy broadcast-push drip-email --project-ref xeyfsacbozucxrwlefro
supabase functions deploy didit-webhook --no-verify-jwt --project-ref xeyfsacbozucxrwlefro
```
- ⚠️ A `drip-email` ütemezője ezután küldje az `X-Internal-Secret: <INTERNAL_FUNCTION_SECRET>` headert.

## 3. GATED migráció — booking INSERT pénzügyi oszlop revoke
- `supabase/migrations/20260624003_bookings_revoke_financial_insert.sql` **NINCS alkalmazva**.
- Alkalmazd CSAK miután a create-booking-ot használó mobil build KIMENT és a régi verziók
  kikoptak (a régi app közvetlenül insertál pénzügyi oszlopba → idő előtti apply megtörné).
- A create-payment-intent v8 floor addig is védi a terhelést.

## 4. Stripe dashboard — ellenőrizd a webhook event-feliratkozást
A kód ezeket kezeli; mind fel legyen iratkoztatva a Stripe webhook endpointon:
`payment_intent.succeeded`, `payment_intent.payment_failed`, `setup_intent.succeeded`, `account.updated`.
Plusz: test/live kulcs-mód konzisztencia (minden Stripe secret ugyanabban a módban).

## 5. Fizikai eszközös smoke-teszt (Definition of Done = első valós rentivo_bookings sor)
Az új create-booking úton:
1. Login traveler → listing → válassz dátumot → Foglalás.
2. Step 1: töltsd ki guest nevet+telefont, válassz biztosítást (pl. premium), opcionális promó.
3. Step 2: kártya (Stripe test kártya **csak Stripe TEST módban**) → Pay.
4. DoD: új `rentivo_bookings` sor jön létre **szerver-számolt** total_amount/deposit_amount-tal
   (a kliens NEM küldött összeget), `create-payment-intent` floor átmegy, webhook paid-re állítja.
5. Tamper-próba (opcionális, csak TEST): proxyval írd át a create-booking választ — a perzisztált
   összeg akkor is a szerver-derivált marad (a kliens válasz dekoratív).

## 6. Egy-soros pointerek
- Auth → **Leaked password protection** bekapcsolás (HaveIBeenPwned) — Dashboard toggle. [ADVISOR]
- `npm audit --omit=dev` — nem futott az auditban.
- Performance-advisor top-5: nem javítva (nem security/nem éjszakai scope) — futtasd
  `get_advisors(performance)` és nézd a top unindexed FK / missing index tételeket.
- `rentivo-avatars` public bucket listázható (advisor) + `domrol_waitlist` anon insert (szándékos) — alacsony.
