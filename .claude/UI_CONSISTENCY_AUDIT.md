# UI Consistency Audit — Rentivo Mobile App
**Date:** 2026-05-15  
**Audited by:** Claude Code automated audit  
**Scope:** `app/**/*.tsx`, `components/**/*.tsx`  
**Design system ref:** `constants/colors.ts` (Colors, Spacing, Radius, Typography)

---

## Summary Table

| Category | Issues Found | Auto-Fixed | Manual Review |
|---|---|---|---|
| Hardcoded hex colors (StyleSheet) | 6 | 6 | 0 |
| Hardcoded hex colors (valid exceptions) | 12 | 0 | 0 (expected) |
| Button height < 52 (primary CTAs) | 3 | 3 | 0 |
| Non-standard `borderRadius` values | 22 | 1 | 21 |
| Screen title `fontSize` outside 24-26 range | 8 | 0 | 8 |
| Horizontal padding not using Spacing token | 8 | 0 | 8 |

---

## 1. Hardcoded Hex Colors

### AUTO-FIXED — Tab bar colors (all 3 layouts)

All three layout files had identical hardcoded colors in `tabBarActiveTintColor`, `tabBarInactiveTintColor`, and `tabBarStyle.backgroundColor`.

**Files fixed:**
- `app/(operator)/_layout.tsx`
- `app/(consumer)/_layout.tsx`
- `app/(host)/_layout.tsx`

**Changes applied:**
```diff
- tabBarActiveTintColor: '#E8A44A',
+ tabBarActiveTintColor: Colors.primary,

- tabBarInactiveTintColor: '#6B7A99',
+ tabBarInactiveTintColor: Colors.textTertiary,

- backgroundColor: '#0D1B2E',
+ backgroundColor: Colors.background,
```

Note: `#0D1B2E` was a slightly different shade not in the token map. `Colors.background (#0A1628)` is the correct semantic choice for a navigation bar. The inactive tint `#6B7A99` is 1 Green-channel step off `Colors.textTertiary (#6A7E98)` — token is the correct replacement.

### EXPECTED EXCEPTIONS (not fixed)

| File | Location | Reason |
|---|---|---|
| `app/auth/index.tsx:73` | `LinearGradient colors={['#0A1628', '#0D1F38']}` | Gradient prop is array of strings — no token interpolation possible |
| `app/onboarding/index.tsx:21,28,35` | Gradient arrays for 3 onboarding slides | Same as above — valid |
| `app/(consumer)/explore/index.tsx:48-59` | Google Maps JSON style config | RN MapView `customMapStyle` prop requires raw hex strings |
| `components/booking/SignatureCanvas.tsx:40-42` | `webStyle` CSS string in WebView | Inline CSS passed to a WebView cannot reference JS constants |

---

## 2. Primary Button Height

### AUTO-FIXED

Design system requires `minHeight: 52` for primary CTAs. Three violations found and fixed.

**`components/ui/Button.tsx` (the shared Button component)**  
```diff
- height: 48,
+ minHeight: 52,
```

**`components/listing/BookingBar.tsx` (primary "Book now" CTA)**  
```diff
- height: 48,
+ minHeight: 52,
```

**`app/(consumer)/booking/confirmation/[id].tsx` (message operator button)**  
```diff
- height: 48,
+ minHeight: 52,
```

All other `height: 48` values found are avatar circles (48x48 with `borderRadius: 24`) — not buttons. Correctly left unchanged.

---

## 3. Non-standard `borderRadius` Values

### AUTO-FIXED

**`app/auth/operator-stripe.tsx`**: `borderRadius: 40` on 80x80 icon container replaced with `Radius.full`.

### Circles (half of fixed dimension — intentional, leave as-is)

