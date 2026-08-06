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

    // HOSTS TOO. This function only ever knew about rentivo_operators, and
    // nothing anywhere requested a Connect link for a host — so a private host
    // could list a vehicle, take a booking, and never be paid. Their payout row
    // could only be filled in by hand in the database, which is what the test
    // fixtures had been doing. `rentivo_hosts` carries the same
    // stripe_account_id / stripe_onboarded / stripe_account_country columns, so
    // the whole flow below works unchanged once the right table is selected.
    const OWNER_TABLES = ['rentivo_operators', 'rentivo_hosts'] as const
    let ownerTable: (typeof OWNER_TABLES)[number] | null = null
    let operator: {
      id: string
      stripe_account_id: string | null
      stripe_account_country: string | null
      country: string | null
    } | null = null

    for (const table of OWNER_TABLES) {
      const { data, error } = await supabase
        .from(table)
        .select('id, stripe_account_id, stripe_account_country, country')
        .eq('auth_id', user.id)
        .maybeSingle()
      // A hard error must not read as "no such owner": that is how a missing
      // column turned into 404 "Operator profile not found" for every operator
      // on the platform.
      if (error) {
        console.error('[create-stripe-account-link] owner lookup failed', table, error)
        return new Response(JSON.stringify({ error: 'Could not load your payout profile' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (data) {
        ownerTable = table
        operator = data as typeof operator
        break
      }
    }

    if (!operator || !ownerTable) {
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
        .from(ownerTable)
        .update({ stripe_account_id: accountId, stripe_account_country: country })
        .eq('id', operator.id)
    }

    // Stripe requires PUBLIC http(s) URLs here and rejects a custom scheme with
    // 400 "Not a valid URL". The default was `rentivo://app`, so with APP_URL
    // unset — which it is — every single call to this function 500'd on the very
    // last step, after the Connect account had already been created. That is
    // worse than failing early: it left an account id on the operator row with
    // no way for them to ever finish onboarding it.
    //
    // The web domain is the landing point; it deep-links back into the app.
    const rawAppUrl = Deno.env.get('APP_URL')?.trim()
    const appUrl = rawAppUrl && /^https?:\/\//i.test(rawAppUrl)
      ? rawAppUrl.replace(/\/+$/, '')
      : 'https://rentivo.domrol.com'

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
