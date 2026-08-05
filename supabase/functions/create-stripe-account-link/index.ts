import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '',
    )

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: operator, error: opError } = await supabase
      .from('rentivo_operators')
      .select('id, stripe_account_id, stripe_account_country, country')
      .eq('auth_id', user.id)
      .single()

    if (opError || !operator) {
      return new Response(JSON.stringify({ error: 'Operator profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // A Stripe Connect account's country is IMMUTABLE once created, and this
    // was hardcoded to 'HU'. Every operator - including the Spanish ones this
    // marketplace is actually built for - was handed a Hungarian Express
    // account and asked for a Hungarian tax ID and bank account. They cannot
    // complete it, and because the broken account id was cached below, every
    // retry reopened the same dead account. `create-payment-intent` then
    // refuses to charge for an owner who is not onboarded, so the end state
    // was a live, visible listing that rejects every renter who tries to pay,
    // with nothing on screen explaining why.
    const SUPPORTED = new Set([
      'ES', 'HU', 'PT', 'IT', 'FR', 'DE', 'GR', 'HR', 'AT', 'NL', 'BE', 'IE',
      'PL', 'RO', 'SK', 'SI', 'CZ', 'BG', 'CY', 'MT', 'LU', 'LT', 'LV', 'EE',
      'FI', 'SE', 'DK', 'NO', 'CH', 'GB',
    ])
    const claimed = String(operator.country ?? '').trim().toUpperCase()
    const country = SUPPORTED.has(claimed) ? claimed : 'ES'

    let accountId = operator.stripe_account_id

    // Refuse to reuse an account whose country no longer matches the operator.
    // Reusing it is what made the original bug permanent rather than merely
    // wrong: the operator could never escape it from inside the app.
    const cachedCountry = String(operator.stripe_account_country ?? '').toUpperCase()
    if (accountId && cachedCountry && cachedCountry !== country) {
      return new Response(JSON.stringify({
        error: 'stripe_country_mismatch',
        message:
          `This payout account was opened for ${cachedCountry} but the business is registered in ` +
          `${country}. Stripe cannot change an account's country, so it has to be recreated. ` +
          `Contact support and we will reset it.`,
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country,
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })
      accountId = account.id

      // Record the country alongside the id so the mismatch guard above has
      // something to compare against on the next attempt.
      await supabase
        .from('rentivo_operators')
        .update({ stripe_account_id: accountId, stripe_account_country: country })
        .eq('id', operator.id)
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'rentivo://app'
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/operator/stripe-refresh`,
      return_url: `${appUrl}/operator/stripe-return`,
      type: 'account_onboarding',
    })

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
