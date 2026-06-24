import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Drip sequence: day offset → template
const DRIP_SEQUENCE = [
  { daysAfter: 3, template: 'operator_day3_tips' },
  { daysAfter: 7, template: 'operator_day7_pricing' },
  { daysAfter: 14, template: 'operator_day14_growth' },
] as const

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const sendEmailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    // send-email is server-to-server only; forward the shared internal secret.
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? ''

    // ── Fail-closed: this is a cron/internal-only batch blast. Without this gate any
    //    authenticated user could trigger the full operator drip (denial-of-wallet +
    //    duplicate spam). The scheduler MUST send the X-Internal-Secret header.
    const providedSecret = req.headers.get('X-Internal-Secret') ?? ''
    if (!internalSecret || providedSecret !== internalSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let totalSent = 0

    for (const step of DRIP_SEQUENCE) {
      // Find operators who registered exactly N days ago (within a 1-hour window to handle cron timing)
      const from = new Date()
      from.setDate(from.getDate() - step.daysAfter)
      from.setHours(from.getHours() - 1)
      const to = new Date()
      to.setDate(to.getDate() - step.daysAfter)
      to.setHours(to.getHours() + 1)

      const { data: operators } = await supabase
        .from('rentivo_operators')
        .select('id, name, email, city, created_at')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .not('email', 'is', null)
        .eq('approved', true)

      for (const op of operators ?? []) {
        if (!op.email) continue

        await fetch(sendEmailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'X-Internal-Secret': internalSecret,
          },
          body: JSON.stringify({
            to: op.email,
            template: step.template,
            data: {
              name: op.name ?? 'there',
              city: op.city ?? '',
            },
          }),
        })

        totalSent++
      }
    }

    return new Response(JSON.stringify({ sent: totalSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
