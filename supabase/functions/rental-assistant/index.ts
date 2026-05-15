import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

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
  return new Response(
    JSON.stringify({ response: data.content[0]?.text ?? 'Sorry, I could not process that.' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
