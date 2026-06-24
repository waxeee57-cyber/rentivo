import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  operator_id: string
  event: string
  data: Record<string, unknown>
}

interface WebhookRow {
  id: string
  url: string
  secret: string
  events: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ── Fail-closed authorization: this function signs events with the OPERATOR's
    //    secret and POSTs them to their integration. It must be callable ONLY by
    //    trusted server code (cron / other edge fns), never directly by an end user.
    //    Without this gate any authenticated user could forge correctly-signed
    //    webhook events to any operator (operator_id is request-body controlled).
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? ''
    const providedSecret = req.headers.get('X-Internal-Secret') ?? ''
    if (!internalSecret || providedSecret !== internalSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json() as WebhookPayload
    const { operator_id, event, data } = payload
    if (!operator_id || typeof operator_id !== 'string' || !event || typeof event !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing operator_id or event' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!
    )

    // Get active webhooks for this operator that match the event
    const { data: webhooks, error } = await supabase
      .from('rentivo_webhooks')
      .select('id, url, secret, events')
      .eq('operator_id', operator_id)
      .eq('is_active', true)

    if (error) throw error

    const matchingWebhooks = (webhooks ?? []).filter((w: WebhookRow) =>
      w.events.includes(event) || w.events.includes('*')
    )

    const results = await Promise.allSettled(
      matchingWebhooks.map(async (webhook: WebhookRow) => {
        const body = JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString(),
        })

        const encoder = new TextEncoder()
        const keyData = encoder.encode(webhook.secret)
        const messageData = encoder.encode(body)
        const cryptoKey = await crypto.subtle.importKey(
          'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        )
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
        const sigHex = Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')

        const resp = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Rentivo-Signature': `sha256=${sigHex}`,
            'X-Rentivo-Event': event,
          },
          body,
          signal: AbortSignal.timeout(10000),
        })

        // Update last_triggered_at; increment failure_count when not ok
        if (resp.ok) {
          await supabase
            .from('rentivo_webhooks')
            .update({ last_triggered_at: new Date().toISOString(), failure_count: 0 })
            .eq('id', webhook.id)
        } else {
          await supabase.rpc('increment_webhook_failure', { webhook_id: webhook.id })
          await supabase
            .from('rentivo_webhooks')
            .update({ last_triggered_at: new Date().toISOString() })
            .eq('id', webhook.id)
        }

        return { webhookId: webhook.id, status: resp.status, ok: resp.ok }
      })
    )

    return new Response(JSON.stringify({ dispatched: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
