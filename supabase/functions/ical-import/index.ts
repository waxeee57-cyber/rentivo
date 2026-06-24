import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_ICAL_BYTES = 2 * 1024 * 1024 // 2 MB
const MAX_EVENTS = 2000
const FETCH_TIMEOUT_MS = 10000

// ── SSRF guard ──────────────────────────────────────────────────────────────
// Only allow public http(s) hosts; block loopback / RFC1918 / link-local /
// cloud-metadata / CGNAT so an authenticated caller cannot make the edge runtime
// probe internal services or 169.254.169.254.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return true
  if (h === '0.0.0.0' || h === '::1' || h === '::') return true
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = Number(m[1]); const b = Number(m[2])
    if (a === 127) return true                        // loopback
    if (a === 10) return true                          // private
    if (a === 192 && b === 168) return true            // private
    if (a === 172 && b >= 16 && b <= 31) return true   // private
    if (a === 169 && b === 254) return true            // link-local + cloud metadata
    if (a === 0) return true
    if (a === 100 && b >= 64 && b <= 127) return true  // CGNAT
  }
  // IPv6 unique-local / link-local
  if (/^(fc|fd|fe8|fe9|fea|feb)/.test(h)) return true
  return false
}

function validateIcalUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (isBlockedHost(url.hostname)) return null
  if (url.port && !['', '80', '443', '8080'].includes(url.port)) return null
  return url
}

// Fetch with manual redirect handling: each hop is re-validated through the SSRF
// guard so a public URL cannot 30x-redirect into an internal address. Max 2 hops.
async function safeFetchIcal(first: URL): Promise<Response> {
  let current = first
  for (let hop = 0; hop < 3; hop++) {
    const resp = await fetch(current.toString(), {
      headers: { 'User-Agent': 'Rentivo-iCal-Importer/1.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location')
      const next = loc ? validateIcalUrl(new URL(loc, current).toString()) : null
      if (!next) throw new Error('iCal URL redirected to a disallowed location')
      current = next
      continue
    }
    return resp
  }
  throw new Error('Too many redirects')
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
    (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? ''
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
    if (!listing_id || typeof listing_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid listing_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── SSRF guard: validate the external URL BEFORE any fetch.
    const safeUrl = validateIcalUrl(ical_url)
    if (!safeUrl) {
      return new Response(JSON.stringify({ error: 'Invalid or disallowed ical_url' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Tenant isolation: the caller must OWN the target listing. The client below
    //    uses the service role (bypasses RLS), so ownership MUST be checked here or
    //    any authenticated user could overwrite another operator's availability.
    const { data: listing, error: listingErr } = await supabase
      .from('rentivo_listings')
      .select('id, owner_user_id, operator_id, host_id')
      .eq('id', listing_id)
      .maybeSingle()
    if (listingErr) {
      return new Response(JSON.stringify({ error: 'Failed to load listing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!listing) {
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let owns = listing.owner_user_id === user.id
    if (!owns && listing.operator_id) {
      const { data: op } = await supabase
        .from('rentivo_operators').select('id')
        .eq('id', listing.operator_id).eq('auth_id', user.id).maybeSingle()
      owns = !!op
    }
    if (!owns && listing.host_id) {
      const { data: ht } = await supabase
        .from('rentivo_hosts').select('id')
        .eq('id', listing.host_id).eq('auth_id', user.id).maybeSingle()
      owns = !!ht
    }
    if (!owns) {
      return new Response(JSON.stringify({ error: 'You do not own this listing' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch (manual redirect re-validation) + size cap.
    const icalResponse = await safeFetchIcal(safeUrl)
    if (!icalResponse.ok) {
      throw new Error(`Failed to fetch iCal: ${icalResponse.status}`)
    }
    const buf = await icalResponse.arrayBuffer()
    if (buf.byteLength > MAX_ICAL_BYTES) {
      throw new Error('iCal file too large')
    }
    const icalText = new TextDecoder().decode(buf)
    let events = parseVEvents(icalText)
    if (events.length > MAX_EVENTS) events = events.slice(0, MAX_EVENTS)

    // Delete existing ical_sync blocks for this (owned) listing
    await supabase
      .from('rentivo_availability')
      .delete()
      .eq('listing_id', listing_id)
      .eq('reason', 'ical_sync')

    // Upsert new blocked date ranges — ON CONFLICT DO UPDATE handles overlap with manual blocks
    if (events.length > 0) {
      const rows = events.map((e) => ({
        listing_id,
        blocked_date: e.start,
        end_date: e.end,
        reason: 'ical_sync',
      }))
      await supabase
        .from('rentivo_availability')
        .upsert(rows, { onConflict: 'listing_id,blocked_date', ignoreDuplicates: false })
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
