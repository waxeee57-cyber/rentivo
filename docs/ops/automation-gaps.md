# Rentivo automation gaps (audit 2026-06-24)

Read-only audit of supply-side + operate-layer automation. Tags: `[REPO] file:line`, `[DEPLOY]` (live Supabase MCP). "nem mért" = not measurable from the repo. State at audit: 1 onboarded operator, 1 bookable listing (BMW), 0 transactions; **no scheduler exists** (`pg_cron`/`pg_net`/`http` NOT installed `[DEPLOY]`).

## Gap area 1 — Operator/host onboarding: machinery present, funnel mis-wired
- Self-service machinery works with **no manual DB touch**: client inserts operator row `[REPO] app/auth/operator-setup.tsx:30-46`; BEFORE INSERT guard auto-approves (`approved=true`) `[REPO] 20260624001_operators_hosts_privileged_column_guard.sql:58-73`; `create-stripe-account-link` auto-creates the Express account + link `[REPO] create-stripe-account-link/index.ts:37-77` `[DEPLOY] v6`; `stripe_onboarded` flips via webhook `account.updated` `[REPO] stripe-webhook/index.ts:92-103`.
- **Defect (wiring):** the dedicated operator signup routes straight to the dashboard `[REPO] app/auth/verify.tsx:68-69` and never creates the operator row; `operator-setup` is only reachable from consumer→profile→"Become an Operator" `[REPO] app/(consumer)/profile/index.tsx:357`. A pure-operator signup → no row → `create-stripe-account-link` 404 `[REPO] create-stripe-account-link/index.ts:43-48`.
- **Defect:** `syncProfileFromSession` loads only `rentivo_users` `[REPO] app/_layout.tsx:136-152` → operator/host on a new device sees an empty dashboard + permanent payout banner.
- **Minor:** Express account country hardcoded `HU` `[REPO] create-stripe-account-link/index.ts:56` (immutable after creation).

## Gap area 2 — Listing creation likely RLS-blocked; zero import
- Self-create wizards exist (`[REPO] app/(operator)/fleet/new.tsx:69-121`, `app/(host)/listings/new.tsx:90-157`) → `createListing()` real INSERT `[REPO] lib/api/listings.ts:63-72`.
- **Blocker:** only listings INSERT policy is `"Owners manage own listings" FOR ALL USING (auth.uid()=owner_user_id)` `[REPO] 03_listings.sql:56-57` (no operator_id/host_id policy anywhere). `createListing` leaves `owner_user_id` NULL → self-create rejected. *(runtime nem mért; consistent with seed-only data.)*
- **Bug:** host wizard sends `operator_id: ''` (invalid UUID) and queries `rentivo_hosts` by `user_id` (column is `auth_id`) `[REPO] app/(host)/listings/new.tsx:108,118`.
- **No import:** RentalOS→Rentivo is a "Soon" badge `[REPO] app/(operator)/fleet/index.tsx:228-236`; `import_sessions`/`connected_platforms`/`channel_manager_id` unused scaffolding; `ical-import` imports availability not listings `[DEPLOY] ical-import v8`; host add-external is a mock that writes nothing `[REPO] app/(host)/listings/add-external.tsx:76-83`.

## Gap area 3 — Booking lifecycle: one automatic path; rest unwired/manual
- Automatic: create-booking (pending) → card charge → `stripe-webhook` flips `confirmed/paid` `[REPO] stripe-webhook/index.ts:30-54` → Stripe payout via `transfer_data` `[REPO] create-payment-intent/index.ts:215-230` → deposit card vault (SetupIntent + webhook) → loyalty on (manual) completion `[REPO] 045_loyalty_trigger.sql`.
- **Built but not wired:** confirmation email (templates `[REPO] send-email/index.ts:79-107`, no caller; `lib/email.ts:11` also missing `X-Internal-Secret` → 401); confirmation/cancellation push (helpers exist, no callers); `charge-deposit` deployed but no UI caller `[DEPLOY] charge-deposit v1` (manual today); review-request, pickup/return reminders (no callers).
- **Missing:** refund on cancel (no `stripe.refunds.create` anywhere; `payment_status` stays `paid`); payment reminders; date-based auto active/completed transitions.
- **Flag:** two push-token stores (`rentivo_push_tokens` vs `rentivo_users.push_token`) `[REPO] lib/notifications.ts`.

## Gap area 4 — Scheduled/cron: nothing runs on a schedule
- **No scheduler anywhere:** no `.github/workflows/`, no `vercel.json`, no Trigger.dev, no `eas.json`/`app.json` background config, no `setInterval`; `pg_cron`/`pg_net`/`http` NOT installed `[DEPLOY]`. Only a commented-out cron `[REPO] 16_rate_limits.sql:24-27` + per-request opportunistic rate-limit cleanup in 4 LLM fns.
- **Consequence:** `drip-email` never runs `[DEPLOY] v4`; `ical-import` manual-only (no periodic resync → double-booking drift); `flight-tracker` has no caller and is still mock `[DEPLOY] v4`; no unpaid-booking expiry.

## Priority (from the audit)
NOW (impact-ranked): ① make supply self-service actually work (this doc's plan: see `plan-self-service-onboarding.md`); ② confirmation email+push from the payment webhook; ③ RentalOS→Rentivo push import.
LATER (under traffic): scheduler infra (then payment reminders, unpaid-booking expiry, auto-complete, review nudge, reminders, drip, periodic ical, flight polling); charge-deposit UI wiring; refund-on-cancel; channel manager.
