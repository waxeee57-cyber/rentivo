// ═══════════════════════════════════════════════════════════════════════════
// cancel-booking — the refund the app was already promising.
//
// The booking detail screen renders "If you cancel now: 100% refund (€X)" and a
// confirm sheet listing the exact refund amount, but handleCancel only ever did
// a bare `UPDATE rentivo_bookings SET status='cancelled'`. There was no
// stripe.refunds.create anywhere in the repo — the app made a specific monetary
// promise it structurally could not keep, which turns into chargebacks.
//
// This function is the server-authoritative counterpart: it recomputes the
// refund from the LISTING's cancellation policy and the booking's own start
// date (never a client-supplied amount), issues the Stripe refund on the
// connected charge, and only then flips the booking to cancelled/refunded.
// ═══════════════════════════════════════════════════════════════════════════
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

const numOr0 = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// MIRRORS lib/utils/cancellation.ts — keep the two in sync.
type Policy = 'flexible' | 'moderate' | 'strict'
function refundPercentFor(policy: Policy, hoursUntilStart: number): number {
  switch (policy) {
    case 'flexible': return hoursUntilStart >= 24 ? 100 : 0
    case 'moderate':
      if (hoursUntilStart >= 48) return 100
      if (hoursUntilStart >= 24) return 50
      return 0
    case 'strict': return hoursUntilStart >= 72 ? 100 : 0
  }
}

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
    const { booking_id } = await req.json().catch(() => ({}))
    if (!booking_id || typeof booking_id !== 'string') return jsonError('Missing booking_id', 400)

    const { data: booking, error: bookingError } = await supabase
      .from('rentivo_bookings')
      .select('id, user_id, operator_id, listing_id, start_date, status, payment_status, payment_intent_id, total_amount, currency')
      .eq('id', booking_id)
      .maybeSingle()

    if (bookingError) return jsonError('Failed to load booking', 500)
    if (!booking) return jsonError('Booking not found', 404)

    // Either party may cancel: the traveler who booked it, or the owner of the
    // listing. Anyone else is rejected outright.
    let authorised = booking.user_id === user.id
    if (!authorised) {
      // `auth_id`, NOT `user_id`. Neither rentivo_operators nor rentivo_hosts
      // has a user_id column, so this select used to fail outright: `owned` came
      // back null, ownerIds was empty, and EVERY owner-side cancellation got a
      // 403. Operator and host declines route through this function, so decline
      // was dead on both surfaces.
      const { data: owned, error: ownedError } = await supabase
        .from('rentivo_listings')
        .select('id, owner_user_id, operator:rentivo_operators(auth_id), host:rentivo_hosts(auth_id)')
        .eq('id', booking.listing_id)
        .maybeSingle()
      if (ownedError) {
        console.error('[cancel-booking] ownership lookup failed', booking.listing_id, ownedError)
        return jsonError('Could not verify ownership', 500)
      }
      const ownerIds = [
        owned?.owner_user_id,
        (owned?.operator as { auth_id?: string } | null)?.auth_id,
        (owned?.host as { auth_id?: string } | null)?.auth_id,
      ].filter(Boolean)
      authorised = ownerIds.includes(user.id)
    }
    if (!authorised) return jsonError('Not allowed to cancel this booking', 403)

    if (booking.status === 'cancelled') {
      return new Response(
        JSON.stringify({ already_cancelled: true, refund_amount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (booking.status === 'completed') return jsonError('Completed bookings cannot be cancelled', 409)

    // ── Refund policy comes from the LISTING, never the request body.
    const { data: listing } = await supabase
      .from('rentivo_listings')
      .select('cancellation_policy')
      .eq('id', booking.listing_id)
      .maybeSingle()
    const rawPolicy = listing?.cancellation_policy
    const policy: Policy =
      rawPolicy === 'flexible' || rawPolicy === 'strict' ? rawPolicy : 'moderate'

    const startMs = Date.parse(booking.start_date)
    const hoursUntilStart = Number.isFinite(startMs)
      ? (startMs - Date.now()) / 3600000
      : 0

    // An owner-initiated cancellation always refunds the traveler in full —
    // the renter did nothing wrong.
    const ownerCancelled = booking.user_id !== user.id
    const percent = ownerCancelled ? 100 : refundPercentFor(policy, hoursUntilStart)

    const paidTotal = numOr0(booking.total_amount)
    let wasPaid = booking.payment_status === 'paid' || booking.payment_status === 'captured'

    // ── The cancellation race, closed from this side.
    //
    // payment_status only becomes 'paid' when the webhook lands. Cancel in the
    // seconds between authorisation and that webhook and this function used to
    // compute a €0 refund on money Stripe had already taken. Ask Stripe what
    // actually happened rather than trusting our own column.
    let capturedMinor: number | null = null
    if (!wasPaid && booking.payment_intent_id) {
      try {
        const pi = await stripe.paymentIntents.retrieve(booking.payment_intent_id)
        if (pi.status === 'succeeded' || pi.status === 'requires_capture') {
          wasPaid = true
          capturedMinor = pi.amount_received || pi.amount || 0
        } else if (
          pi.status === 'requires_payment_method' ||
          pi.status === 'requires_confirmation' ||
          pi.status === 'requires_action'
        ) {
          // Kill the intent so the charge cannot land after we cancel. Failure
          // is non-fatal: the webhook now refunds a charge that arrives for a
          // cancelled booking.
          await stripe.paymentIntents.cancel(booking.payment_intent_id).catch(() => {})
        }
        // 'processing' is neither capturable nor cancelable — the webhook's
        // cancelled-booking branch refunds it when it settles.
      } catch (err) {
        console.error('[cancel-booking] PaymentIntent lookup failed', booking.payment_intent_id, err)
      }
    }

    // Money Stripe actually holds beats our own total_amount column.
    const refundBase = capturedMinor != null ? capturedMinor / 100 : paidTotal
    const refundAmount = wasPaid ? Math.round(refundBase * percent) / 100 : 0

    let refundId: string | null = null
    if (refundAmount > 0 && booking.payment_intent_id) {
      // reverse_transfer pulls the money back out of the connected account, and
      // refund_application_fee returns the platform's cut proportionally — without
      // these the platform eats the entire refund.
      const refund = await stripe.refunds.create(
        {
          payment_intent: booking.payment_intent_id,
          amount: Math.round(refundAmount * 100),
          reverse_transfer: true,
          refund_application_fee: true,
          metadata: { booking_id, cancelled_by: ownerCancelled ? 'owner' : 'traveler', policy },
        },
        { idempotencyKey: `rentivo_refund_${booking_id}` }
      )
      refundId = refund.id
    }

    const nextPaymentStatus = refundAmount > 0
      ? (refundAmount >= refundBase ? 'refunded' : 'partially_refunded')
      : booking.payment_status

    const { error: updateError } = await supabase
      .from('rentivo_bookings')
      .update({
        status: 'cancelled',
        payment_status: nextPaymentStatus,
        cancelled_at: new Date().toISOString(),
        refund_amount: refundAmount,
        // The column existed and was never written, so a support question of
        // "did this refund actually go out?" had no answer in our own data.
        refund_id: refundId,
      })
      .eq('id', booking_id)

    if (updateError) {
      // The money already moved. Surface loudly rather than reporting success —
      // a silent failure here leaves a refunded-but-active booking.
      return jsonError(
        `Refund issued (${refundId ?? 'n/a'}) but the booking could not be updated: ${updateError.message}`,
        500
      )
    }

    // Free the dates again so the vehicle is immediately re-sellable.
    await supabase
      .from('rentivo_availability')
      .delete()
      .eq('booking_id', booking_id)

    return new Response(
      JSON.stringify({
        cancelled: true,
        refund_amount: refundAmount,
        refund_percent: percent,
        refund_id: refundId,
        policy,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
})
