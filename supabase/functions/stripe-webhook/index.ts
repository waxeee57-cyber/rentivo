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
        if (bookingId) {
          await supabase.from('rentivo_bookings').update({
            payment_status: 'captured',
            status: 'confirmed',
            paid_at: new Date().toISOString(),
            stripe_charge_id: pi.latest_charge as string,
          }).eq('id', bookingId)
        }
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        if (bookingId) {
          await supabase.from('rentivo_bookings')
            .update({ payment_status: 'failed' }).eq('id', bookingId)
        }
        break
      }
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        if (account.charges_enabled && account.payouts_enabled) {
          await supabase.from('rentivo_operators')
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
