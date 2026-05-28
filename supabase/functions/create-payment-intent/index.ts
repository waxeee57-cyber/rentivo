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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { booking_id, amount_eur, listing_title, operator_stripe_account_id } = await req.json()

    // Payout guard (defense-in-depth): never create a transferless intent silently.
    // Without a destination Connect account the money would land on the platform
    // account and never reach the operator.
    if (!operator_stripe_account_id || typeof operator_stripe_account_id !== 'string' || !operator_stripe_account_id.startsWith('acct_')) {
      return new Response(
        JSON.stringify({ error: 'Operator is not set up to receive payments' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const amountCents = Math.round(amount_eur * 100)
    const platformCut = parseFloat(Deno.env.get('PLATFORM_CUT') ?? '0.10')
    const platformFeeCents = Math.round(amountCents * platformCut)

    const params: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: { booking_id, user_id: user.id, listing_title, platform: 'rentivo' },
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: operator_stripe_account_id },
    }

    const paymentIntent = await stripe.paymentIntents.create(params)

    await supabase
      .from('rentivo_bookings')
      .update({ payment_intent_id: paymentIntent.id })
      .eq('id', booking_id)

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
