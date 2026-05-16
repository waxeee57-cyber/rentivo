# Rentivo — Product Requirements Document
## For Loki Mode autonomous agent system

---

## Product Overview

**Product name:** Rentivo
**Type:** Multi-sided rental marketplace + operator SaaS
**Platform:** React Native (Expo SDK 54) mobile app + Next.js web
**Backend:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions, Storage)
**Payments:** Stripe Connect
**Target market:** Europe — small/medium rental operators (cars, boats, villas, motorcycles, drones, etc.)

---

## Business Model

- **Take rate:** 2.5% from renter + 8-12% from operator
- **Supply side:** RentalOS — operator backend SaaS
- **Demand side:** Rentivo — consumer marketplace app
- **First operator:** CostaSol Car Rent, Marbella, Spain
- **Second operator:** Zöldfészek, Hungary
- **GMV target:** €500k/day

---

## Current Status (as of May 2026)

### What is LIVE and working:
- Auth: OTP phone login, consent, role selection (consumer/host/operator)
- Consumer flow: Explore → Listing detail → Booking → Stripe payment → Confirmation
- Operator flow: Dashboard (MRR), Fleet management, Booking management, iCal sync
- Host flow: Listing creation, booking management
- Admin panel: Operator/user management, dispute resolution, promo codes
- Stripe Connect: Operator onboarding, PaymentIntent, webhook
- Real-time chat: Supabase Realtime, with translation (Claude AI)
- GDPR: Delete account (Article 17), consent management, audit log
- iCal: Export (RFC 5545) + Import (availability sync)
- Identity verification: Didit KYC (EU-compliant)
- Digital contract: eIDAS Simple Electronic Signature
- Hourly rental: Time-based pricing option
- Dynamic pricing: Weekend/peak season multipliers
- Delivery zones: Operator sets delivery radius + fee
- Seasonal blackout: Fleet unavailability periods
- Loyalty tiers: Bronze/Silver/Gold/Platinum with points
- Operator tiers: New/Verified/Top/Elite badges
- Insurance packages: Basic/Standard/Premium
- Promo codes: Percentage and fixed discounts
- Referral system: Unique referral codes + point rewards
- Offline QR voucher: Booking confirmation QR code
- Map view: List/Map toggle with price markers
- AI Rental Assistant: Claude Haiku chat interface
- AI Damage Detection: Claude Vision before/after photo comparison
- AI Pricing Suggestions: Market comparison for operators
- Earnings dashboard: Analytics for operators (4 periods, bar chart)
- Co-host management: Staff invite with role-based access
- Webhook/API: Operator system integration
- Email onboarding: Resend API (welcome, booking, cancellation emails)
- Flight tracking: Flight number input, delay notification
- Dispute resolution: Report flow, admin resolution

### Tech stack:
- React Native + Expo SDK 54 (TypeScript strict)
- Next.js 15 (rentivo.domrol.com web)
- Supabase: xeyfsacbozucxrwlefro.supabase.co
- Stripe: Live mode configured
- Claude API: AI assistant + damage detection + chat translation
- Didit: Identity verification
- Resend: Email delivery

### Key files:
- C:\projects\Rentivo — React Native app
- C:\projects\rentivo-web — Next.js web
- C:\projects\RentalOS — Operator SaaS (separate)
- C:\projects\domrol-web — DomRol landing page

---

## What Needs to Be Built Next

### Priority 1 — Critical fixes (already identified by audit):
1. Deploy rental-assistant Edge Function (currently 404)
2. Fix pricing-suggestions table name: listings → rentivo_listings
3. Fix hasReview hardcode → live Supabase query
4. Admin users screen: add live Supabase fetch
5. Admin operators: add "Approve" action

### Priority 2 — SEO city pages (rentivo-web):
- /rentals/marbella, /rentals/budapest, /rentals/balaton, /rentals/barcelona etc.
- Live Supabase listings on explore page (currently mock data)
- Download page (/download)
- Footer dead ends fixed

### Priority 3 — EAS Build + App Store:
- Configure EAS Build for iOS and Android
- TestFlight deployment
- Google Play internal testing

### Priority 4 — Growth features:
- Programmatic SEO: city + category pages ("car rental marbella")
- Push notification campaigns
- Operator outreach email sequences
- App Store Optimization (ASO)

### Priority 5 — Product improvements:
- Availability calendar on listing detail (blocked dates visible)
- Price breakdown per day on booking screen
- Operator response time badge
- "Recently viewed" listings
- Share listing (Expo Sharing)
- Deep links (listing → app)

---

## Technical Standards

### Code quality:
- TypeScript strict — 0 errors always
- No console.log in production (only // DEBUG: or // SAFE: exceptions)
- No hardcoded mock data without Config.useMock guard
- No dead end buttons (onPress={() => {}})
- Every TouchableOpacity: accessibilityLabel + minHeight: 44
- Every screen: SafeAreaView + loading state + error state + empty state

### Database:
- Every table: RLS enabled
- Every new table: RLS policy for SELECT/INSERT/UPDATE
- Table naming: rentivo_* prefix
- user_id (NOT traveler_id) in bookings
- push_token nullification: .eq('auth_id', userId) on BOTH tables

### Architecture:
- Supabase MCP available for direct DB operations
- 14 Edge Functions deployed: create-payment-intent, stripe-webhook, ical-export, ical-import, damage-detector, flight-tracker, didit-create-session, didit-webhook, create-stripe-account-link, delete-account, rental-assistant, pricing-suggestions, translate-message, operator-webhook-dispatch, send-email
- Config.useMock = false (live mode)

### Design system:
- Colors.background: #0A1628
- Colors.accent: #E8A44A
- Colors.cardBackground: #1A2B45
- Colors.border: #2A3B55
- Dark theme throughout
- Tab bar paddingBottom: 100

---

## Success Criteria

A feature is "done" when:
1. 0 TypeScript errors
2. No dead end buttons
3. No console.log
4. Loading + error + empty state present
5. HU/EN i18n covered
6. accessibilityLabel on all interactive elements
7. Live Supabase data (not mock)
8. Pre-commit hook passes
