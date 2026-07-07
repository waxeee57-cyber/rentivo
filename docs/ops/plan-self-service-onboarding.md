# ① Implementation plan — repair the supply self-service funnel (PLAN ONLY, no code)

Prepared 2026-06-24. Diff sketches at `[REPO] file:line`. **Rule held throughout:** owner identity
(`operator_id`/`host_id`/`owner_user_id`) is sourced from the signed-in user (`auth.uid()`), **never**
from a client payload. Nothing here is applied/committed/deployed.

Apply order: **#3 (RLS draft) first** (apply + verify standalone), then the client commits (#1, #2, #3-client, #4),
because the client listing-create depends on the new RLS/trigger.

---

## 1. Operator (and host) signup creates/loads the row instead of an empty dashboard
`[REPO] app/auth/verify.tsx:22` and `:68-71`

BEFORE:
```
const { role, setSession, setUser, language } = useAuthStore()
...
if (role === 'operator') {
  router.replace('/(operator)/dashboard')
} else if (role === 'host') {
  router.replace('/(host)/dashboard')
}
```
AFTER (sketch):
```
const { role, setSession, setUser, setOperator, setHost, language } = useAuthStore()
...
const uid = data.session!.user.id
if (role === 'operator') {
  const { data: op } = await supabase.from('rentivo_operators').select('*').eq('auth_id', uid).maybeSingle()
  if (op) { setOperator(op as Operator); router.replace('/(operator)/dashboard') }
  else { router.replace('/auth/operator-setup') }      // existing form creates the row
} else if (role === 'host') {
  const { data: h } = await supabase.from('rentivo_hosts').select('*').eq('auth_id', uid).maybeSingle()
  if (h) { setHost(h as Host); router.replace('/(host)/dashboard') }
  else { router.replace('/auth/host-setup') }           // existing screen [REPO] app/auth/host-setup.tsx
}
```
Security: lookup is keyed on `auth_id = auth.uid()` (session user); no client-supplied id; routing/load only.

## 2. Session sync hydrates operator/host on every boot/device
`[REPO] app/_layout.tsx:136-152` (and add `setOperator`/`setHost` to the store usage in this component)

BEFORE (tail of `syncProfileFromSession`):
```
const { data: profile } = await supabase.from('rentivo_users').select('*').eq('id', uid).maybeSingle()
if (profile) { setUser(profile as RentivoUser) }
```
AFTER (sketch — append):
```
if (profile) setUser(profile as RentivoUser)
const { data: op } = await supabase.from('rentivo_operators').select('*').eq('auth_id', uid).maybeSingle()
setOperator(op ? (op as Operator) : null)
const { data: h } = await supabase.from('rentivo_hosts').select('*').eq('auth_id', uid).maybeSingle()
setHost(h ? (h as Host) : null)
```
Security: read-only hydration keyed on `auth.uid()`; `setOperator`/`setHost` already exist `[REPO] useAuthStore.ts:46-47`; no privilege change. (RLS on operators/hosts already restricts the read to the caller's own row.)

## 3. Listing self-create works, securely
DB part → **`docs/ops/listings-self-create-rls.draft.sql`** (trigger stamps `owner_user_id := auth.uid()`;
strict INSERT `WITH CHECK` requires the `operator_id`/`host_id` to belong to `auth.uid()`).
Cross-tenant analysis: a client sending a foreign `operator_id`/`host_id` fails the `EXISTS(... auth_id = auth.uid())`
check; a client sending its own `owner_user_id` is overwritten by the trigger → **no cross-tenant INSERT**.

Client part:
- `[REPO] lib/api/listings.ts:63` — drop `owner_user_id` from the client payload type and allow `operator_id` nullable:
  BEFORE `createListing(listing: Omit<Listing,'id'|'created_at'|'rating'|'review_count'|'booking_count'>)`
  AFTER  `... Omit<Listing,'id'|'created_at'|'rating'|'review_count'|'booking_count'|'owner_user_id'>` (and `operator_id: string | null`). Client never sends `owner_user_id`.
- `[REPO] app/(host)/listings/new.tsx:118` — BEFORE `operator_id: ''` → AFTER `operator_id: null` (the `''` is an invalid UUID and would fail the insert regardless of RLS).
- `[REPO] app/(operator)/fleet/new.tsx:86-113` — payload already omits `owner_user_id` (correct). No change required; optionally add `owner_type: 'operator'` for clarity (not needed by the policy).
Security: `owner_user_id` removed from client surface (server/trigger-stamped); ownership enforced in RLS against `auth.uid()`.

## 4. Host wizard lookup column fix
`[REPO] app/(host)/listings/new.tsx:108`

BEFORE: `.from('rentivo_hosts').select('id').eq('user_id', session.user.id)`
AFTER:  `.from('rentivo_hosts').select('id').eq('auth_id', session.user.id)`
Security: corrects a broken lookup to the real linkage column (`auth_id` = `auth.uid()`); no surface change.

## 5. Express account country — FLAG ONLY (do not change in ①)
`[REPO] supabase/functions/create-stripe-account-link/index.ts:56` hardcodes `country: 'HU'` while the
operator row stores `country` `[REPO] app/auth/operator-setup.tsx:36`. Stripe account country is **immutable
after creation**, so this only mis-tags FUTURE accounts (an ES operator gets an HU Connect account).
Recommendation: derive `country` from the operator row in the edge fn, but **bundle it with the separate
`create-stripe-account-link` drift-redeploy** (it is an edge-fn change + redeploy, outside ①'s client scope).
Not changed here — low risk for new accounts, no risk to the existing one.

---

## Effort (Claude Code bands: S ≈ ½–1.5d)
- #1 verify routing + #2 session hydration: **S** (auth/boot wiring, ~½ day incl. manual test).
- #3 client (listings API type + host/operator payload) + #4 host lookup: **S** (~½ day).
- #3 DB (apply RLS draft + verify with a real JWT, like the payments dry-run): **S** (~½ day).
- **Total ①: S–M (~1.5–2 days)** including a live self-create verification.

## Suggested commit split (keep the ~73 dirty files + foreign WIP out — explicit `git add`, NOT `-A`, no push)
1. **`fix(auth): provision/load operator+host row on signup and session sync`** — `app/auth/verify.tsx`, `app/_layout.tsx`.
2. **`fix(listings): secure self-create — server-stamped owner, host payload/lookup`** — `lib/api/listings.ts`, `app/(host)/listings/new.tsx`, (optional) `app/(operator)/fleet/new.tsx`.
3. **DB (not a code commit now):** apply `docs/ops/listings-self-create-rls.draft.sql` standalone (SQL editor / MCP), verify, then either keep as an ops artifact or promote to a real migration **after** the gated `20260624003` is resolved. Sequence: apply DB **before** shipping commit 2.
4. **Country (#5):** separate commit with the `create-stripe-account-link` drift redeploy — not part of ①.

Each commit: `git add <explicit files>` then commit; **no push** until reviewed. This keeps auth-wiring, listing-create, and the DB/RLS change independently reviewable and revertible, and never co-mingles the unrelated dirty working-tree files.
