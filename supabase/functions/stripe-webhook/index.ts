/**
 * Stripe Webhook Handler
 *
 * STÁTUSZ: PLACEHOLDER — production aktiváláskor implementálandó
 *
 * JÖVŐBENI EVENTS:
 * - checkout.session.completed → booking status: pending → confirmed
 * - account.updated → operator capability check (transfers.status)
 * - payout.paid → operator notification (Expo Push)
 * - payment_intent.payment_failed → user notification + booking cancel
 *
 * IMPLEMENTÁLÁS LÉPÉSEI:
 * 1. Stripe Dashboard → Webhooks → Add endpoint
 *    URL: {SUPABASE_URL}/functions/v1/stripe-webhook
 * 2. Select events: checkout.session.completed, account.updated, payout.paid
 * 3. Webhook secret → STRIPE_WEBHOOK_SECRET Supabase env var-ba
 * 4. Uncomment az alábbi implementációt
 *
 * SECURITY:
 * - Minden request Stripe signature verification-ön megy át
 * - stripe.webhooks.constructEvent() → throws ha invalid
 * - Idempotency: stripe_events tábla PRIMARY KEY = event ID
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (_req) => {
  // TODO: Stripe webhook implementáció
  //
  // const body = await req.text()
  // const signature = req.headers.get('stripe-signature') ?? ''
  // const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
  //
  // let event: Stripe.Event
  // try {
  //   event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  // } catch {
  //   return new Response('Invalid signature', { status: 400 })
  // }
  //
  // // Idempotency check
  // const { error: dupError } = await supabase
  //   .from('stripe_events')
  //   .insert({ id: event.id, type: event.type, data: event.data })
  // if (dupError) return new Response('Already processed', { status: 200 })
  //
  // switch (event.type) {
  //   case 'checkout.session.completed':
  //     await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session)
  //     break
  //   case 'account.updated':
  //     await handleAccountUpdated(event.data.object as Stripe.Account)
  //     break
  //   case 'payout.paid':
  //     await handlePayoutPaid(event.data.object as Stripe.Payout)
  //     break
  // }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
