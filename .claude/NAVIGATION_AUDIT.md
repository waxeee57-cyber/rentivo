# Rentivo Mobile — Navigation Audit
Date: 2026-05-15

---

## 1. Layout Files Summary

### `app/_layout.tsx` — Root Layout
- Navigator: **Stack** (`expo-router` Stack)
- `headerShown: false` (global `screenOptions`)
- GestureHandlerRootView: **YES** — wraps the entire tree (line 180)
- SafeAreaProvider: **YES**
- StripeProvider: **YES**
- Notable: GDPR modal overlay, push notification registration, Supabase auth listener, offline banner

### `app/(consumer)/_layout.tsx` — Consumer Tab Bar
- Navigator: **Tabs**
- `headerShown: false`, `tabBarActiveTintColor: '#E8A44A'` (Mediterranean gold)
- Tab screens (5 visible): `explore`, `search`, `wishlist`, `bookings`, `profile`
- Hidden screens (href: null, 13 total): `listing/[id]`, `booking/[listingId]`, `booking/confirmation/[id]`, `bookings/[id]`, `bookings/chat/[bookingId]`, `bookings/review/[bookingId]`, `profile/verify`, `legal/privacy`, `legal/terms`, `legal/cookies`, `damage/pickup/[bookingId]`, `damage/return/[bookingId]`, `profile/connected-platforms`
- Tab active state: Custom `TabIcon` component with a filled gold dot indicator below active icon + `tabBarActiveTintColor: '#E8A44A'`
- Haptic feedback on every tab press via `listeners`

### `app/(operator)/_layout.tsx` — Operator Tab Bar
- Navigator: **Tabs**
- `headerShown: false`, `tabBarActiveTintColor: '#E8A44A'`
- Tab screens (5 visible): `dashboard`, `bookings`, `fleet`, `messages`, `profile`
- Hidden screens (href: null, 7 total): `bookings/[id]`, `bookings/chat/[bookingId]`, `bookings/calendar`, `fleet/new`, `fleet/[id]`, `damage/[bookingId]`, `profile/team`
- Tab active state: Same custom `TabIcon` with dot indicator + gold tint
- Badge on `bookings` (pending count), badge on `messages` (unread count)

### `app/(host)/_layout.tsx` — Host Tab Bar
- Navigator: **Tabs**
- `headerShown: false`, `tabBarActiveTintColor: '#E8A44A'`
- Tab screens (4 visible): `listings`, `bookings`, `messages`, `profile`
- Hidden screens (href: null, 3 total): `dashboard`, `listings/new`, `bookings/[id]`
- Note: `dashboard` is hidden (href: null) — host role has no visible dashboard tab, unlike operator

### `app/auth/_layout.tsx` — Auth Stack
- Navigator: **Stack**
- `headerShown: false`
- Screens: `index` (login/signup), `login`, `verify`, `consent`, `host-setup`, `operator-setup`, `operator-stripe`
- No screen-specific options defined; all inherit headerShown: false

### `app/onboarding/` — Onboarding (not a layout, single-file)
- No dedicated `_layout.tsx`; entry point is `app/onboarding/index.tsx`
- Implemented as a **FlatList carousel** (3 slides, not separate routes)
- Slides: 1) "Rent anything in the Mediterranean", 2) "Digital contracts & damage protection", 3) "Live in 48 hours if you're an operator"
- Navigation: `handleNext` advances slides; on last slide navigates to `/(consumer)/explore` (mock) or `/auth` (prod)
- `handleSkip` jumps directly to auth/explore
- AsyncStorage key: `onboarding_seen` (written in onboarding/index.tsx) — **NOTE**: `app/index.tsx` checks for `onboarding_complete` key; these are different keys. The onboarding/index.tsx writes `onboarding_seen` but index.tsx reads `onboarding_complete`. This is a minor inconsistency (see findings below).

---

## 2. Back Navigation

### `router.back()` Usage
18 files across the codebase call `router.back()` directly:

**Consumer (9 files):**
- `listing/[id].tsx` — detail screen, back to explore/search
- `booking/[listingId].tsx` — booking form, back to listing
- `bookings/[id].tsx` — booking detail, back to bookings list
- `damage/pickup/[bookingId].tsx` — damage report pickup
- `damage/return/[bookingId].tsx` — damage report return
- `profile/verify.tsx` — ID verification
- `profile/privacy-settings.tsx` — privacy settings
- `profile/delete-account.tsx` — delete account
- `legal/cookies.tsx` — cookie policy

**Operator (4 files):**
- `fleet/new.tsx` — add new vehicle
- `fleet/[id].tsx` — vehicle detail/edit
- `bookings/[id].tsx` — booking detail
- `damage/[bookingId].tsx` — damage report

