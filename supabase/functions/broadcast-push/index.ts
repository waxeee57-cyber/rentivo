import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send'
const BATCH_SIZE = 100

// Rows pulled per DB round-trip while collecting tokens. This function fans out to
// the ENTIRE user base, so the recipient selects below are PAGED rather than capped:
// a broadcast must reach everyone, but loading the whole table into one response is
// what eventually trips PostgREST's row ceiling / the function's memory limit. Paging
// keeps peak cost to one page of rows regardless of how large the tables grow.
const DB_PAGE_SIZE = 500
// 400 pages = 200 000 recipients per audience. A stop condition that does not depend
// on the server ever returning a short page — a paranoia guard against an infinite loop.
const DB_MAX_PAGES = 400

interface BroadcastPayload {
  title: string
  body: string
  data?: Record<string, string>
  // Segment filters — all optional, omit to target everyone
  segment?: {
    city?: string
    country?: string
    audience?: 'users' | 'operators' | 'all'
    has_booking?: boolean
  }
  // Admin secret required
  secret: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json() as BroadcastPayload

    // Fail-closed: reject if the server secret is unset/empty OR the caller omits it.
    // (Previously `payload.secret !== Deno.env.get(...)` passed when both were undefined.)
    const adminSecret = Deno.env.get('ADMIN_BROADCAST_SECRET') ?? ''
    if (!adminSecret || !payload.secret || payload.secret !== adminSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!
    )

    const audience = payload.segment?.audience ?? 'all'
    const tokens: string[] = []

    if (audience === 'users' || audience === 'all') {
      for (let page = 0; page < DB_MAX_PAGES; page++) {
        const from = page * DB_PAGE_SIZE
        // Consent, not just token presence. A user who withdrew marketing push
        // in privacy settings kept receiving these: withdrawal only nulled the
        // token, and the app wrote the token back on the next launch. Consent is
        // the lawful basis for a marketing broadcast, so it is the filter.
        // An inner join means no consent row = not included.
        const q = supabase
          .from('rentivo_users')
          .select('id, push_token, consent:rentivo_consent!inner(marketing_push)')
          .not('push_token', 'is', null)
          .eq('rentivo_consent.marketing_push', true)
          // Order by the primary key: `.range()` without a deterministic sort can
          // repeat or skip rows between pages, which would double-send or silently
          // drop recipients.
          .order('id', { ascending: true })
          .range(from, from + DB_PAGE_SIZE - 1)
        // `city` and `country` are NOT columns on rentivo_users (they are on
        // rentivo_operators). PostgREST returned 42703 and the `throw` below
        // failed the ENTIRE broadcast whenever a geographic segment was used.
        const { data, error } = await q
        if (error) throw error
        for (const row of data ?? []) {
          if (row.push_token) tokens.push(row.push_token as string)
        }
        if ((data?.length ?? 0) < DB_PAGE_SIZE) break
      }
    }

    if (audience === 'operators' || audience === 'all') {
      for (let page = 0; page < DB_MAX_PAGES; page++) {
        const from = page * DB_PAGE_SIZE
        let q = supabase
          .from('rentivo_operators')
          .select('push_token')
          .not('push_token', 'is', null)
          .eq('approved', true)
          .order('id', { ascending: true })
          .range(from, from + DB_PAGE_SIZE - 1)
        if (payload.segment?.city) q = q.ilike('city', payload.segment.city)
        if (payload.segment?.country) q = q.eq('country', payload.segment.country)
        const { data, error } = await q
        if (error) throw error
        for (const row of data ?? []) {
          if (row.push_token) tokens.push(row.push_token as string)
        }
        if ((data?.length ?? 0) < DB_PAGE_SIZE) break
      }
    }

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No tokens found for segment' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Expo batch API: max 100 per request
    let sent = 0
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE).map(token => ({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default',
      }))

      const resp = await fetch(EXPO_PUSH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(batch),
      })

      if (resp.ok) sent += batch.length
    }

    return new Response(JSON.stringify({ sent, total_tokens: tokens.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
