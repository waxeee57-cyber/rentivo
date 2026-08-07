import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Deposit Model B — vault the renter's card on a PLATFORM Stripe Customer via a
// SetupIntent (usage off_session). The card is later charged off_session by
// charge-deposit on assessed damage. The card MUST live on the platform account
// (not a connected account) so the platform can initiate that future charge.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Unauthorized', 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? ''
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) return jsonError('Unauthorized', 401)

  try {
    const { booking_id } = await req.json()
    if (!booking_id || typeof booking_id !== 'string') {
      return jsonError('Missing booking_id', 400)
    }

    // ── Load booking; only its renter may vault a deposit card.
    const { data: booking, error: bookingError } = await supabase
      .from('rentivo_bookings')
      .select('id, user_id, deposit_amount, currency, deposit_setup_intent_id, deposit_status, deposit_charge_attempts')
      .eq('id', booking_id)
      .maybeSingle()

    if (bookingError) return jsonError('Failed to load booking', 500)
    if (!booking) return jsonError('Booking not found', 404)
    if (booking.user_id !== user.id) return jsonError('Booking does not belong to caller', 403)

    if (!(Number(booking.deposit_amount) > 0)) {
      return jsonError('No deposit required for this booking', 400)
    }

    // ── Idempotency: reuse an existing SetupIntent only while it is still USABLE.
    //
    // This used to return the stored intent unconditionally. After the first card
    // is vaulted that intent is `succeeded`, and a succeeded SetupIntent cannot be
    // confirmed again — so a renter whose deposit card later declined was handed
    // back a dead object and had no way to supply a different card, for the life
    // of the booking. Combined with charge-deposit's one-attempt-per-decline
    // behaviour, a soft decline permanently ended deposit collection.
    if (booking.deposit_setup_intent_id) {
      const existing = await stripe.setupIntents.retrieve(booking.deposit_setup_intent_id)
      const reusable = existing.status === 'requires_payment_method'
        || existing.status === 'requires_confirmation'
        || existing.status === 'requires_action'
      if (reusable) {
        return new Response(
          JSON.stringify({ client_secret: existing.client_secret, setup_intent_id: existing.id, reused: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      // Otherwise fall through and mint a fresh one below.
    }

    // ── Ensure a PLATFORM Stripe Customer for the renter (bookings.user_id maps
    //    to rentivo_users.auth_id).
    const { data: renter, error: renterError } = await supabase
      .from('rentivo_users')
      .select('id, email, name, stripe_customer_id')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (renterError) return jsonError('Failed to load renter profile', 500)
    if (!renter) return jsonError('Renter profile not found', 404)

    let customerId = renter.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: renter.email ?? user.email ?? undefined,
          name: renter.name ?? undefined,
          metadata: { rentivo_user_id: renter.id, auth_id: user.id },
        },
        { idempotencyKey: `rentivo_cust_${user.id}` }
      )
      customerId = customer.id
      await supabase
        .from('rentivo_users')
        .update({ stripe_customer_id: customerId })
        .eq('id', renter.id)
    }

    // ── SetupIntent to vault the card for future off_session deposit charges.
    const setupIntent = await stripe.setupIntents.create(
      {
        customer: customerId,
        usage: 'off_session',
        payment_method_types: ['card'],
        metadata: { booking_id, user_id: user.id, platform: 'rentivo' },
      },
      // Attempt-scoped, not booking-scoped. A fixed key made Stripe replay the
      // first SetupIntent for 24 hours, so even after the early return above was
      // fixed the renter would have been handed the same dead object back.
      { idempotencyKey: `rentivo_si_${booking_id}_${Number(booking.deposit_charge_attempts ?? 0)}_${booking.deposit_setup_intent_id ?? 'first'}` }
    )

    // Persist the SetupIntent id. deposit_status flips to 'authorized' and the
    // payment_method_id is captured on the setup_intent.succeeded webhook.
    await supabase
      .from('rentivo_bookings')
      .update({ deposit_setup_intent_id: setupIntent.id })
      .eq('id', booking_id)

    return new Response(
      JSON.stringify({ client_secret: setupIntent.client_secret, setup_intent_id: setupIntent.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('create-deposit-setup:', error)
    return jsonError('Internal error', 500)
  }
})
