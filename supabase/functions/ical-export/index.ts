import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: bookings, error } = await supabase
    .from('rentivo_bookings')
    .select('id, start_date, end_date, guest_name, status')
    .eq('listing_id', listingId)
    .in('status', ['confirmed', 'active', 'completed'])

  if (error) {
    return new Response('DB error', { status: 500, headers: corsHeaders })
  }

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const vevents = (bookings ?? []).map((b) => {
    const uid = `booking-${b.id}@rentivo.domrol.com`
    const dtstart = b.start_date.replace(/-/g, '')
    const dtend = b.end_date.replace(/-/g, '')
    const summary = b.guest_name ? `Booking: ${b.guest_name}` : 'Rentivo Booking'
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `SUMMARY:${summary}`,
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

  return new Response(ical, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="rentivo-${listingId}.ics"`,
    },
  })
})
