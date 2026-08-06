// ═══════════════════════════════════════════════════════════════════════════
// stripe-webhook — the only place a booking becomes paid.
//
// Three money bugs lived here and all three are fixed below:
//
//  1. A booking cancelled DURING the payment window was resurrected. The
//     success handler wrote status:'confirmed' unconditionally, so a renter who
//     cancelled at the moment of authorisation got: money taken, no refund, and
//     an active booking on their account. Now a cancelled booking is REFUNDED
//     here instead of confirmed.
//  2. A late payment_failed overwrote a success. Stripe delivers events out of
//     order and retries for days; a failed event from a superseded PaymentIntent
//     flipped a paid booking back to 'failed'. Now the event must belong to the
//     booking's CURRENT PaymentIntent and must not touch a paid booking.
//  3. Re-delivery ran every handler again. Stripe redelivers on any non-2xx and
//     on its own schedule. Events are now recorded and skipped on sight.
//
// Also: a paid booking finally blocks its own dates. Nothing in the codebase
// inserted rentivo_availability rows, so the operator calendar and the iCal
// export showed sold dates as free.
// ═══════════════════════════════════════════════════════════════════════════
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

type Supa = ReturnType<typeof createClient>

/**
 * Money already captured against a booking the renter (or owner) has cancelled.
 *
 * The cancel path could not refund it: at cancellation time payment_status was
 * still 'pending', so cancel-booking computed a €0 refund and moved on. This is
 * the other half of that race — the charge lands here a moment later and must
 * go straight back, in full. The renter was not on the hook for a cancellation
 * fee on money that had not been taken yet.
 */
async function refundCancelledBooking(
  supabase: Supa,
  bookingId: string,
  pi: Stripe.PaymentIntent,
): Promise<void> {
  const amountMinor = pi.amount_received || pi.amount || 0
  if (amountMinor <= 0) return

  let refundId: string | null = null
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: pi.id,
        // reverse_transfer pulls the money back out of the operator's connected
        // account and refund_application_fee returns our cut proportionally.
        // Without both, the platform funds the refund out of its own balance.
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: { booking_id: bookingId, reason: 'cancelled_during_payment_window' },
      },
      { idempotencyKey: `rentivo_race_refund_${bookingId}` },
    )
    refundId = refund.id
  } catch (err) {
    // Throwing gives Stripe's retry a chance to complete the refund. Leaving a
    // captured-but-unrefunded charge silently is what produces chargebacks.
    console.error('[stripe-webhook] race refund FAILED', bookingId, pi.id, err)
    throw err
  }

  await supabase.from('rentivo_bookings').update({
    payment_status: 'refunded',
    refund_amount: amountMinor / 100,
    refund_id: refundId,
    stripe_charge_id: typeof pi.latest_charge === 'string' ? pi.latest_charge : null,
  }).eq('id', bookingId)

  console.warn('[stripe-webhook] refunded a charge that landed after cancellation', bookingId, refundId)
}

/**
 * Block the rented dates. Half-open [start, end) — the return day is free for
 * the next renter, which is the same convention create-booking prices on.
 * cancel-booking deletes these by booking_id, so one ranged row per booking.
 */