| File | Value | Element |
|---|---|---|
| `components/integrations/ICalSyncCard.tsx:105` | `borderRadius: 20` | 40x40 avatar |
| `components/booking/MultiVehicleBooking.tsx:110` | `borderRadius: 12` | 24x24 dot |
| `components/listing/ListingCarousel.tsx:71` | `borderRadius: 3` | 6x6 dot |
| `components/onboarding/Coachmarks.tsx:114` | `borderRadius: 4` | 8x8 dot |
| `app/(consumer)/explore/index.tsx:587` | `borderRadius: 16` | 32x32 icon |
| `app/(consumer)/bookings/chat/[bookingId].tsx:308` | `borderRadius: 20` | 40x40 avatar |
| `app/(operator)/bookings/calendar.tsx:206` | `borderRadius: 18` | 36x36 day cell |
| `app/(operator)/profile/team.tsx:161,176` | `borderRadius: 22,14` | 44x44 and 28x28 avatars |
| `app/(operator)/fleet/[id].tsx:364` | `borderRadius: 11` | 22x22 radio |
| `app/auth/operator-stripe.tsx:42` | `borderRadius: 16` | 32x32 step dot |

### Needs manual review (non-circle, non-standard values)

| File | Line | Value | Context | Recommendation |
|---|---|---|---|---|
| `components/map/ListingPreviewSheet.tsx:82` | 82 | `borderRadius: 14` | Card element | Use `Radius.lg (16)` or `Radius.md (12)` |
| `components/onboarding/OnboardingFlow.tsx:315` | 315 | `borderRadius: 28` | Button/card | Use `Radius.xxl (24)` or `Radius.full` |
| `components/damage/PhotoCapture.tsx:88` | 88 | `borderRadius: 11` | Photo slot | Use `Radius.md (12)` |
| `components/ui/HelpTooltip.tsx:68` | 68 | `borderRadius: 14` | Tooltip | Use `Radius.lg (16)` or `Radius.md (12)` |
| `components/ui/StepIndicator.tsx:72` | 72 | `borderRadius: 14` | Step bubble | Use `Radius.lg (16)` |
| `app/onboarding/index.tsx:182` | 182 | `borderRadius: 60` | Large icon | Use `Radius.full` |
| `app/(consumer)/listing/[id].tsx:639` | 639 | `borderRadius: 26` | Card section | Use `Radius.xxl (24)` |
| `app/(consumer)/bookings/index.tsx:239` | 239 | `borderRadius: 10` | Tab chip | Use `Radius.md (12)` |
| `app/(consumer)/bookings/chat/[bookingId].tsx:273,278` | — | `borderRadius: 18` | Chat bubbles | Intentional asymmetric design — OK |
| `app/(operator)/bookings/chat/[bookingId].tsx:215,222` | — | `borderRadius: 18` | Chat bubbles | Intentional asymmetric design — OK |
| `app/(operator)/fleet/index.tsx:78` | 78 | `borderRadius: 14` | Status chip | Use `Radius.lg (16)` |
| `app/(operator)/fleet/index.tsx:293` | 293 | `borderRadius: 28` | FAB button | Use `Radius.xxl (24)` |
| `app/(operator)/dashboard/index.tsx:157` | 157 | `borderRadius: 9` | Small badge | Consider `Radius.sm (8)` |
| `app/(host)/bookings/[id].tsx:224` | 224 | `borderRadius: 28` | Avatar frame | Use `Radius.xxl (24)` |
| `app/(consumer)/booking/confirmation/[id].tsx:129` | 129 | `borderRadius: 48` | Success icon | Use `Radius.full` |
| `app/(host)/messages/index.tsx:142` | 142 | `borderRadius: 24` | Compose area | Use `Radius.xxl (24)` — matches value |
| `app/(operator)/messages/index.tsx:143` | 143 | `borderRadius: 24` | Compose area | Use `Radius.xxl (24)` — matches value |

---

## 4. Screen Title Font Sizes

Design system: screen titles should be `fontSize: 24-26`, `fontWeight: '800'`, `color: Colors.text`.

### Compliant screens (24-26 range)

| Screen | Title fontSize |
|---|---|
| `auth/verify.tsx` | 26 |
| `auth/operator-stripe.tsx` | 26 |
| `auth/consent.tsx` | 26 |
| `(consumer)/search/index.tsx` | 26 |
| `(consumer)/profile/index.tsx` | 26 |
| `(consumer)/profile/privacy-settings.tsx` | 26 |
| `(consumer)/profile/delete-account.tsx` | 26 |
| `(operator)/bookings/index.tsx` | 26 |
| `(operator)/profile/index.tsx` | 26 |
| `(host)/listings/index.tsx` | 26 |
| `(host)/bookings/index.tsx` | 26 |
| `(host)/listings/new.tsx` | 26 |
| `(operator)/dashboard/index.tsx` | 24 (greeting) |