**Host (3 files):**
- `listings/new.tsx` — add new listing
- `listings/add-external.tsx` — add external listing
- `bookings/[id].tsx` — booking detail

**Auth (2 files):**
- `auth/verify.tsx` — verification screen
- `auth/login.tsx` — login screen

### `ScreenHeader` Component (Default Back Behavior)
The `ScreenHeader` component (`components/ui/ScreenHeader.tsx`) has `showBack = true` by default and falls back to `router.back()` when no `onBack` prop is provided. This means screens that use `<ScreenHeader title="..." />` without explicit `onBack` rely on the implicit `router.back()`.

**Screens using ScreenHeader without explicit `onBack` (rely on router.back() implicitly):**
- `(consumer)/legal/privacy.tsx` — `<ScreenHeader title="Privacy Policy" />`
- `(consumer)/legal/terms.tsx` — `<ScreenHeader title="Terms of Service" />`
- `(consumer)/bookings/chat/[bookingId].tsx` — `<ScreenHeader title={...} />`
- `(consumer)/bookings/review/[bookingId].tsx` — `<ScreenHeader title="Leave a Review" />`
- `(operator)/bookings/calendar.tsx` — `<ScreenHeader title="Fleet Calendar" />`
- `(operator)/bookings/chat/[bookingId].tsx` — `<ScreenHeader title={...} />`
- `(operator)/profile/team.tsx` — `<ScreenHeader title="Team" />`
- `(consumer)/profile/connected-platforms.tsx` — `<ScreenHeader title="Connected Platforms" />`

These are all correctly non-tab screens (hidden via `href: null`), so `router.back()` is appropriate and will work as long as navigation was pushed from the correct parent.

### Screens Correctly Without Back Button (tab roots)
Tab-root screens do NOT use `ScreenHeader` at all (no back button present, correct):
- `(consumer)/explore/index.tsx`
- `(consumer)/search/index.tsx`
- `(consumer)/wishlist/index.tsx`
- `(consumer)/bookings/index.tsx`
- `(consumer)/profile/index.tsx`
- `(operator)/dashboard/index.tsx`
- `(operator)/bookings/index.tsx`
- `(operator)/fleet/index.tsx`
- `(operator)/messages/index.tsx`
- `(operator)/profile/index.tsx`
- `(host)/listings/index.tsx`
- `(host)/bookings/index.tsx`
- `(host)/messages/index.tsx`
- `(host)/profile/index.tsx`

### `booking/confirmation/[id].tsx` — Special Case
Uses `<ScreenHeader title={...} onBack={() => router.replace('/(consumer)/bookings')} />` — correctly uses `router.replace` instead of `router.back()` to avoid going back to the completed booking flow. This is correct behavior.

---

## 3. Deep Link Support

- **Scheme defined**: `"scheme": "rentivo"` in `app.json` line 11 — `rentivo://` deep links are configured
- **expo-linking installed**: `"expo-linking": "~8.0.12"` in `package.json`
- **expo-router origin**: `"origin": "https://rentivo.domrol.com"` configured in plugins
- **No custom `expo-linking` configuration found** in app code — deep links are handled automatically by expo-router's file-based routing
- **Status**: Basic deep link support is in place. No custom link handler or `Linking.addEventListener` needed with expo-router. Universal links (AASA/assetlinks) are not configured in `app.json` — native universal links will not work without associated domains setup.

---

## 4. Tab Active State

All three Tabs layouts (consumer, operator, host) use:
- `tabBarActiveTintColor: '#E8A44A'` (Mediterranean gold) — active label color
- `tabBarInactiveTintColor: '#6B7A99'` — inactive color
- Custom `TabIcon` component: renders a gold filled dot below the active icon
- Active icons use the filled Ionicons variant (e.g., `'map'` vs `'map-outline'`)

**Active state is visually distinct**: YES — filled icon + gold dot + gold label vs outline icon + muted label.

---

## 5. Modal Screens