async function blockDates(
  supabase: Supa,
  booking: { id: string; listing_id: string; start_date: string; end_date: string },
): Promise<void> {
  const { data: existing } = await supabase
    .from('rentivo_availability')
    .select('id')
    .eq('booking_id', booking.id)
    .limit(1)
  if (existing && existing.length > 0) return

  const { error } = await supabase.from('rentivo_availability').insert({
    listing_id: booking.listing_id,
    blocked_date: booking.start_date,
    end_date: booking.end_date,
    reason: 'booking',
    booking_id: booking.id,
  })
  // Not fatal: the booking is paid and the exclusion constraint still prevents a
  // true double sale. But it must be visible — an unblocked calendar is how an
  // operator ends up promising the same car twice.
  if (error) console.error('[stripe-webhook] availability block failed', booking.id, error)
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  // TWO secrets, because Stripe has two kinds of endpoint and `connect` cannot be
  // toggled after creation. A platform endpoint never receives events for a
  // CONNECTED account, so `account.updated` was never delivered here — 72
  // payment_intent.succeeded in rentivo_stripe_events and not one account.updated,
  // ever. The effect: stripe_onboarded could never change, an operator who
  // finished Connect onboarding stayed `false` forever, and create-payment-intent
  // refuses to route money to an account that reads as not onboarded. Onboarding
  // completed at Stripe and never completed here.
  //
  // The Connect endpoint has its own signing secret, so both are tried.
  const secrets = [
    Deno.env.get('STRIPE_WEBHOOK_SECRET'),
    Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET'),
  ].filter((s): s is string => !!s)

  if (!signature || secrets.length === 0) return new Response('Missing signature', { status: 400 })

  let event: Stripe.Event | null = null
  const body = await req.text()
  for (const secret of secrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, secret)
      break
    } catch {
      // Try the next secret. Only a body that verifies against NONE of them is
      // rejected.
    }
  }
  if (!event) return new Response('Invalid signature', { status: 400 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? ''
  )

  // ── Re-delivery guard. Checked BEFORE the handler and recorded AFTER it, so a
  //    failed handler is retried rather than marked done.
  const { data: seen } = await supabase
    .from('rentivo_stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle()
  if (seen) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

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

        // Read the booking BEFORE writing. This is the cancellation race: the
        // old code confirmed unconditionally and revived cancelled bookings.
        const { data: booking, error: loadError } = await supabase
          .from('rentivo_bookings')
          .select('id, status, payment_status, listing_id, start_date, end_date')
          .eq('id', bookingId)
          .maybeSingle()
        if (loadError) throw loadError
        if (!booking) {
          console.error('[stripe-webhook] payment for unknown booking', bookingId, pi.id)
          break
        }

        if (booking.status === 'cancelled') {
          await refundCancelledBooking(supabase, bookingId, pi)
          break
        }

        // Rental payment. `.neq('payment_status','paid')` keeps paid_at and
        // stripe_charge_id stable across retries; `.neq('status','cancelled')`
        // closes the window between the read above and this write.
        await supabase.from('rentivo_bookings').update({
          payment_status: 'paid',
          status: 'confirmed',
          paid_at: new Date().toISOString(),
          stripe_charge_id: typeof pi.latest_charge === 'string' ? pi.latest_charge : null,
        })
          .eq('id', bookingId)
          .neq('payment_status', 'paid')
          .neq('status', 'cancelled')

        await blockDates(supabase, booking as unknown as {
          id: string; listing_id: string; start_date: string; end_date: string
        })
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

        // Two guards, both load-bearing:
        //   payment_intent_id — a failure from an ABANDONED earlier attempt must
        //   not touch a booking that has since been paid on a different PI.
        //   payment_status    — 'paid' is terminal here; only the refund paths
        //   may move money back out.
        await supabase.from('rentivo_bookings')
          .update({ payment_status: 'failed' })
          .eq('id', bookingId)
          .eq('payment_intent_id', pi.id)
          .neq('payment_status', 'paid')
        break
      }
      case 'charge.refunded': {
        // Refunds issued outside the app (Stripe Dashboard, a dispute) must not
        // leave the booking reading as fully paid.
        const charge = event.data.object as Stripe.Charge
        const bookingId = charge.metadata?.booking_id
        if (!bookingId) break
        await supabase.from('rentivo_bookings').update({
          payment_status: charge.refunded ? 'refunded' : 'partially_refunded',
          refund_amount: (charge.amount_refunded ?? 0) / 100,
        }).eq('id', bookingId)
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
        // Reflect the CURRENT capability state in BOTH directions: if Stripe later
        // disables the account (KYC lapse / capability revoked), revert stripe_onboarded
        // to false so create-payment-intent stops routing payouts to a dead account.
        const onboarded = !!(account.charges_enabled && account.payouts_enabled)
        await supabase.from('rentivo_operators')
          .update({ stripe_onboarded: onboarded }).eq('stripe_account_id', account.id)
        await supabase.from('rentivo_hosts')
          .update({ stripe_onboarded: onboarded }).eq('stripe_account_id', account.id)
        break
      }
    }

    // Recorded only on success, so a handler that threw is retried by Stripe
    // rather than marked done. ignoreDuplicates keeps two concurrent deliveries
    // of the same event from colliding on the primary key.
    await supabase.from('rentivo_stripe_events')
      .upsert({ id: event.id, type: event.type }, { onConflict: 'id', ignoreDuplicates: true })

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    // 500 makes Stripe retry, which is what we want — but the old bare catch
    // told nobody WHY, so a stuck booking had no trail at all.
    console.error('[stripe-webhook] handler error', event.type, event.id, error)
    return new Response('Handler error', { status: 500 })
  }
})
