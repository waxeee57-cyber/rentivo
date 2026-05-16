import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send'
const BATCH_SIZE = 100

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

    if (payload.secret !== Deno.env.get('ADMIN_BROADCAST_SECRET')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const audience = payload.segment?.audience ?? 'all'
    const tokens: string[] = []

    if (audience === 'users' || audience === 'all') {
      let q = supabase
        .from('rentivo_users')
        .select('push_token')
        .not('push_token', 'is', null)
      if (payload.segment?.city) q = q.ilike('city', payload.segment.city)
      if (payload.segment?.country) q = q.eq('country', payload.segment.country)
      const { data } = await q
      for (const row of data ?? []) {
        if (row.push_token) tokens.push(row.push_token as string)
      }
    }

    if (audience === 'operators' || audience === 'all') {
      let q = supabase
        .from('rentivo_operators')
        .select('push_token')
        .not('push_token', 'is', null)
        .eq('approved', true)
      if (payload.segment?.city) q = q.ilike('city', payload.segment.city)
      if (payload.segment?.country) q = q.eq('country', payload.segment.country)
      const { data } = await q
      for (const row of data ?? []) {
        if (row.push_token) tokens.push(row.push_token as string)
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
