import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Calendar-injection guard: strip every char outside a safe token set. This removes
// CR/LF and the RFC 5545 specials (';' ',' '\') so no interpolated value can break
// out of its line. (The only dynamic values left are a booking UUID and dates.)
function icalSafe(v: string): string {
  return String(v ?? '').replace(/[^0-9A-Za-z@._-]/g, '')
}
// How much history the feed keeps. Calendar clients only care about what is still
// blocking; anything that ended before this is noise that grows forever.
const ICAL_HISTORY_DAYS = 30
// See the select below: a backstop, not the bound.
const ICAL_MAX_EVENTS = 2000

// Dates -> digits only (YYYYMMDD).
function icalDate(v: string): string {
  return String(v ?? '').replace(/[^0-9]/g, '').slice(0, 8)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const listingId = url.searchParams.get('listing_id')
  if (!listingId) {
    return new Response('Missing listing_id', { status: 400, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? ''
  )

  // ── Feed token.
  //
  // This function had NO authorization of any kind and queries with the service
  // role, while listing ids are public. Anyone could read the booking calendar
  // of any vehicle on the platform: when it is out, and therefore when it (and
  // often its owner's property) is not. A subscribing calendar app cannot send
  // an Authorization header, so the capability lives in the URL, per listing,
  // and is rotatable server-side.
  const token = url.searchParams.get('token')
  const { data: listingRow, error: listingError } = await supabase
    .from('rentivo_listings')
    .select('ical_feed_token')
    .eq('id', listingId)
    .maybeSingle()

  if (listingError) {
    console.error('[ical-export] listing lookup failed', listingId, listingError)
    return new Response('Unavailable', { status: 500, headers: corsHeaders })
  }
  // 404 rather than 403 on a bad token: a 403 confirms the listing exists, which
  // is exactly the enumeration signal the token is here to remove.
  if (!listingRow || !token || token !== listingRow.ical_feed_token) {
    return new Response('Not found', { status: 404, headers: corsHeaders })
  }

  // PII REMOVED: guest_name is intentionally NOT selected or exported. An external
  // calendar only needs the blocked date ranges; SUMMARY is a constant 'Unavailable'.
  // This closes the guest-PII leak even if the feed URL is shared with a third party.
  //
  // Bounded by DATE WINDOW, not by row count: an .ics feed has to carry the whole
  // forward calendar, so truncating to "the first N bookings" would silently hide
  // real unavailability from whatever calendar app subscribed — the one failure mode
  // this feed must not have. Nobody syncs history, so everything that ended more than
  // 30 days ago is dropped instead; that turns "every booking ever" into a window
  // whose size is set by how far ahead the operator takes reservations.
  const horizon = new Date()
  horizon.setDate(horizon.getDate() - ICAL_HISTORY_DAYS)

  const { data: bookings, error } = await supabase
    .from('rentivo_bookings')
    .select('id, start_date, end_date')
    .eq('listing_id', listingId)
    .in('status', ['confirmed', 'active', 'completed'])
    .gte('end_date', horizon.toISOString().split('T')[0])
    .order('start_date', { ascending: true })
    // Backstop only — the date window above is the real bound. Sorted soonest-first
    // so that if a listing ever did exceed this, the events dropped are the most
    // distant ones rather than an arbitrary slice.
    .limit(ICAL_MAX_EVENTS)

  if (error) {
    return new Response('DB error', { status: 500, headers: corsHeaders })
  }

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const vevents = (bookings ?? []).map((b) => {
    const uid = `booking-${icalSafe(String(b.id))}@rentivo.domrol.com`
    const dtstart = icalDate(b.start_date)
    const dtend = icalDate(b.end_date)
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      'SUMMARY:Unavailable',
      `DTSTAMP:${now}`,
      'END:VEVENT',
    ].join('\r\n')
  }).join('\r\n')

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rentivo//DomRol//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vevents,
    'END:VCALENDAR',
  ].join('\r\n')

  const safeName = icalSafe(String(listingId))

  return new Response(ical, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="rentivo-${safeName}.ics"`,
    },
  })
})
