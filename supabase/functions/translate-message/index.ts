import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { text, target_language } = await req.json() as {
      text: string
      target_language: 'en' | 'es' | 'hu' | 'de' | 'fr' | 'pt'
    }

    if (!text?.trim()) {
      return new Response(JSON.stringify({ translated: text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(JSON.stringify({ translated: text, error: 'Translation unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
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
      return new Response(JSON.stringify({ translated: text, error: 'Translation failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const data = await resp.json() as { content?: Array<{ text?: string }> }
    const translated = data.content?.[0]?.text?.trim() ?? text

    return new Response(JSON.stringify({ translated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
