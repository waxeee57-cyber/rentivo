import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Placeholder user for anonymized reviews — FK stays valid
// Created by migration 27_str_view.sql (auth.users INSERT ON CONFLICT DO NOTHING)
const DELETED_USER_ID = '00000000-0000-0000-0000-000000000001'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hashEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase().trim())
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

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

  const userId = user.id
  const emailHash = await hashEmail(user.email ?? '')
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'

  try {
    // AUDIT: erasure started
    await supabase.from('security_audit_log').insert({
      event_type: 'gdpr_erasure_requested',
      user_id: userId,
      email_hash: emailHash,
      ip_address: ip,
      details: { requested_at: new Date().toISOString() },
    })

    // 1. Push token nulling — auth_id is the FK on both tables
    await supabase.from('rentivo_users').update({ push_token: null }).eq('auth_id', userId)
    await supabase.from('rentivo_operators').update({ push_token: null }).eq('auth_id', userId)

    // 2. Deactivate operator listings (orphan prevention — don't delete)
    const { data: operator } = await supabase
      .from('rentivo_operators')
      .select('id')
      .eq('auth_id', userId)
      .maybeSingle()

    if (operator?.id) {
      await supabase
        .from('rentivo_listings')
        .update({ available: false })
        .eq('operator_id', operator.id)
        .eq('available', true)
    }

    // 3. Deactivate host listings
    const { data: host } = await supabase
      .from('rentivo_hosts')
      .select('id')
      .eq('auth_id', userId)
      .maybeSingle()

    if (host?.id) {
      await supabase
        .from('rentivo_listings')
        .update({ available: false })
        .eq('host_id', host.id)
        .eq('available', true)
    }

    // 4. Anonymize bookings — keep for financial retention (GDPR Art 17(3)(b))
    // FIELD: user_id (confirmed — NOT traveler_id)
    await supabase
      .from('rentivo_bookings')
      .update({ guest_name: '[DELETED]', guest_email: '[DELETED]', guest_phone: null, driver_license_no: null })
      .eq('user_id', userId)

    // 5. Anonymize reviews — point to placeholder, NOT null (FK constraint)
    // FIELD: user_id (confirmed — NOT reviewer_id)
    await supabase
      .from('rentivo_reviews')
      .update({ user_id: DELETED_USER_ID })
      .eq('user_id', userId)

    // 6. Wishlist
    await supabase.from('rentivo_wishlist').delete().eq('user_id', userId)

    // 7. Notifications
    await supabase.from('rentivo_notifications').delete().eq('user_id', userId)

    // 8. Loyalty
    await supabase.from('rentivo_loyalty').delete().eq('user_id', userId)

    // 9. Consent
    await supabase.from('rentivo_consent').delete().eq('user_id', userId)

    // 10. Messages — conversations use user_id FK
    const { data: convs } = await supabase
      .from('rentivo_conversations')
      .select('id')
      .eq('user_id', userId)

    if (convs && convs.length > 0) {
      await supabase.from('rentivo_messages').delete().in('conversation_id', convs.map((c: { id: string }) => c.id))
      await supabase.from('rentivo_conversations').delete().in('id', convs.map((c: { id: string }) => c.id))
    }

    // 11. Operator + host profile
    await supabase.from('rentivo_operators').delete().eq('auth_id', userId)
    await supabase.from('rentivo_hosts').delete().eq('auth_id', userId)

    // 12. User profile
    await supabase.from('rentivo_users').delete().eq('id', userId)

    // AUDIT: completion (user_id null — already deleted from app perspective)
    await supabase.from('security_audit_log').insert({
      event_type: 'gdpr_erasure_completed',
      user_id: null,
      email_hash: emailHash,
      ip_address: ip,
      details: { completed_at: new Date().toISOString() },
    })

    // 13. Auth user — last step
    await supabase.auth.admin.deleteUser(userId)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await supabase.from('security_audit_log').insert({
      event_type: 'gdpr_erasure_failed',
      user_id: userId,
      email_hash: emailHash,
      details: { error: msg, failed_at: new Date().toISOString() },
    }).catch(() => {})

    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
