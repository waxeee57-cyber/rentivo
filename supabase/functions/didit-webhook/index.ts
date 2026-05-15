import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DiditDocument {
  type?: string
  country?: string
  number?: string
  name?: string
  date_of_birth?: string
  expiry_date?: string
}

interface DiditFace {
  similarity_score?: number
  liveness?: string
}

interface DiditWebhookPayload {
  session_id: string
  status: string
  vendor_data?: string
  document?: DiditDocument
  face?: DiditFace
}

const STATUS_MAP: Record<string, string> = {
  'Approved': 'approved',
  'Declined': 'declined',
  'In Progress': 'in_progress',
  'Expired': 'expired',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: DiditWebhookPayload
  try {
    body = await req.json() as DiditWebhookPayload
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { session_id, status, vendor_data: userId, document, face } = body
  const mappedStatus = STATUS_MAP[status] ?? 'pending'

  // Verification record frissítése
  const { error: updateError } = await supabase
    .from('rentivo_identity_verifications')
    .update({
      status: mappedStatus,
      document_type: document?.type?.toLowerCase() ?? null,
      document_country: document?.country ?? null,
      document_number: document?.number ?? null,
      full_name: document?.name ?? null,
      date_of_birth: document?.date_of_birth ?? null,
      document_expires_at: document?.expiry_date ?? null,
      face_match_score: face?.similarity_score ?? null,
      liveness_passed: face?.liveness === 'live',
      verified_at: mappedStatus === 'approved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('didit_session_id', session_id)

  if (updateError) {
    return new Response(
      JSON.stringify({ error: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Ha approved: user identity_status frissítése
  if (mappedStatus === 'approved' && userId) {
    await supabase
      .from('rentivo_users')
      .update({ identity_status: 'verified' })
      .eq('auth_id', userId)

    // Audit log (ha létezik a tábla)
    await supabase.from('security_audit_log').insert({
      event_type: 'identity_verified',
      user_id: userId,
      details: { session_id, document_type: document?.type },
    }).throwOnError().catch(() => {
      // Silently ignore if audit log table doesn't exist
    })
  }

  return new Response(
    JSON.stringify({ received: true, status: mappedStatus }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
