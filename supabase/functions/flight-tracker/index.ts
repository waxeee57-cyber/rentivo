// ═══════════════════════════════════════════════════════════════════════════
// flight-tracker: real flight status, or an honest "unknown".
//
// Two things were wrong here.
//
// 1. It fabricated data. With no AviationStack integration wired up it wrote a
//    hardcoded `flight_status='on_time'` and an arrival time of "now + 2 hours"
//    straight onto the booking. The operator booking screen renders that as a
//    green "On time" badge with a precise arrival, so the app was inventing a
//    fact about a real flight and showing it as verified. An operator who plans
//    a handover around an invented arrival time misses the guest.
//
// 2. It had no auth at all. There was no Authorization header check and no
//    ownership check, so any unauthenticated caller who could guess a booking id
//    could overwrite flight_status and flight_arrival_time on someone else's
//    booking.
//
// Now: the caller must be authenticated and be a party to the booking, and the
// function only ever writes flight data it actually received from the upstream
// API. With no API key configured it returns status 'unknown' and writes
// nothing, which leaves flight_status NULL and lets the booking screen fall back
// to its neutral "tracking" badge.
// ═══════════════════════════════════════════════════════════════════════════
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

interface AviationStackFlight {
  flight_status?: string | null
  arrival?: {
    scheduled?: string | null
    estimated?: string | null
    actual?: string | null
    delay?: number | null
  } | null
}

/** What we are willing to write to the booking. 'unknown' is never written. */
type FlightStatus = 'on_time' | 'delayed' | 'cancelled' | 'landed'

/**
 * Ask AviationStack about one flight. Returns null when the upstream call fails
 * or knows nothing, so the caller can report 'unknown' instead of guessing.
 * A delay of 15 minutes or less is not worth alarming an operator over, which
 * matches how the booking screen colours the badge.
 */
async function fetchFlight(
  apiKey: string,
  flightNumber: string,
): Promise<{ status: FlightStatus; arrival: string | null } | null> {
  const url = `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(apiKey)}&flight_iata=${encodeURIComponent(flightNumber)}&limit=1`

  let payload: { data?: AviationStackFlight[] }
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!resp.ok) {
      console.error('[flight-tracker] upstream returned', resp.status)
      return null
    }
    payload = await resp.json()
  } catch (err) {
    console.error('[flight-tracker] upstream call failed', err)
    return null
  }

  const flight = payload.data?.[0]
  if (!flight) return null

  const arrival = flight.arrival?.actual ?? flight.arrival?.estimated ?? flight.arrival?.scheduled ?? null
  const delayMinutes = Number(flight.arrival?.delay ?? 0)

  let status: FlightStatus
  if (flight.flight_status === 'cancelled') status = 'cancelled'
  else if (flight.flight_status === 'landed') status = 'landed'
  else if (Number.isFinite(delayMinutes) && delayMinutes > 15) status = 'delayed'
  else status = 'on_time'

  return { status, arrival }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── Auth, mirroring cancel-booking: bearer token in, real user out, 401 if not.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '',
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  try {
    const { booking_id, flight_number } = await req.json().catch(() => ({})) as {
      booking_id?: string
      flight_number?: string
    }
    if (!booking_id || typeof booking_id !== 'string') {
      return json({ error: 'Missing booking_id' }, 400)
    }

    const { data: booking } = await supabase
      .from('rentivo_bookings')
      .select('id, user_id, listing_id, flight_number')
      .eq('id', booking_id)
      .maybeSingle()
    if (!booking) return json({ error: 'Booking not found' }, 404)

    // ── Party check: the traveler who booked it, or whoever owns the listing.
    // Without this, an authenticated stranger could still overwrite the flight
    // fields on any booking whose id they knew. Owner identity lives on
    // rentivo_operators.auth_id / rentivo_hosts.auth_id.
    let authorised = booking.user_id === user.id
    if (!authorised) {
      const { data: listing } = await supabase
        .from('rentivo_listings')
        .select('owner_user_id, operator_id, host_id')
        .eq('id', booking.listing_id)
        .maybeSingle()

      if (listing?.owner_user_id && listing.owner_user_id === user.id) {
        authorised = true
      } else if (listing?.operator_id) {
        const { data: o } = await supabase
          .from('rentivo_operators').select('auth_id').eq('id', listing.operator_id).maybeSingle()
        authorised = o?.auth_id === user.id
      }
      if (!authorised && listing?.host_id) {
        const { data: h } = await supabase
          .from('rentivo_hosts').select('auth_id').eq('id', listing.host_id).maybeSingle()
        authorised = h?.auth_id === user.id
      }
    }
    if (!authorised) return json({ error: 'Not allowed to track this booking' }, 403)

    // Trust the booking's own flight number over anything in the request body,
    // and fall back to the body only when the booking has none recorded.
    const flightNumber = (booking.flight_number ?? flight_number ?? '').trim()
    if (!flightNumber) return json({ error: 'No flight number on this booking' }, 400)

    // ── No API key means no knowledge. Report that and write nothing: the old
    // code wrote 'on_time' plus a made-up arrival time here, which the booking
    // screen then showed as a confirmed green badge.
    const apiKey = Deno.env.get('AVIATIONSTACK_API_KEY')
    if (!apiKey) {
      return json({
        success: false,
        tracked: false,
        status: 'unknown',
        arrival: null,
        reason: 'flight_tracking_not_configured',
      })
    }

    const result = await fetchFlight(apiKey, flightNumber)
    // Upstream failure or an unrecognised flight is also "unknown", not "on time".
    if (!result) {
      return json({
        success: false,
        tracked: false,
        status: 'unknown',
        arrival: null,
        reason: 'flight_not_found',
      })
    }

    // Only real values reach the booking. flight_arrival_time stays untouched
    // when the upstream response carried no arrival timestamp.
    const update: Record<string, string> = { flight_status: result.status }
    if (result.arrival) update.flight_arrival_time = result.arrival

    const { error: updateError } = await supabase
      .from('rentivo_bookings')
      .update(update)
      .eq('id', booking_id)

    if (updateError) {
      console.error('[flight-tracker] booking update failed', booking_id, updateError)
      return json({ error: 'Failed to save flight status' }, 500)
    }

    return json({ success: true, tracked: true, status: result.status, arrival: result.arrival })
  } catch (err) {
    console.error('[flight-tracker] unhandled error', err)
    return json({ error: 'Internal error' }, 500)
  }
})
