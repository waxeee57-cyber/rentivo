import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'

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

interface DamageDetectionRequest {
  before_image_url: string
  after_image_url: string
  booking_id?: string
}

interface DamageDetectionResult {
  has_damage: boolean
  confidence: 'high' | 'medium' | 'low'
  analysis: string
  damage_areas: string[]
  recommendation: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  if (await rateLimited(supabase, user.id, 'damage_detector', 10, 3600)) {
    return json({ error: 'Rate limit exceeded. Please slow down.' }, 429)
  }

  try {
    const { before_image_url, after_image_url } = await req.json() as DamageDetectionRequest

    if (!before_image_url || !after_image_url) {
      return json({ error: 'Both before_image_url and after_image_url are required' }, 400)
    }
    // Input cap + scheme allowlist (Anthropic fetches these URLs; keep them https + bounded).
    if (before_image_url.length > 2048 || after_image_url.length > 2048 ||
        !/^https:\/\//i.test(before_image_url) || !/^https:\/\//i.test(after_image_url)) {
      return json({ error: 'Invalid image URL' }, 400)
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
    }

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'You are a vehicle damage assessment AI for a car rental company. Compare these two vehicle images — the BEFORE (pickup condition) and AFTER (return condition). Analyze for any new damage, scratches, dents, or changes.',
            },
            {
              type: 'image',
              source: { type: 'url', url: before_image_url },
            },
            {
              type: 'text',
              text: 'This is the BEFORE image (vehicle at pickup). Now the AFTER image (vehicle at return):',
            },
            {
              type: 'image',
              source: { type: 'url', url: after_image_url },
            },
            {
              type: 'text',
              text: `Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "has_damage": boolean,
  "confidence": "high" | "medium" | "low",
  "analysis": "one sentence summary",
  "damage_areas": ["list of affected areas, empty if none"],
  "recommendation": "action recommendation for rental operator"
}`,
            },
          ],
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let result: DamageDetectionResult
    try {
      result = JSON.parse(responseText) as DamageDetectionResult
    } catch {
      result = {
        has_damage: false,
        confidence: 'low',
        analysis: responseText.slice(0, 200),
        damage_areas: [],
        recommendation: 'Manual inspection recommended',
      }
    }

    return json(result)
  } catch (_err) {
    return json({ error: 'Internal error' }, 500)
  }
})
