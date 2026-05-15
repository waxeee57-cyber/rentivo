---
name: stripe-debug
description: Stripe fizetési hibák diagnosztizálása és javítása
---

# Stripe Debug — Rentivo

## Ellenőrzési sorrend:

### 1. Environment variables
- EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY != 'pk_test_placeholder'
- STRIPE_SECRET_KEY beállítva Supabase secrets-ben
- STRIPE_WEBHOOK_SECRET beállítva Supabase secrets-ben

### 2. Edge Functions
- npx supabase functions list
- create-payment-intent deployolva?
- stripe-webhook deployolva?

### 3. Webhook
- Stripe Dashboard → Webhooks → endpoint aktív?
- Events: payment_intent.succeeded, payment_intent.payment_failed, account.updated
- Signing secret egyezik STRIPE_WEBHOOK_SECRET-tel?

### 4. Payment flow
- createPaymentIntent() → client_secret megérkezik?
- confirmPayment() → succeeded vagy error?
- Webhook tüzel → booking payment_status: 'captured'?

### 5. Stripe Connect
- operator.stripe_account_id beállítva?
- operator.stripe_onboarded = true?
- account.updated webhook tüzel?

## Test kártyák:
- Siker: 4242 4242 4242 4242
- 3DS szükséges: 4000 0025 0000 3155
- Sikertelen: 4000 0000 0000 9995
