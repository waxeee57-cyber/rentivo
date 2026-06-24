import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '',
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // 1. Didit access token
    const tokenRes = await fetch('https://verification.didit.me/v1/auth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('DIDIT_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('DIDIT_CLIENT_SECRET') ?? '',
        grant_type: 'client_credentials',
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      throw new Error(`Didit auth failed: ${errText}`)
    }

    const { access_token } = await tokenRes.json() as { access_token: string }

    // 2. Verification session letrehozasa
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const sessionRes = await fetch('https://verification.didit.me/v1/session/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        callback: `${supabaseUrl}/functions/v1/didit-webhook`,
        vendor_data: user.id,
        features: 'OCR + FACE',
      }),
    })

    if (!sessionRes.ok) {
      const errText = await sessionRes.text()
      throw new Error(`Session creation failed: ${errText}`)
    }

    const session = await sessionRes.json() as {
      session_id: string
      url: string
      session_token: string
    }

    // 3. DB-be mentes
    const { error: dbError } = await supabase
      .from('rentivo_identity_verifications')
      .upsert({
        user_id: user.id,
        didit_session_id: session.session_id,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'didit_session_id',
      })

    if (dbError) {
      throw new Error(`DB insert failed: ${dbError.message}`)
    }

    return new Response(
      JSON.stringify({
        session_id: session.session_id,
        session_url: session.url,
        session_token: session.session_token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
