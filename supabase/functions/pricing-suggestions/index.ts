import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

async function rateLimited(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowSec * 1000).toISOString()
  const { count } = await supabase
    .from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('identifier', userId)
    .eq('action', action)
    .gte('window_start', since)
  if ((count ?? 0) >= limit) return true
  await supabase.from('rate_limits').insert({ identifier: userId, action })
  // Opportunistic cleanup (no pg_cron installed): drop this identifier+action's expired rows.
  await supabase.from('rate_limits').delete().eq('identifier', userId).eq('action', action).lt('window_start', since)
  return false
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '',
  )

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  if (await rateLimited(supabase, user.id, 'pricing_suggestions', 30, 3600)) {
    return json({ error: 'Rate limit exceeded. Please slow down.' }, 429)
  }

  try {
    const { listing_id, city, category, current_price } = await req.json() as {
      listing_id: string
      city: string
      category: string
      current_price: number
    }

    if (!listing_id) return json({ error: 'Missing listing_id' }, 400)
    // Input-size cap on free-text fields interpolated into the prompt.
    if ((city && String(city).length > 100) || (category && String(category).length > 100)) {
      return json({ error: 'Input too long' }, 400)
    }

    // ── Ownership: the caller must own the listing (operator or host). This stops
    //    arbitrary-market probing and binds the aggregate to the caller's own listing.
    const { data: listing } = await supabase
      .from('rentivo_listings')
      .select('owner_type, operator_id, host_id, owner_user_id')
      .eq('id', listing_id)
      .maybeSingle()
    if (!listing) return json({ error: 'Listing not found' }, 404)

    let owns = false
    if (listing.owner_user_id && listing.owner_user_id === user.id) {
      owns = true
    } else if (listing.owner_type === 'host' && listing.host_id) {
      const { data: h } = await supabase
        .from('rentivo_hosts').select('auth_id').eq('id', listing.host_id).maybeSingle()
      owns = h?.auth_id === user.id
    } else if (listing.operator_id) {
      const { data: o } = await supabase
        .from('rentivo_operators').select('auth_id').eq('id', listing.operator_id).maybeSingle()
      owns = o?.auth_id === user.id
    }
    if (!owns) return json({ error: 'Not authorized for this listing' }, 403)

    // Get comparable listings in the same category
    const { data: comparables } = await supabase
      .from('rentivo_listings')
      .select('price_per_day')
      .eq('category', category)
      .neq('id', listing_id)
      .eq('available', true)
      .limit(20)

    const prices = (comparables ?? []).map((l: { price_per_day: number }) => l.price_per_day).filter(Boolean)
    const avgPrice = prices.length > 0
      ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length)
      : current_price

    const minPrice = prices.length > 0 ? Math.min(...prices) : current_price * 0.8
    const maxPrice = prices.length > 0 ? Math.max(...prices) : current_price * 1.2

    // Claude Haiku for insight text
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    let insight = `Market average in ${city}: €${avgPrice}/day. Your price: €${current_price}/day.`

    if (anthropicKey) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          messages: [{
            role: 'user',
            content: `You are a car rental pricing expert. Given: city=${city}, category=${category}, current_price=€${current_price}/day, market_avg=€${avgPrice}/day, market_min=€${minPrice}/day, market_max=€${maxPrice}/day, comparable_listings=${prices.length}. Write 1-2 sentences of pricing advice. Be specific and actionable. No fluff.`
          }]
        })
      })
      if (resp.ok) {
        const data = await resp.json() as { content?: Array<{ text?: string }> }
        insight = data.content?.[0]?.text ?? insight
      }
    }

    return json({
      suggested_min: Math.round(minPrice),
      suggested_avg: avgPrice,
      suggested_max: Math.round(maxPrice),
      current_price,
      comparable_count: prices.length,
      insight,
    })
  } catch (_err) {
    return json({ error: 'Internal error' }, 500)
  }
})
