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

// Owner (operator or host) row carrying the Stripe Connect account.
interface ConnectAccount {
  stripe_account_id: string | null
  stripe_onboarded: boolean | null
}

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
    // CONTRACT: the client sends ONLY booking_id. The charge amount and the
    // destination Connect account are both derived server-side from the persisted
    // booking/listing — a tampered client can neither dictate the amount nor
    // redirect the payout.
    const { booking_id } = await req.json()
    if (!booking_id || typeof booking_id !== 'string') {
      return jsonError('Missing booking_id', 400)
    }

    // ── Load the booking with the service-role client (bypasses RLS).
    const { data: booking, error: bookingError } = await supabase
      .from('rentivo_bookings')
      .select('id, user_id, listing_id, total_amount, currency, status, payment_status, payment_intent_id')
      .eq('id', booking_id)
      .maybeSingle()

    if (bookingError) return jsonError('Failed to load booking', 500)
    if (!booking) return jsonError('Booking not found', 404)

    // Ownership: the caller must be the traveler who owns this booking.
    if (booking.user_id !== user.id) return jsonError('Booking does not belong to caller', 403)

    // ── Idempotency: if this booking already has a PaymentIntent, return its
    //    client_secret instead of creating a second intent (double-charge guard).
    if (booking.payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(booking.payment_intent_id)
      return new Response(
        JSON.stringify({ client_secret: existing.client_secret, payment_intent_id: existing.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── State guard: only an unpaid booking may open a fresh intent.
    if (booking.status === 'cancelled') return jsonError('Booking is cancelled', 409)
    if (booking.payment_status === 'captured' || booking.payment_status === 'paid') {
      return jsonError('Booking is already paid', 409)
    }

    // ── Authoritative amount: charge EXACTLY what the server stored.
    const amountCents = Math.round(Number(booking.total_amount) * 100)
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return jsonError('Invalid booking amount', 400)
    }

    // ── Destination account: derived from the LISTING, never the request body.
    const { data: listing, error: listingError } = await supabase
      .from('rentivo_listings')
      .select(
        'id, title, owner_type, operator:rentivo_operators(stripe_account_id, stripe_onboarded), host:rentivo_hosts(stripe_account_id, stripe_onboarded)'
      )
      .eq('id', booking.listing_id)
      .maybeSingle()

    if (listingError) return jsonError('Failed to load listing', 500)
    if (!listing) return jsonError('Listing not found', 404)

    const owner = (listing.owner_type === 'host'
      ? listing.host
      : listing.operator) as ConnectAccount | null
    const destination = owner?.stripe_account_id ?? null

    if (!owner?.stripe_onboarded || !destination || !destination.startsWith('acct_')) {
      return jsonError('Owner is not set up to receive payments', 400)
    }

    const platformCut = parseFloat(Deno.env.get('PLATFORM_CUT') ?? '0.10')
    const platformFeeCents = Math.round(amountCents * platformCut)
    const currency = (typeof booking.currency === 'string' ? booking.currency : 'EUR').toLowerCase()

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency,
        automatic_payment_methods: { enabled: true },
        application_fee_amount: platformFeeCents,
        transfer_data: { destination },
        metadata: {
          booking_id,
          user_id: user.id,
          listing_title: listing.title ?? '',
          platform: 'rentivo',
        },
      },
      { idempotencyKey: `rentivo_pi_${booking_id}` }
    )

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
