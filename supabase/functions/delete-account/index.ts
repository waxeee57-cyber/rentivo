import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    // 1. Anonymize bookings (keep for financial records — GDPR Art 17(3)(b))
    await supabase.from('rentivo_bookings').update({
      guest_name: '[DELETED]',
      guest_email: '[DELETED]',
      guest_phone: null,
      driver_license_no: null,
    }).eq('user_id', user.id)

    // 2. Delete wishlist
    await supabase.from('rentivo_wishlist').delete().eq('user_id', user.id)

    // 3. Anonymize reviews
    await supabase.from('rentivo_reviews').update({ user_id: null }).eq('user_id', user.id)

    // 4. Delete conversations and messages
    const { data: convs } = await supabase.from('rentivo_conversations').select('id').eq('user_id', user.id)
    if (convs && convs.length > 0) {
      const convIds = convs.map((c: { id: string }) => c.id)
      await supabase.from('rentivo_messages').delete().in('conversation_id', convIds)
      await supabase.from('rentivo_conversations').delete().in('id', convIds)
    }

    // 5. Delete operator/host profiles
    await supabase.from('rentivo_operators').delete().eq('auth_id', user.id)
    await supabase.from('rentivo_hosts').delete().eq('auth_id', user.id)

    // 6. Delete loyalty and notifications
    await supabase.from('rentivo_loyalty').delete().eq('user_id', user.id)
    await supabase.from('rentivo_notifications').delete().eq('user_id', user.id)

    // 7. Delete consent record
    await supabase.from('rentivo_consent').delete().eq('user_id', user.id)

    // 8. Delete user profile
    await supabase.from('rentivo_users').delete().eq('id', user.id)

    // 9. Audit log before deleting auth user
    const encoder = new TextEncoder()
    const data = encoder.encode(user.email ?? '')
    const hash = await crypto.subtle.digest('SHA-256', data)
    const emailHash = Array.from(new Uint8Array(hash)).map((b: number) => b.toString(16).padStart(2, '0')).join('')

    await supabase.from('security_audit_log').insert({
      event_type: 'gdpr_erasure_completed',
      user_id: null,
      details: { deleted_at: new Date().toISOString(), email_hash: emailHash, reason: 'user_request' },
    })

    // 10. Delete auth user
    await supabase.auth.admin.deleteUser(user.id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
