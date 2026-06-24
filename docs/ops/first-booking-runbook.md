# First-booking runbook (PREPARED — nothing applied)

Prepared 2026-06-24 from a read-only audit. **Nothing here has been run.** Source tags:
`[REPO]` = repo file:line, `[DEPLOY]` = live Supabase MCP, "nem mért" = not measurable here.

Project ref: `xeyfsacbozucxrwlefro`. Onboarded operator: **Test Operator** `f7c4a6b1-d748-4e04-9afd-126f140201e3`
(`acct_1TlrcY1i6DLADATb`, `stripe_onboarded=true`). BMW 5 Series `141754da-7824-4f49-ba05-cbb94117462d`
is linked to it (`price_per_day=150` `[DEPLOY]`).

---

## 2) DRIFT redeploy — `create-stripe-account-link` → repo version

Why: `[DEPLOY]` v6 uses `SUPABASE_SERVICE_ROLE_KEY` only; `[REPO] supabase/functions/create-stripe-account-link/index.ts:23`
uses the fallback `SB_SECRET_KEY ?? SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY`. Logic identical; benign drift.
Current config `[DEPLOY]`: `verify_jwt=false` (the function self-authenticates via `auth.getUser`).

**Option A — Supabase CLI (one command):**
```
npx supabase functions deploy create-stripe-account-link \
  --project-ref xeyfsacbozucxrwlefro --no-verify-jwt
```
- `--no-verify-jwt` PRESERVES the current `verify_jwt=false`. Omitting it makes the CLI default to `verify_jwt=true`
  (a config change). `true` would still work for the logged-in operator (invoke sends the JWT), but to match
  today's config use `--no-verify-jwt`.
- Needs: `supabase login` done; deploys from `supabase/functions/create-stripe-account-link/`.

**Option B — MCP (same path used for create-booking v2 / create-payment-intent v9):**
`deploy_edge_function(project_id=xeyfsacbozucxrwlefro, name="create-stripe-account-link",
entrypoint_path="index.ts", verify_jwt=false, files=[{name:"index.ts", content:<repo file>}])`.

**Verify [DEPLOY]==[REPO] after deploy:**
1. `supabase functions list` (or MCP `list_edge_functions`) → version bumped **v6 → v7**, status ACTIVE.
2. MCP `get_edge_function create-stripe-account-link` → write the returned `content` to a temp file →
   `diff` against `supabase/functions/create-stripe-account-link/index.ts` → **must be empty** (byte-identical).
3. Spot-check: deployed source line ~23 now contains `SB_SECRET_KEY ?? SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY`.
- No new secret needed: `SUPABASE_SERVICE_ROLE_KEY` remains the final fallback (works today).

---

## 3) MODE-CHECK checklist — test vs live (≈2 min)

The deciding values are NOT readable here: `[REPO] .env` `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is **empty (len=0)**,
and the edge secret `STRIPE_SECRET_KEY` value is masked (nem mért). Use the account's own mode as the source of truth:

1. **Stripe dashboard → top-right TEST/LIVE toggle → TEST → Connect → Accounts → search `acct_1TlrcY1i6DLADATb`.**
   - Found in TEST → it's a **test** account (you're in test mode). Not found → toggle LIVE and search.
   - The single mode where the account exists = the account's mode. (Definitive; no secret reading.)
2. In that SAME mode → **Developers → API keys** → note the **Secret key** prefix (`sk_test_`/`sk_live_`) and
   **Publishable key** (`pk_test_`/`pk_live_`). These are the keys that must back the deployment.
3. **Supabase → Project → Edge Functions → Secrets** (or `supabase secrets list --project-ref xeyfsacbozucxrwlefro`):
   confirm `STRIPE_SECRET_KEY` is SET. Value is masked — you can't read the prefix here; ensure it was set from
   step 2's secret key (matching the account mode).
4. **EAS → `eas env:list`** (or EAS dashboard → Environment variables): confirm `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   equals step 2's publishable key (same mode). It's empty in local `.env`, so the build value lives only in EAS.
5. **Decision:** account is TEST → do the dry-run (§4) with a test card. Account is LIVE → a real card would truly
   charge; use a small real booking or a separate fully-test operator instead.

---

## 4) First-booking DRY-RUN — BMW, test mode (delegable; run ONLY tomorrow)

Pre-req: §3 says TEST; `pk_test_` in the build; `sk_test_` edge secret. This creates real TEST-mode objects
(a booking row + a Stripe test PaymentIntent) — clean them up after.

Env: `URL=https://xeyfsacbozucxrwlefro.supabase.co`, `ANON=<EXPO_PUBLIC_SUPABASE_ANON_KEY from .env>`.

**A. Traveler JWT.** Sign in a test traveler (email confirmation is ON `[DEPLOY]`, so a fresh signup needs
`email_confirmed_at` set via SQL editor before sign-in, or reuse a confirmed test user):
```
curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"<test traveler>","password":"<pw>"}'        # → take .access_token = $JWT
```

**B. create-booking** (server derives all money; client sends no amount — `[REPO] lib/api/bookings.ts:66-113`):
```
curl -s -X POST "$URL/functions/v1/create-booking" \
  -H "Authorization: Bearer $JWT" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"listing_id":"141754da-7824-4f49-ba05-cbb94117462d",
       "start_date":"2026-07-01","end_date":"2026-07-03","insurance_id":"basic"}'
```
Expect 200 + `{ booking_id, total_amount: 330, subtotal: 300, platform_fee: 30, deposit_amount, ... }`
(BMW 150/day × 2 days = 300 + 30 fee + 0 basic insurance = 330). If 409 "Selected dates are not available",
pick free dates (create-booking checks `rentivo_availability`).

**C. create-payment-intent — THE PROOF** (`[REPO] lib/api/payments.ts:35-67` sends only booking_id):
```
curl -s -X POST "$URL/functions/v1/create-payment-intent" \
  -H "Authorization: Bearer $JWT" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"booking_id":"<from B>"}'
```
- **PASS** = HTTP 200 + `{ "client_secret": "pi_..._secret_...", "payment_intent_id": "pi_..." }`
  → owner onboarded + server-reconstructed amount accepted (the dry-run success criterion).
- 400 "Owner is not set up to receive payments" → operator not actually onboarded/charges_enabled (re-check §3).
- 400 "...does not match the server-derived rental price" → booking total tampered (shouldn't happen via create-booking).

**D. (optional) complete the booking with a TEST card** to see the webhook flip status:
- RN client (pk_test_): `confirmPayment(client_secret, { paymentMethodType: 'Card' })` with `4242 4242 4242 4242`.
- or server test-confirm (sk_test_):
  `POST https://api.stripe.com/v1/payment_intents/{id}/confirm` with `payment_method=pm_card_visa`
  → `stripe-webhook` (`[REPO] supabase/functions/stripe-webhook`) flips booking to paid/confirmed.

**Cleanup** (SQL editor, like today's verify): delete the test booking row(s) and the throwaway traveler
(`auth.users` + `rentivo_users`).