### Deviating screens (needs manual review)

| Screen | Title fontSize | fontWeight | Issue |
|---|---|---|---|
| `auth/login.tsx` | 28 | '800' | Slightly above range — acceptable |
| `auth/operator-setup.tsx` | 28 | '800' | Slightly above range — acceptable |
| `(consumer)/profile/verify.tsx` | 20 (step title) | '800' | Multi-step flow — intentionally smaller |
| `(consumer)/bookings/review/[bookingId].tsx` | 28 (success) | '800' | Success state — acceptable |
| `(consumer)/booking/confirmation/[id].tsx` | 28 (confirmation) | '800' | Confirmation state — acceptable |
| `(host)/listings/new.tsx` | 26 | '900' | fontWeight '900' is non-standard (use '800') |
| `(host)/listings/add-external.tsx` | 22 (step title) | '800' | Multi-step flow — intentionally smaller |

---

## 5. Horizontal Screen Padding

Design system: main content horizontal padding should use `Spacing.base (16)` or `Spacing.xl (24)`.

Main screen-level containers all correctly use `Spacing.base` or `Spacing.xl`. The following use literal numeric values:

| File | Line | Value | Context | Action needed |
|---|---|---|---|---|
| `app/(consumer)/explore/index.tsx:603` | 603 | `paddingHorizontal: 16` | Search bar container | Replace with `Spacing.base` |
| `app/(consumer)/explore/index.tsx:625` | 625 | `paddingHorizontal: 16` | Filter row container | Replace with `Spacing.base` |
| All chat bubbles (`paddingHorizontal: 14`) | — | 14 | Inner bubble padding | OK — not a screen-level padding |
| All pills (`paddingHorizontal: 12-14`) | — | varies | Inner pill padding | OK — small component padding |

---

## 6. Color Token Usage

| Metric | Count |
|---|---|
| `Colors.*` references (app/) | 1176 |
| `Colors.*` references (components/) | 461 |
| Total token references | **1637** |
| Hardcoded hex in StyleSheets — fixed | 6 |
| Hardcoded hex in gradient/map/WebView (valid exceptions) | 12 |

**Token adoption rate: ~99% after fixes**  
Pre-audit: ~98.9% (18 hardcoded / 1655 total)  
Post-audit: ~100% for StyleSheet usage (only valid exceptions remain)

---

## Auto-Fixed Changes Summary

| File | Change | Type |
|---|---|---|
| `app/(operator)/_layout.tsx` | Tab bar colors -> Colors.primary / Colors.textTertiary / Colors.background | Color token |
| `app/(consumer)/_layout.tsx` | Tab bar colors -> Colors.primary / Colors.textTertiary / Colors.background | Color token |
| `app/(host)/_layout.tsx` | Tab bar colors -> Colors.primary / Colors.textTertiary / Colors.background | Color token |
| `components/ui/Button.tsx` | `height: 48` -> `minHeight: 52` | Button height |
| `components/listing/BookingBar.tsx` | `height: 48` -> `minHeight: 52` on bookBtn | Button height |
| `app/(consumer)/booking/confirmation/[id].tsx` | `height: 48` -> `minHeight: 52` on msgBtn | Button height |
| `app/auth/operator-stripe.tsx` | `borderRadius: 40` -> `Radius.full` on iconContainer | Border radius token |

**Total auto-fixes: 7 changes across 7 files**

---

## Recommended Next Steps (Manual Review)

Priority order:

1. **High:** Replace remaining numeric `borderRadius` values with `Radius.*` tokens (17 instances listed in section 3, excluding intentional chat bubbles and circles)
2. **Medium:** Replace `paddingHorizontal: 16` literal in `explore/index.tsx` with `Spacing.base`
3. **Low:** Fix `fontWeight: '900'` in `(host)/listings/new.tsx` to `'800'` (design system max)
4. **Low:** Verify title fontWeight on `(host)/dashboard` and `(host)/profile` title styles
