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

interface OwnerRow {
  id: string
  auth_id: string | null
  stripe_account_id: string | null
  stripe_onboarded: boolean | null
}

// Deposit Model B — charge the renter's vaulted card off_session on assessed
// damage. Capped at booking.deposit_amount, destination = the listing owner
// (operator/host), NO platform fee (the full damage amount goes to the owner).
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
    const { booking_id, assessed_amount } = await req.json()
    if (!booking_id || typeof booking_id !== 'string') {
      return jsonError('Missing booking_id', 400)
    }

    // ── Load booking + listing owner (operator or host) Connect account.
    const { data: booking, error: bookingError } = await supabase
      .from('rentivo_bookings')
      .select(
        'id, user_id, listing_id, currency, deposit_amount, deposit_status, deposit_payment_method_id, ' +
        'listing:rentivo_listings(owner_type, operator:rentivo_operators(id, auth_id, stripe_account_id, stripe_onboarded), host:rentivo_hosts(id, auth_id, stripe_account_id, stripe_onboarded))'
      )
      .eq('id', booking_id)
      .maybeSingle()

    if (bookingError) return jsonError('Failed to load booking', 500)
    if (!booking) return jsonError('Booking not found', 404)

    const listing = booking.listing as {
      owner_type: string | null
      operator: OwnerRow | null
      host: OwnerRow | null
    } | null
    if (!listing) return jsonError('Listing not found', 404)

    const owner = (listing.owner_type === 'host' ? listing.host : listing.operator) ?? null

    // ── Authorization: ONLY the listing's owner (operator/host) or an admin.
    //    Without this, anyone could charge a stranger's saved card. Critical.
    const { data: caller } = await supabase
      .from('rentivo_users')
      .select('is_admin')
      .eq('auth_id', user.id)
      .maybeSingle()
    const isAdmin = caller?.is_admin === true
    const isOwner = !!owner?.auth_id && owner.auth_id === user.id
    if (!isAdmin && !isOwner) {
      return jsonError('Not authorized to charge this deposit', 403)
    }

    // ── Guards: card must be vaulted, amount in (0, deposit_amount].
    if (booking.deposit_status !== 'authorized') {
      return jsonError(`Deposit not chargeable (status: ${booking.deposit_status})`, 409)
    }
    if (!booking.deposit_payment_method_id) {
      return jsonError('No vaulted payment method on this booking', 409)
    }

    const assessedNum = Number(assessed_amount)
    const depositCap = Number(booking.deposit_amount)
    if (!Number.isFinite(assessedNum) || assessedNum <= 0) {
      return jsonError('Invalid assessed_amount', 400)
    }
    if (assessedNum > depositCap) {
      return jsonError(`assessed_amount exceeds deposit cap (${depositCap})`, 400)
    }

    const destination = owner?.stripe_account_id ?? null
    if (!owner?.stripe_onboarded || !destination || !destination.startsWith('acct_')) {
      return jsonError('Owner is not set up to receive payments', 400)
    }

    // ── Renter's PLATFORM Stripe Customer (the card is vaulted there).
    const { data: renter } = await supabase
      .from('rentivo_users')
      .select('stripe_customer_id')
      .eq('auth_id', booking.user_id)
      .maybeSingle()
    const customerId = renter?.stripe_customer_id
    if (!customerId) return jsonError('Renter has no Stripe customer on file', 409)

    const amountCents = Math.round(assessedNum * 100)
    const currency = (typeof booking.currency === 'string' ? booking.currency : 'EUR').toLowerCase()

    // ── Off_session charge to the vaulted card. No application_fee → the entire
    //    damage amount is transferred to the owner (default; flip later if needed).
    try {
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency,
          customer: customerId,
          payment_method: booking.deposit_payment_method_id,
          confirm: true,
          off_session: true,
          transfer_data: { destination },
          metadata: {
            booking_id,
            kind: 'deposit_charge',
            charged_by: user.id,
            platform: 'rentivo',
          },
        },
        { idempotencyKey: `rentivo_dep_${booking_id}` }
      )

      await supabase
        .from('rentivo_bookings')
        .update({ deposit_status: 'charged', deposit_charged_amount: assessedNum })
        .eq('id', booking_id)

      return new Response(
        JSON.stringify({
          deposit_status: 'charged',
          payment_intent_id: paymentIntent.id,
          charged_amount: assessedNum,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (chargeErr) {
      // Off_session charge failed (card declined, authentication_required, etc.).
      // Record the failure and surface it — do NOT swallow.
      await supabase
        .from('rentivo_bookings')
        .update({ deposit_status: 'charge_failed' })
        .eq('id', booking_id)

      const message = chargeErr instanceof Error ? chargeErr.message : 'Deposit charge failed'
      const code = (chargeErr as Stripe.errors.StripeError)?.code ?? null
      return new Response(
        JSON.stringify({ error: message, code, deposit_status: 'charge_failed' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
})