- **No `presentation: 'modal'` found** in any `_layout.tsx` or screen definition
- All drill-down screens are standard Stack push (via Tabs' hidden href: null screens)
- The GDPR consent is a React Native `<Modal>` component (not an expo-router modal screen)
- No expo-router modal screens exist; no dismissal risk

---

## 6. `headerShown` Audit

All layouts explicitly set `headerShown: false`:
- `app/_layout.tsx`: `screenOptions={{ headerShown: false }}`
- `app/(consumer)/_layout.tsx`: `headerShown: false` in screenOptions
- `app/(operator)/_layout.tsx`: `headerShown: false` in screenOptions
- `app/(host)/_layout.tsx`: `headerShown: false` in screenOptions
- `app/auth/_layout.tsx`: `screenOptions={{ headerShown: false }}`

**No default system headers are showing.** All headers are custom via `ScreenHeader` component.

---

## 7. Gesture Navigation

- `GestureHandlerRootView` is present at the root in `app/_layout.tsx` (line 180)
- Wraps: `SafeAreaProvider > StripeProvider > Stack`
- Gesture-based back navigation (swipe right on iOS, Android back gesture) is correctly enabled
- Status: **CORRECTLY CONFIGURED**

---

## 8. Onboarding Flow

Directory: `app/onboarding/`
Files: `index.tsx` only (no sub-screens, no `_layout.tsx`)

The onboarding is a **3-slide carousel** within a single screen (FlatList horizontal paging):
1. Slide 1: "Rent anything in the Mediterranean" — with trust badges (Insured, Instant, Verified)
2. Slide 2: "Digital contracts & damage protection"
3. Slide 3: "Live in 48 hours if you're an operator"

Flow:
- `Next →` button advances slides; on slide 3 writes `onboarding_seen` and navigates away
- `Sign in` skip button exits early, also writes `onboarding_seen`

**Note**: `app/index.tsx` also contains an `OnboardingFlow` component imported from `@/components/onboarding/OnboardingFlow` and checks `onboarding_complete` key. The `app/onboarding/index.tsx` writes `onboarding_seen`. These are separate flows with separate AsyncStorage keys — the route `app/onboarding/` appears to be a legacy or parallel flow.

---

## 9. Findings & Issues

### FINDING 1 — INFORMATIONAL: Dual Onboarding Implementations
- `app/onboarding/index.tsx` writes key `onboarding_seen`
- `app/index.tsx` imports `OnboardingFlow` component and checks `onboarding_complete`
- Two separate onboarding flows exist with different AsyncStorage keys
- The `app/onboarding/` route is not referenced in any layout (no Tabs.Screen or Stack.Screen entry for it) — it may be unreachable via navigation
- Recommendation: Audit which onboarding is actually shown; the route-based one at `app/onboarding/index.tsx` may be dead code

### FINDING 2 — INFORMATIONAL: Host `dashboard` Hidden Tab
- `(host)/_layout.tsx` registers `dashboard` with `href: null` but a `dashboard/index.tsx` file exists
- Host users cannot reach `/host/dashboard` from the tab bar
- This appears intentional (host dashboard may be future work), but the file exists — verify it's not accidentally navigated to

### FINDING 3 — INFORMATIONAL: No Universal Links Configured
- `app.json` has `scheme: "rentivo"` for custom URL scheme but no `associatedDomains` (iOS) or `intentFilters` (Android) for universal/app links
- `rentivo://` deep links work; `https://rentivo.domrol.com/...` will not open the app
- Mark as future gate: Universal Links / App Links setup

### FINDING 4 — INFORMATIONAL: `expo-linking` Installed But Not Used Explicitly
- `expo-linking` is installed but no explicit `Linking.createURL` or `addEventListener` usage found in app code
- This is acceptable — expo-router handles linking internally
- No action required

### FINDING 5 — OK: No Broken Back Buttons Found
- All screens that need back navigation have it (either direct `router.back()` or via `ScreenHeader` default)
- All tab-root screens correctly have no back button
- `booking/confirmation/[id].tsx` correctly uses `router.replace` instead of `router.back()` to prevent returning to a completed booking flow

### FINDING 6 — OK: GestureHandlerRootView Correctly Placed
- At the root of the app, wrapping everything — gesture navigation is enabled globally

### FINDING 7 — OK: All Tab Active States Visually Distinct
- Custom dot indicator + filled icon + gold color on active tab
- Inactive tabs use outline icons + muted color
- Consistent across consumer, operator, and host layouts

---

## Summary Table

| Check | Status | Notes |
|---|---|---|
| GestureHandlerRootView at root | PASS | Wraps entire tree |
| All layouts headerShown: false | PASS | No system headers showing |
| Tab active state distinct | PASS | Gold dot + filled icon + gold label |
| Deep link scheme defined | PASS | rentivo:// configured |
| expo-linking installed | PASS | ~8.0.12 |
| Universal links configured | MISSING | Future gate — not blocking |
| Modal screens dismissible | N/A | No expo-router modals used |
| presentation: modal screens | NONE | Not used anywhere |
| Tab root screens have no back | PASS | 14 tab-root screens confirmed |
| Drill-down screens have back | PASS | ScreenHeader defaults + explicit calls |
| booking/confirmation back | PASS | Uses router.replace correctly |
| Dual onboarding flows | INFORMATIONAL | Two separate flows, different AsyncStorage keys |
| Host dashboard hidden | INFORMATIONAL | File exists but tab hidden — appears intentional |
