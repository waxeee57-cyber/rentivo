import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function parseICalDate(value: string): string {
  // Handles YYYYMMDD and YYYYMMDDTHHMMSSZ formats
  const clean = value.split('T')[0].replace(/Z$/, '')
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  return clean
}

function parseVEvents(icalText: string): Array<{ start: string; end: string }> {
  const events: Array<{ start: string; end: string }> = []
  const lines = icalText.replace(/\r\n/g, '\n').split('\n')
  let inEvent = false
  let startDate = ''
  let endDate = ''

  for (const line of lines) {
    if (line.trim() === 'BEGIN:VEVENT') {
      inEvent = true
      startDate = ''
      endDate = ''
    } else if (line.trim() === 'END:VEVENT') {
      if (inEvent && startDate && endDate) {
        events.push({ start: startDate, end: endDate })
      }
      inEvent = false
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) {
        const value = line.split(':').slice(1).join(':').trim()
        startDate = parseICalDate(value)
      } else if (line.startsWith('DTEND')) {
        const value = line.split(':').slice(1).join(':').trim()
        endDate = parseICalDate(value)
      }
    }
  }
  return events
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { listing_id, ical_url } = await req.json()
    if (!listing_id || !ical_url) {
      return new Response(JSON.stringify({ error: 'Missing listing_id or ical_url' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const icalResponse = await fetch(ical_url, {
      headers: { 'User-Agent': 'Rentivo-iCal-Importer/1.0' },
    })
    if (!icalResponse.ok) {
      throw new Error(`Failed to fetch iCal: ${icalResponse.status}`)
    }
    const icalText = await icalResponse.text()
    const events = parseVEvents(icalText)

    // Delete existing ical_sync blocks for this listing
    await supabase
      .from('rentivo_availability')
      .delete()
      .eq('listing_id', listing_id)
      .eq('reason', 'ical_sync')

    // Upsert new blocked dates
    if (events.length > 0) {
      const rows = events.map((e) => ({
        listing_id,
        blocked_date: e.start,
        end_date: e.end,
        reason: 'ical_sync',
      }))
      await supabase.from('rentivo_availability').insert(rows)
    }

    return new Response(JSON.stringify({ count: events.length, synced: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
