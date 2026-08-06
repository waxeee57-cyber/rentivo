import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// ── Authoritative price derivation — MIRRORS lib/utils/bookingPricing.ts.
//    Keep INSURANCE_PRICES in sync with types/index.ts INSURANCE_PACKAGES.
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
    const body = await req.json()
    const {
      listing_id, start_date, end_date,
      rental_type = 'daily', total_hours = null, insurance_id = 'basic', promo_code = null,
      // non-financial pass-through (validated as strings, never money)
      guest_name = null, guest_email = null, guest_phone = null,
      guest_nationality = null, driver_license_no = null,
      pickup_time = null, return_time = null, pickup_location = null,
      notes = null, flight_number = null,
    } = body ?? {}

    if (!listing_id || typeof listing_id !== 'string') return jsonError('Missing listing_id', 400)
    if (!start_date || !end_date || typeof start_date !== 'string' || typeof end_date !== 'string') {
      return jsonError('Missing start_date or end_date', 400)
    }
    const rentalType = rental_type === 'hourly' ? 'hourly' : 'daily'
    const insuranceId = typeof insurance_id === 'string' && insurance_id in INSURANCE_PRICES ? insurance_id : 'basic'

    // ── Load the listing (pricing + ownership are SERVER truth, never the body).
    const { data: listing, error: listingError } = await supabase
      .from('rentivo_listings')
      .select('id, operator_id, host_id, owner_user_id, available, price_per_day, price_per_week, price_per_hour, deposit_amount, hourly_rental_enabled, min_rental_days, min_rental_hours')
      .eq('id', listing_id)
      .maybeSingle()
    if (listingError) return jsonError('Failed to load listing', 500)
    if (!listing) return jsonError('Listing not found', 404)
    if (listing.available === false) return jsonError('Listing is not available', 409)

    // ── Identity gate, enforced HERE.
    //
    // The only check was `app/(consumer)/booking/[listingId].tsx`, which decides
    // whether to render a lock screen. That is a decision inside a bundle the
    // renter is holding: calling this function directly skipped it entirely, and
    // an operator who requires KYC got unverified renters at the counter with a
    // confirmed, paid booking. Verified by calling create-booking with zero
    // verification rows against an operator with requires_identity_verification
    // set: HTTP 200.
    let requiresIdentity = false
    if (listing.operator_id) {
      const { data: owner } = await supabase
        .from('rentivo_operators')
        .select('requires_identity_verification')
        .eq('id', listing.operator_id)
        .maybeSingle()
      requiresIdentity = owner?.requires_identity_verification === true
    }
    if (requiresIdentity) {
      const { data: verification } = await supabase
        .from('rentivo_identity_verifications')
        .select('status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (verification?.status !== 'approved') {
        return jsonError('Identity verification required before booking', 403)
      }
    }

    // ── Dates + day count (server-derived; client cannot pass total_days).
    const MS_PER_DAY = 86400000
    const startMs = new Date(start_date).getTime()
    const endMs = new Date(end_date).getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      return jsonError('Invalid date range', 400)
    }
    const days = Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY))

    // ── Reject past dates. The client's "This weekend" quick-select resolves to
    //    yesterday when tapped on a Sunday, and nothing downstream caught it —
    //    past-dated bookings were accepted and charged.
    const todayUtcMs = Date.parse(new Date().toISOString().slice(0, 10))
    if (startMs < todayUtcMs) return jsonError('Start date cannot be in the past', 400)

    // ── Minimum rental length (operators configure it; nothing enforced it).
    const minDays = Number(listing.min_rental_days ?? 1)
    if (rentalType !== 'hourly' && Number.isFinite(minDays) && minDays > 1 && days < minDays) {
      return jsonError(`This vehicle requires a minimum rental of ${minDays} days`, 400)
    }
    const minHours = Number(listing.min_rental_hours ?? 0)
    if (rentalType === 'hourly' && Number.isFinite(minHours) && minHours > 0
        && numOr0(total_hours) < minHours) {
      return jsonError(`This vehicle requires a minimum rental of ${minHours} hours`, 400)
    }

    // ── Availability blocks. Ranged blocks carry end_date; manual single-day
    //    blocks leave it NULL (migration 046). The old single query used
    //    `.gte('end_date', start_date)`, and `NULL >= x` is NULL — so every
    //    single-day block was silently filtered out and never enforced.
    //    Ranges are half-open [start, end): a rental ending on the 12th frees
    //    the 12th, matching the day-count math above.
    const [ranged, singles] = await Promise.all([
      supabase.from('rentivo_availability').select('id')
        .eq('listing_id', listing_id)
        .not('end_date', 'is', null)
        .lt('blocked_date', end_date)
        .gt('end_date', start_date)
        .limit(1),
      supabase.from('rentivo_availability').select('id')
        .eq('listing_id', listing_id)
        .is('end_date', null)
        .gte('blocked_date', start_date)
        .lt('blocked_date', end_date)
        .limit(1),
    ])
    if ((ranged.data?.length ?? 0) > 0 || (singles.data?.length ?? 0) > 0) {
      return jsonError('Selected dates are not available', 409)
    }

    // ── Double-booking guard. Nothing in the codebase checked whether another
    //    renter already paid for this vehicle on these dates, so every confirmed
    //    booking stayed sellable forever. Unpaid `pending` rows are abandoned
    //    carts and deliberately do NOT hold inventory.
    const { data: clash } = await supabase
      .from('rentivo_bookings')
      .select('id')
      .eq('listing_id', listing_id)
      .neq('status', 'cancelled')
      .in('payment_status', ['paid', 'processing'])
      .lt('start_date', end_date)
      .gt('end_date', start_date)
      .limit(1)
    if (clash && clash.length > 0) {
      return jsonError('These dates are no longer available', 409)
    }

    // ── Hourly: must have the data to price it; never silently fall back.
    let perHour: number | null = listing.price_per_hour != null ? numOr0(listing.price_per_hour) : null
    if (rentalType === 'hourly') {
      if (listing.hourly_rental_enabled !== true || !perHour || perHour <= 0 || !(numOr0(total_hours) >= 1)) {
        return jsonError('Hourly rental is not available for this listing or total_hours is invalid', 400)
      }
    }

    // ── Pricing inputs from the LISTING.
    const platformCut = parseFloat(Deno.env.get('PLATFORM_CUT') ?? '0.10')
    const perDay = numOr0(listing.price_per_day)
    const perWeek = listing.price_per_week != null ? numOr0(listing.price_per_week) : null
    const insurancePrice = INSURANCE_PRICES[insuranceId] ?? 0
    const insurance = round2(insurancePrice * days)

    let subtotal: number
    let platformFee: number
    if (rentalType === 'hourly') {
      subtotal = round2((perHour ?? 0) * Math.max(1, Math.floor(numOr0(total_hours))))
      platformFee = 0
    } else if (perWeek && perWeek > 0 && days >= 7) {
      subtotal = round2(Math.floor(days / 7) * perWeek + (days % 7) * perDay)
      platformFee = Math.round(subtotal * platformCut)
    } else {
      subtotal = round2(days * perDay)
      platformFee = Math.round(subtotal * platformCut)
    }
    const baseTotal = round2(subtotal + platformFee + insurance)

    // ── Promo: re-validate SERVER-side against the server base (never trust client).
    let promoDiscount = 0
    let appliedPromoCode: string | null = null
    if (promo_code && typeof promo_code === 'string') {
      const { data: promo } = await supabase
        .from('rentivo_promo_codes')
        .select('code, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, min_booking_value, is_active')
        .eq('code', promo_code.toUpperCase().trim())
        .maybeSingle()
      if (
        promo &&
        // A code the admin switched off must stop discounting. `is_active` was
        // added in migration 20260805004; nothing read it before, so
        // deactivating a code had no effect on pricing.
        promo.is_active !== false &&
        Number(promo.current_uses) < Number(promo.max_uses) &&
        // valid_from exists on the table and was never checked — a campaign
        // scheduled for next month was live the moment the row was inserted.
        (!promo.valid_from || new Date(promo.valid_from) <= new Date()) &&
        (!promo.valid_until || new Date(promo.valid_until) >= new Date()) &&
        baseTotal >= numOr0(promo.min_booking_value)
      ) {
        promoDiscount = promo.discount_type === 'percent'
          ? round2((baseTotal * numOr0(promo.discount_value)) / 100)
          : Math.min(numOr0(promo.discount_value), baseTotal)
        appliedPromoCode = promo.code
      }
    }

    const totalAmount = Math.max(0, round2(baseTotal - promoDiscount))
    const depositAmount = insurancePrice > 0 ? 0 : numOr0(listing.deposit_amount)

    // ── Idempotency: reuse an existing unpaid pending booking for the same
    //    (user, listing, dates) instead of creating duplicates.
    const { data: existing } = await supabase
      .from('rentivo_bookings')
      .select('id, payment_status')
      .eq('user_id', user.id)
      .eq('listing_id', listing_id)
      .eq('start_date', start_date)
      .eq('end_date', end_date)
      .in('payment_status', ['pending'])
      // A CANCELLED booking is not an abandoned cart to resume. Without this the
      // reuse path handed back the cancelled row — status still 'cancelled', and
      // carrying its stale deposit_setup_intent_id, deposit_status and
      // deposit_charge_attempts — so re-booking the same dates produced a
      // booking that could never be paid or deposited against.
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      await supabase.from('rentivo_bookings').update({
        total_days: days,
        rental_type: rentalType,
        total_hours: rentalType === 'hourly' ? Math.max(1, Math.floor(numOr0(total_hours))) : null,
        price_per_day: perDay, subtotal, platform_fee: platformFee,
        total_amount: totalAmount, deposit_amount: depositAmount,
        promo_code: appliedPromoCode, promo_discount: promoDiscount,
        guest_name, guest_email, guest_phone, guest_nationality, driver_license_no,
        pickup_time, return_time, pickup_location, notes, flight_number,
      }).eq('id', existing.id)
      return new Response(JSON.stringify({ booking_id: existing.id, reused: true, total_amount: totalAmount, deposit_amount: depositAmount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Insert with SERVER-derived financials (service_role bypasses the column
    //    grants; the renter never writes a money column).
    const { data: inserted, error: insertError } = await supabase
      .from('rentivo_bookings')
      .insert({
        listing_id,
        operator_id: listing.operator_id ?? null,
        user_id: user.id,
        guest_name, guest_email, guest_phone, guest_nationality, driver_license_no,
        start_date, end_date, total_days: days,
        rental_type: rentalType,
        total_hours: rentalType === 'hourly' ? Math.max(1, Math.floor(numOr0(total_hours))) : null,
        pickup_time, return_time, pickup_location,
        price_per_day: perDay,
        subtotal,
        platform_fee: platformFee,
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        currency: 'EUR',
        status: 'pending',
        payment_status: 'pending',
        payment_intent_id: null,
        paid_at: null,
        notes, flight_number,
        promo_code: appliedPromoCode,
        promo_discount: promoDiscount,
        pickup_damage_done: false,
        return_damage_done: false,
        has_damage_claim: false,
        // Record which regime this booking was taken under, so a later change to
        // the operator's KYC setting cannot rewrite the history of what was
        // required at the time.
        requires_identity_verification: requiresIdentity,
        identity_verified: requiresIdentity,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      // The exclusion constraint (migration 20260804001) is the last line of
      // defence against a double sale that slipped past the checks above.
      if (insertError?.message?.includes('rentivo_bookings_no_overlap')) {
        return jsonError('These dates are no longer available', 409)
      }
      return jsonError(insertError?.message ?? 'Failed to create booking', 500)
    }

    // ── Redeem the promo. Nothing incremented current_uses before this, so
    //    max_uses was decorative. If redemption fails (exhausted between our
    //    read and now), strip the discount from the booking rather than honour
    //    a code the campaign no longer has budget for.
    if (appliedPromoCode) {
      const { data: redeemed } = await supabase.rpc('increment_promo_use', { p_code: appliedPromoCode })
      if (redeemed === false) {
        promoDiscount = 0
        appliedPromoCode = null
        const repricedTotal = Math.max(0, round2(baseTotal))
        await supabase.from('rentivo_bookings')
          .update({ promo_code: null, promo_discount: 0, total_amount: repricedTotal })
          .eq('id', inserted.id)
        return new Response(
          JSON.stringify({
            booking_id: inserted.id,
            total_amount: repricedTotal,
            deposit_amount: depositAmount,
            subtotal, platform_fee: platformFee, promo_discount: 0,
            promo_rejected: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({
        booking_id: inserted.id,
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        subtotal, platform_fee: platformFee, promo_discount: promoDiscount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
})
