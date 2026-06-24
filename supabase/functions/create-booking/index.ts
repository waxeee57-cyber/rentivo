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
      .select('id, operator_id, host_id, owner_user_id, available, price_per_day, price_per_week, price_per_hour, deposit_amount, hourly_rental_enabled')
      .eq('id', listing_id)
      .maybeSingle()
    if (listingError) return jsonError('Failed to load listing', 500)
    if (!listing) return jsonError('Listing not found', 404)
    if (listing.available === false) return jsonError('Listing is not available', 409)

    // ── Dates + day count (server-derived; client cannot pass total_days).
    const MS_PER_DAY = 86400000
    const startMs = new Date(start_date).getTime()
    const endMs = new Date(end_date).getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      return jsonError('Invalid date range', 400)
    }
    const days = Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY))

    // ── Availability: reject if the requested range overlaps any block.
    const { data: blocks } = await supabase
      .from('rentivo_availability')
      .select('id')
      .eq('listing_id', listing_id)
      .lte('blocked_date', end_date)
      .gte('end_date', start_date)
      .limit(1)
    if (blocks && blocks.length > 0) return jsonError('Selected dates are not available', 409)

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
        .select('code, discount_type, discount_value, max_uses, current_uses, valid_until, min_booking_value')
        .eq('code', promo_code.toUpperCase().trim())
        .maybeSingle()
      if (
        promo &&
        Number(promo.current_uses) < Number(promo.max_uses) &&
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
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      await supabase.from('rentivo_bookings').update({
        total_days: days, price_per_day: perDay, subtotal, platform_fee: platformFee,
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
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      return jsonError(insertError?.message ?? 'Failed to create booking', 500)
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
