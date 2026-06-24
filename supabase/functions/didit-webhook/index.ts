import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
}

// Didit signs each webhook callback with HMAC-SHA256 over the RAW request body,
// using the Webhook Secret from the Didit console, sent (hex) in the `x-signature`
// header. We recompute the HMAC and compare in constant time BEFORE trusting or
// persisting anything — without this, a forged POST could write a fake "Approved"
// KYC status. Crypto pattern mirrors operator-webhook-dispatch/index.ts.
//
// ⚠️ Confirm the exact header name + signing scheme against the current Didit
//    dashboard/webhook docs before go-live; adjust SIGNATURE_HEADER if Didit uses
//    a different header (the verification logic itself stays the same).
const SIGNATURE_HEADER = 'x-signature'

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

// Constant-time hex string comparison — avoids leaking match length via timing.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Fail-safe: a missing secret means we cannot verify anything, so we reject
  // every request rather than accept unsigned callbacks. Secure default = closed.
  const webhookSecret = Deno.env.get('DIDIT_WEBHOOK_SECRET')
  if (!webhookSecret) {
    return new Response(
      JSON.stringify({ error: 'Webhook secret not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Read the RAW body — HMAC must be computed over the exact bytes Didit signed,
  // not a re-serialized JSON object.
  const rawBody = await req.text()

  // Verify the signature BEFORE parsing or persisting anything.
  const provided = req.headers.get(SIGNATURE_HEADER) ?? ''
  const normalized = (provided.startsWith('sha256=') ? provided.slice(7) : provided).toLowerCase()
  const expected = await hmacHex(webhookSecret, rawBody)
  if (!normalized || !timingSafeEqualHex(normalized, expected)) {
    return new Response(
      JSON.stringify({ error: 'Invalid signature' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  let body: DiditWebhookPayload
  try {
    body = JSON.parse(rawBody) as DiditWebhookPayload
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '',
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
