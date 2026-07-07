# Stripe Production Checklist — Rentivo

## Implemented
- Stripe Connect Express onboarding UI (app/auth/operator-stripe.tsx)
- create-stripe-account-link Edge Function (deployed)
- stripe-webhook Edge Function (deployed)
- delete-account Edge Function (deployed)
- Platform fee: 10% (Config.platformCut)
- Payment utilities: calculatePlatformFee, toStripeAmount (lib/api/payments.ts)

## Before Go-Live (Required)
- [ ] Rotate: sk_test_ to sk_live_ in Supabase Edge Function secrets
- [ ] Rotate: pk_test_ to pk_live_ in EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
- [ ] Add Stripe-Signature verification in stripe-webhook function
- [ ] Set STRIPE_WEBHOOK_SECRET in Supabase Edge Function secrets
- [ ] Handle account.updated webhook → update stripe_onboarded flag in rentivo_operators
- [ ] Handle payout.paid webhook → notify operator via push notification
- [ ] Test full Connect Express onboarding with real bank account in Stripe test mode
- [ ] Enable Stripe Radar fraud rules in Dashboard

## Future Gates (Post-Launch)
- [ ] Stripe Identity KYC (kyc_verified_at hook already in rentivo_operators)
- [ ] Stripe Tax for EU VAT automation (at 100k ARR)
- [ ] ChartMogul MRR tracking integration (mrr_summary view ready)

## Test Cards
- Success: 4242 4242 4242 4242, any future date, any CVC
- Decline: 4000 0000 0000 0002
- 3D Secure: 4000 0025 0000 3155
- Test IBAN: GB33BUKB20201555555555

## Webhook Events to Handle
- [x] checkout.session.completed (stub exists)
- [ ] account.updated → stripe_onboarded = true
- [ ] payout.paid → push notification to operator
- [ ] charge.dispute.created → alert to admin
