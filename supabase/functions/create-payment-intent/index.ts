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

// ── Authoritative price model — MIRRORS lib/utils/bookingPricing.ts and the
//    create-booking edge function (keep INSURANCE_PRICES in sync with
//    types/index.ts INSURANCE_PACKAGES). Insurance is the ONLY booking input not
//    persisted as its own column, so we reconstruct the total for each tier and
//    accept the persisted total ONLY if it matches one of them to the cent.
const INSURANCE_PRICES: Record<string, number> = { basic: 0, standard: 9.99, premium: 19.99 }
const round2 = (n: number) => Math.round(n * 100) / 100
const numOr0 = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

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
    // CONTRACT: the client sends ONLY booking_id. The charge amount, currency, and
    // destination Connect account are all derived server-side — a tampered client
    // can neither dictate the amount nor redirect the payout.
    const { booking_id } = await req.json()
    if (!booking_id || typeof booking_id !== 'string') {
      return jsonError('Missing booking_id', 400)
    }

    // ── Load the booking with the service-role client (bypasses RLS). The money
    //    columns are loaded ONLY to cross-check against the server reconstruction,
    //    never to source the charge.
    const { data: booking, error: bookingError } = await supabase
      .from('rentivo_bookings')
      .select('id, user_id, listing_id, start_date, end_date, total_amount, status, payment_status, payment_intent_id, promo_code, rental_type, total_hours')
      .eq('id', booking_id)
      .maybeSingle()

    if (bookingError) return jsonError('Failed to load booking', 500)
    if (!booking) return jsonError('Booking not found', 404)

    // Ownership: the caller must be the traveler who owns this booking.
    if (booking.user_id !== user.id) return jsonError('Booking does not belong to caller', 403)

    // Idempotency: if this booking already has a PaymentIntent, return its
    // client_secret instead of creating a second intent (double-charge guard).
    if (booking.payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(booking.payment_intent_id)
      return new Response(
        JSON.stringify({ client_secret: existing.client_secret, payment_intent_id: existing.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // State guard: only an unpaid booking may open a fresh intent.
    if (booking.status === 'cancelled') return jsonError('Booking is cancelled', 409)
    if (booking.payment_status === 'captured' || booking.payment_status === 'paid') {
      return jsonError('Booking is already paid', 409)
    }

    // ── Pricing inputs + destination: from the LISTING, never the body/booking row.
    const { data: listing, error: listingError } = await supabase
      .from('rentivo_listings')
      .select(
        'id, title, owner_type, price_per_day, price_per_week, price_per_hour, deposit_amount, hourly_rental_enabled, operator:rentivo_operators(stripe_account_id, stripe_onboarded), host:rentivo_hosts(stripe_account_id, stripe_onboarded)'
      )
      .eq('id', booking.listing_id)
      .maybeSingle()

    if (listingError) return jsonError('Failed to load listing', 500)
    if (!listing) return jsonError('Listing not found', 404)

    // ── SERVER-AUTHORITATIVE AMOUNT (the fix). Recompute the rental price from the
    //    LISTING + the booking's dates / rental_type / total_hours, exactly as
    //    create-booking does, re-validate the promo, and accept the persisted
    //    total_amount ONLY if it equals a reconstructed tier total to the cent.
    //    The charge is ALWAYS the server-derived value — never booking.total_amount.
    const platformCut = parseFloat(Deno.env.get('PLATFORM_CUT') ?? '0.10')
    const MS_PER_DAY = 86400000
    const startMs = new Date(booking.start_date).getTime()
    const endMs = new Date(booking.end_date).getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      return jsonError('Invalid booking date range', 400)
    }
    const days = Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY))
    const rentalType = booking.rental_type === 'hourly' ? 'hourly' : 'daily'

    const perDay = numOr0(listing.price_per_day)
    const perWeek = listing.price_per_week != null ? numOr0(listing.price_per_week) : null
    const perHour = listing.price_per_hour != null ? numOr0(listing.price_per_hour) : null

    let serverSubtotal: number
    let serverFee: number
    if (rentalType === 'hourly') {
      if (listing.hourly_rental_enabled !== true || !perHour || perHour <= 0 || numOr0(booking.total_hours) < 1) {
        return jsonError('Hourly rental is not available for this listing or total_hours is invalid', 400)
      }
      serverSubtotal = round2(perHour * Math.max(1, Math.floor(numOr0(booking.total_hours))))
      serverFee = 0
    } else if (perWeek && perWeek > 0 && days >= 7) {
      serverSubtotal = round2(Math.floor(days / 7) * perWeek + (days % 7) * perDay)
      serverFee = Math.round(serverSubtotal * platformCut)
    } else {
      serverSubtotal = round2(days * perDay)
      serverFee = Math.round(serverSubtotal * platformCut)
    }

    // Re-validate the promo SERVER-side; never trust the client-written promo_discount.
    let promo: { discount_type: string; discount_value: number; min_booking_value: number } | null = null
    if (booking.promo_code) {
      const { data: p } = await supabase
        .from('rentivo_promo_codes')
        .select('discount_type, discount_value, max_uses, current_uses, valid_until, min_booking_value')
        .eq('code', String(booking.promo_code).toUpperCase().trim())
        .maybeSingle()
      if (
        p &&
        Number(p.current_uses) < Number(p.max_uses) &&
        (!p.valid_until || new Date(p.valid_until) >= new Date())
      ) {
        promo = {
          discount_type: String(p.discount_type),
          discount_value: numOr0(p.discount_value),
          min_booking_value: numOr0(p.min_booking_value),
        }
      }
    }

    // Reconstruct the authoritative total for each insurance tier and accept the
    // persisted total only if it matches one to the cent (TOLERANCE = rounding).
    const clientTotal = round2(numOr0(booking.total_amount))
    const TOLERANCE_EUR = 0.01
    let authoritativeTotal: number | null = null
    let matchedInsurance = 0
    let matchedDiscount = 0
    for (const tier of Object.keys(INSURANCE_PRICES)) {
      const insurance = round2(INSURANCE_PRICES[tier] * days)
      const baseTotal = round2(serverSubtotal + serverFee + insurance)
      let discount = 0
      if (promo && baseTotal >= promo.min_booking_value) {
        discount = promo.discount_type === 'percent'
          ? round2((baseTotal * promo.discount_value) / 100)
          : Math.min(promo.discount_value, baseTotal)
      }
      const candidate = Math.max(0, round2(baseTotal - discount))
      if (Math.abs(candidate - clientTotal) <= TOLERANCE_EUR) {
        authoritativeTotal = candidate
        matchedInsurance = insurance
        matchedDiscount = discount
        break
      }
    }

    // Defense-in-depth: a persisted total that matches no server-derived tier is
    // tampered or stale — reject cleanly, never silently charge a mismatch.
    if (authoritativeTotal === null) {
      return jsonError(
        `Booking amount (${clientTotal.toFixed(2)}) does not match the server-derived rental price. Please re-create the booking.`,
        400
      )
    }

    // The charge is the SERVER-reconstructed value (not booking.total_amount).
    const amountCents = Math.round(authoritativeTotal * 100)
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return jsonError('Invalid booking amount', 400)
    }

    // ── Destination account: derived from the listing owner, never the body.
    const owner = (listing.owner_type === 'host'
      ? listing.host
      : listing.operator) as ConnectAccount | null
    const destination = owner?.stripe_account_id ?? null

    if (!owner?.stripe_onboarded || !destination || !destination.startsWith('acct_')) {
      return jsonError('Owner is not set up to receive payments', 400)
    }

    // Connect destination split: the owner is paid their RENTAL price (subtotal);
    // the platform keeps everything else the customer pays on top — the service fee
    // (serverFee), the insurance package, and minus any promo the PLATFORM ran. That
    // residual equals (total − subtotal), which matches the customer-facing breakdown
    // (Subtotal + Service fee + Insurance) and keeps insurance revenue on the platform
    // (it funds the Model B deposit waiver). Charging 10% of the GROSS total instead
    // would transfer ~90% of the service fee + insurance to the owner. Clamp to
    // [0, amountCents] so an oversized fixed promo (total < subtotal) stays valid.
    const subtotalCents = Math.round(serverSubtotal * 100)
    const platformFeeCents = Math.min(amountCents, Math.max(0, amountCents - subtotalCents))
    // Currency is server-fixed (EUR-only platform); never trust booking.currency —
    // a zero-decimal currency (KRW/JPY/VND) would otherwise re-denominate the charge.
    const currency = 'eur'

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

    // ── Heal the booking's financial columns to the SERVER-authoritative values at
    //    payment time (service_role bypasses the BEFORE-UPDATE financial guard). This
    //    persists the exact charged total AND corrects the deposit to the tier the
    //    charge accepted — closing the client-insertable deposit_amount waiver
    //    (basic rental + deposit_amount=0) before create-deposit-setup reads it.
    const expectedDeposit = matchedInsurance > 0 ? 0 : numOr0(listing.deposit_amount)
    await supabase
      .from('rentivo_bookings')
      .update({
        payment_intent_id: paymentIntent.id,
        currency: 'EUR',
        subtotal: serverSubtotal,
        platform_fee: serverFee,
        promo_discount: matchedDiscount,
        total_amount: authoritativeTotal,
        deposit_amount: expectedDeposit,
      })
      .eq('id', booking_id)

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
})
