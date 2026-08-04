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

// Rows per DB round-trip. This is a cron blast over the whole operator base, so the
// recipient select is PAGED rather than capped — every eligible operator must get the
// step, but one response holding the entire cohort is what OOMs the function on a
// busy signup day. Paging keeps peak memory flat as the table grows.
const DB_PAGE_SIZE = 500
// 200 pages = 100 000 operators in a single 2-hour signup window. Purely a guard so a
// server that never returns a short page cannot spin forever.
const DB_MAX_PAGES = 200

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const sendEmailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`
    const anonKey = (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY'))!
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
      (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!
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

      for (let page = 0; page < DB_MAX_PAGES; page++) {
        const offset = page * DB_PAGE_SIZE
        const { data: operators, error } = await supabase
          .from('rentivo_operators')
          .select('id, name, email, city, created_at')
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString())
          .not('email', 'is', null)
          .eq('approved', true)
          // Deterministic sort is required for `.range()` paging: without it the
          // server may reorder between round-trips and an operator gets the same
          // drip step twice (or never).
          .order('id', { ascending: true })
          .range(offset, offset + DB_PAGE_SIZE - 1)

        if (error) throw error

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

        if ((operators?.length ?? 0) < DB_PAGE_SIZE) break
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
