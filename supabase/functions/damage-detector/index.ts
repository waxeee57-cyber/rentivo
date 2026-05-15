import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  try {
    const { before_image_url, after_image_url } = await req.json() as DamageDetectionRequest

    if (!before_image_url || !after_image_url) {
      return new Response(
        JSON.stringify({ error: 'Both before_image_url and after_image_url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
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

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
