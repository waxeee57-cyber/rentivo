import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { listing_id, city, category, current_price } = await req.json() as {
      listing_id: string
      city: string
      category: string
      current_price: number
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get comparable listings in the same city/category
    const { data: comparables } = await supabase
      .from('listings')
      .select('price_per_day, title, city')
      .eq('city', city)
      .eq('category', category)
      .neq('id', listing_id)
      .eq('is_active', true)
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

    return new Response(JSON.stringify({
      suggested_min: Math.round(minPrice),
      suggested_avg: avgPrice,
      suggested_max: Math.round(maxPrice),
      current_price,
      comparable_count: prices.length,
      insight,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
