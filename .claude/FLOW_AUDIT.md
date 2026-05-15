# Rentivo Mobile App — Functional Flow Audit
**Date:** 2026-05-15  
**Auditor:** Claude Code (read-only audit)  
**Scope:** app/ directory — all major user flows traced end-to-end

---

## 1. AUTH FLOW

| Check | Status | Notes |
|-------|--------|-------|
| `login.tsx` exports `pendingOtpPhone` | ✅ | `export let pendingOtpPhone = ''` (line 12) — module-level mutable export |
| `verify.tsx` imports `pendingOtpPhone` from `login.tsx` | ✅ | `import { pendingOtpPhone } from '@/app/auth/login'` (line 11) |
| `verify.tsx` routes new users (no role) to `/auth/consent` | ✅ | Checks `rentivo_consent` first; routes to `/auth/consent` if no record, `/onboarding` if consent already exists |
| `consent.tsx` upserts to `rentivo_consent` | ✅ | Full upsert with all GDPR fields, then `router.replace('/onboarding')` |
| Role selection screen exists | ✅ | `app/auth/index.tsx` — `RoleSelectionScreen` with 3 role cards (consumer / host / operator) |

**Logic gap (minor):** `verify.tsx` routes users with existing consent directly to `/onboarding` — this skips the explore screen. For users who already accepted consent and have a role, they land on `/onboarding` again instead of their dashboard. This may be intentional (force onboarding), but could be a regression if users clear state.

---

## 2. CONSUMER BOOKING FLOW

| Check | Status | Notes |
|-------|--------|-------|
| `explore/index.tsx` navigates to listing detail | ✅ | `router.push('/(consumer)/listing/${listing.id}')` in `handleViewListing`; external listings use `openAffiliateLink` |
| `listing/[id].tsx` has a booking CTA | ✅ | Sticky "Book Now" bar; routes to `/(consumer)/booking/${listing.id}` when dates selected |
| Booking creation calls `supabase.from('rentivo_bookings').insert()` | ❌ | `app/(consumer)/booking/[listingId].tsx` uses a mock `setTimeout(1500ms)` and generates a fake `bookingRef`. It **never calls `createBooking()`** from `lib/api/bookings.ts`. The real Supabase insert is completely bypassed even when `Config.useMock = false`. |

**Critical:** The booking payment screen (`handlePayment`) does not call the real booking API in production mode. `createBooking` exists in `lib/api/bookings.ts` and does `supabase.from('rentivo_bookings').insert(...)`, but is never imported or called from the booking flow screen.

---

## 3. OPERATOR LISTING FLOW

| Check | Status | Notes |
|-------|--------|-------|
| Fleet index has a "New listing" button | ✅ | FAB (`+` button, line 230), EmptyState action, and setup wizard all route to `/(operator)/fleet/new` |
| Listing creation form exists with fields | ✅ | 4-step form: category, title, make, model, year, price/day, deposit, photos (6 slots), description, features |
| Form inserts into `rentivo_listings` | ✅ | Calls `createListing()` from `lib/api/listings.ts` which does `supabase.from('rentivo_listings').insert(listing)` |

---

## 4. CHAT FLOW

| Check | Status | Notes |
|-------|--------|-------|
| `rentivo_conversations` usage in app/ | ✅ | `app/(consumer)/bookings/chat/[bookingId].tsx` queries and inserts into `rentivo_conversations` |
| `rentivo_messages` usage in app/ | ✅ | Same file selects from and inserts into `rentivo_messages` |
| Real-time subscription exists | ✅ | `supabase.channel('messages:${conversation.id}').on('postgres_changes', ...)` on INSERT events with proper cleanup |
| New conversation created from booking chat | ✅ | If no conversation exists for the booking, one is auto-created on first message send |

**Note:** The "Ask a question" / "Message host" buttons in `listing/[id].tsx` hardcode the route to `/(consumer)/bookings/chat/bk-001` instead of using the actual `listing.id` or creating a pre-booking conversation. This only works in mock mode.

---

## 5. GDPR FLOW

| Check | Status | Notes |
|-------|--------|-------|
| `privacy-settings.tsx` loads from `rentivo_consent` | ✅ | Loads `marketing_email`, `marketing_push`, `analytics` via `.from('rentivo_consent').select(...)` |
| `privacy-settings.tsx` saves changes | ✅ | Each toggle calls `updateConsent()` which upserts to `rentivo_consent`; also nulls `push_token` on both `rentivo_users` and `rentivo_operators` when push is withdrawn |
| `delete-account.tsx` calls delete-account Edge Function | ✅ | Calls `${Config.supabaseUrl}/functions/v1/delete-account` via fetch with Bearer token; calls `signOut()` on success |
| `consent.tsx` upserts to `rentivo_consent` | ✅ | Full upsert with timestamps, versions (1.0), all consent fields, platform='mobile' |

---

## 6. DAMAGE REPORT FLOW

| Check | Status | Notes |
|-------|--------|-------|
| Damage report screen exists in (operator)/ | ⚠️ | `app/(operator)/damage/[bookingId].tsx` exists BUT is a **stub** — renders only an `EmptyState` with "Damage reports appear here after inspections are completed." No form, no data, no upload. |
| Consumer pickup damage screen uploads photos | ✅ | `app/(consumer)/damage/pickup/[bookingId].tsx` — full 3-step form; calls `uploadDamagePhoto()` which uploads to `rentivo-damage` Supabase Storage bucket |
| Consumer damage inserts into `rentivo_damage_reports` | ✅ | Calls `createDamageReport()` from `lib/api/damage.ts` which does `supabase.from('rentivo_damage_reports').insert(report)` |
| Operator damage screen inserts/uploads | ❌ | The operator-side `(operator)/damage/[bookingId].tsx` is a placeholder stub with no functionality |

---

## Summary

| Flow | Overall Status | Critical Issues |
|------|---------------|-----------------|
| Auth | ✅ Complete | Minor: users with existing consent skip dashboard routing |
| Consumer Booking | ⚠️ Partial | **CRITICAL: `createBooking()` never called in booking screen — no DB record created in production** |
| Operator Listing | ✅ Complete | None |
| Chat | ✅ Complete | Minor: pre-booking "Ask a question" hardcodes `bk-001` |
| GDPR | ✅ Complete | None |
| Damage Report | ⚠️ Partial | Operator damage screen is a stub (EmptyState only) |

---

## Recommended Fixes

### CRITICAL — Booking screen does not persist to DB
**File:** `app/(consumer)/booking/[listingId].tsx`  
`handlePayment()` must call `createBooking()` from `lib/api/bookings.ts` before routing to confirmation.  
Currently generates a random `bookingRef` with no DB record. In production, this means zero booking history, no operator notifications, no payout triggers.

### LOW — Chat "Ask a question" hardcodes mock booking ID
**File:** `app/(consumer)/listing/[id].tsx` (lines 408, 424)  
Both `router.push('/(consumer)/bookings/chat/bk-001')` calls should route to a pre-booking inquiry endpoint or pass the listing ID instead.

### LOW — Operator damage screen is a stub
**File:** `app/(operator)/damage/[bookingId].tsx`  
Needs the same form as the consumer pickup/return screens, or should display the submitted consumer report for operator review.
