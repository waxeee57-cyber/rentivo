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
  return false
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  if (await rateLimited(supabase, user.id, 'translate_message', 100, 60)) {
    return json({ error: 'Rate limit exceeded. Please slow down.' }, 429)
  }

  try {
    const { text, target_language } = await req.json() as {
      text: string
      target_language: 'en' | 'es' | 'hu' | 'de' | 'fr' | 'pt'
    }

    if (!text?.trim()) {
      return json({ translated: text })
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return json({ translated: text, error: 'Translation unavailable' })
    }

    const langNames: Record<string, string> = {
      en: 'English', es: 'Spanish', hu: 'Hungarian', de: 'German', fr: 'French', pt: 'Portuguese'
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Translate the following text to ${langNames[target_language] ?? target_language}. Return ONLY the translation, no explanation, no quotes.\n\nText: ${text}`
        }]
      })
    })

    if (!resp.ok) {
      return json({ translated: text, error: 'Translation failed' })
    }

    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const translated = data.content?.[0]?.text?.trim() ?? text

    return json({ translated })
  } catch (_err) {
    return json({ error: 'Internal error' }, 500)
  }
})
