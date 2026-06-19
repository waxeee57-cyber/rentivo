import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!signature || !webhookSecret) return new Response('Missing signature', { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        if (!bookingId) break

        // Deposit Model B: a deposit charge ALSO emits payment_intent.succeeded.
        // It must NOT be treated as the rental payment (would re-confirm the
        // booking / overwrite paid_at + stripe_charge_id). Branch on metadata.kind.
        if (pi.metadata?.kind === 'deposit_charge') {
          await supabase.from('rentivo_bookings').update({
            deposit_status: 'charged',
            deposit_charged_amount: (pi.amount_received ?? pi.amount) / 100,
          }).eq('id', bookingId)
          break
        }

        // Rental payment.
        await supabase.from('rentivo_bookings').update({
          payment_status: 'paid',
          status: 'confirmed',
          paid_at: new Date().toISOString(),
          stripe_charge_id: typeof pi.latest_charge === 'string' ? pi.latest_charge : null,
        }).eq('id', bookingId)
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        if (!bookingId) break

        if (pi.metadata?.kind === 'deposit_charge') {
          // Only fail-forward from 'authorized'; never clobber a later success/release.
          await supabase.from('rentivo_bookings')
            .update({ deposit_status: 'charge_failed' })
            .eq('id', bookingId)
            .eq('deposit_status', 'authorized')
          break
        }

        await supabase.from('rentivo_bookings')
          .update({ payment_status: 'failed' }).eq('id', bookingId)
        break
      }
      case 'setup_intent.succeeded': {
        // Deposit Model B: the renter's card was vaulted. Persist the resulting
        // payment_method and flip the deposit to 'authorized'.
        const si = event.data.object as Stripe.SetupIntent
        const bookingId = si.metadata?.booking_id
        const paymentMethodId = typeof si.payment_method === 'string'
          ? si.payment_method
          : si.payment_method?.id ?? null
        if (bookingId && paymentMethodId) {
          await supabase.from('rentivo_bookings').update({
            deposit_payment_method_id: paymentMethodId,
            deposit_status: 'authorized',
          })
            .eq('id', bookingId)
            .eq('deposit_status', 'none') // only flip from the initial state
        }
        break
      }
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        if (account.charges_enabled && account.payouts_enabled) {
          // Owner can be an operator OR a host — update whichever row matches.
          await supabase.from('rentivo_operators')
            .update({ stripe_onboarded: true }).eq('stripe_account_id', account.id)
          await supabase.from('rentivo_hosts')
            .update({ stripe_onboarded: true }).eq('stripe_account_id', account.id)
        }
        break
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response('Handler error', { status: 500 })
  }
})
