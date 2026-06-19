import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Per-user fixed-window rate limit on the existing public.rate_limits table.
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
  return false
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  if (await rateLimited(supabase, user.id, 'rental_assistant', 20, 60)) {
    return json({ error: 'Rate limit exceeded. Please slow down.' }, 429)
  }

  try {
    const { messages } = await req.json() as { messages: Array<{ role: string; content: string }> }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: 'You are a helpful rental assistant for Rentivo, a European peer-to-peer rental marketplace. Help users find cars, villas, boats, and other rentals. Be concise and friendly. Available locations: Marbella Spain, Hungary, Budapest.',
        messages,
      }),
    })

    const data = await response.json() as { content: Array<{ text: string }> }
    return json({ response: data.content[0]?.text ?? 'Sorry, I could not process that.' })
  } catch (_err) {
    return json({ error: 'Internal error' }, 500)
  }
})
