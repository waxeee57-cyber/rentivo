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

  // PII REMOVED: guest_name is intentionally NOT selected or exported. An external
  // calendar only needs the blocked date ranges; SUMMARY is a constant 'Unavailable'.
  // This closes the guest-PII leak even if the feed URL is shared with a third party.
  const { data: bookings, error } = await supabase
    .from('rentivo_bookings')
    .select('id, start_date, end_date')
    .eq('listing_id', listingId)
    .in('status', ['confirmed', 'active', 'completed'])

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
