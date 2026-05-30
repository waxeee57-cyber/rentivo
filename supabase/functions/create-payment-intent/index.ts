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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Unauthorized', 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) return jsonError('Unauthorized', 401)

  try {
    // amount_eur is accepted for backwards-compat but DELIBERATELY NOT TRUSTED.
    // The charge amount is recomputed server-side from the DB booking row below,
    // so a tampered client cannot lower (or raise) what the card is charged.
    const { booking_id, amount_eur, listing_title, operator_stripe_account_id } = await req.json()

    if (!booking_id || typeof booking_id !== 'string') {
      return jsonError('Missing booking_id', 400)
    }

    // Payout guard (defense-in-depth): never create a transferless intent silently.
    // Without a destination Connect account the money would land on the platform
    // account and never reach the operator.
    if (!operator_stripe_account_id || typeof operator_stripe_account_id !== 'string' || !operator_stripe_account_id.startsWith('acct_')) {
      return jsonError('Operator is not set up to receive payments', 400)
    }

    // ── Authoritative amount: load the booking with the service-role client and
    //    charge EXACTLY what the server stored. total_amount is the authoritative
    //    end-total column in rentivo_bookings (040_bookings.sql).
    const { data: booking, error: bookingError } = await supabase
      .from('rentivo_bookings')
      .select('id, user_id, total_amount, currency, payment_status')
      .eq('id', booking_id)
      .maybeSingle()

    if (bookingError) return jsonError('Failed to load booking', 500)
    if (!booking) return jsonError('Booking not found', 404)

    // Ownership: the caller must be the traveler who owns this booking.
    if (booking.user_id !== user.id) return jsonError('Booking does not belong to caller', 403)

    const amountCents = Math.round(Number(booking.total_amount) * 100)
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return jsonError('Invalid booking amount', 400)
    }

    // Observability only — flag (but do not act on) any client/server divergence.
    const clientCents = Math.round(Number(amount_eur) * 100)
    if (Number.isFinite(clientCents) && clientCents !== amountCents) {
      console.warn(
        `[create-payment-intent] amount mismatch for booking ${booking_id}: client=${clientCents} server=${amountCents} (using server)`
      )
    }

    const platformCut = parseFloat(Deno.env.get('PLATFORM_CUT') ?? '0.10')
    const platformFeeCents = Math.round(amountCents * platformCut)

    const currency = (typeof booking.currency === 'string' ? booking.currency : 'EUR').toLowerCase()

    const params: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { booking_id, user_id: user.id, listing_title, platform: 'rentivo' },
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: operator_stripe_account_id },
    }

    const paymentIntent = await stripe.paymentIntents.create(params)

    await supabase
      .from('rentivo_bookings')
      .update({ payment_intent_id: paymentIntent.id })
      .eq('id', booking_id)

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
})
