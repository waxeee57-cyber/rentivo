import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
}

type EmailTemplate =
  | 'operator_welcome'
  | 'operator_day3_tips'
  | 'operator_day7_pricing'
  | 'operator_day14_growth'
  | 'booking_confirmed_guest'
  | 'booking_confirmed_operator'
  | 'booking_cancelled_guest'
  | 'booking_cancelled_operator'
  | 'identity_verified'

interface EmailPayload {
  to: string
  template: EmailTemplate
  data: Record<string, string | number>
}

// HTML-escape EVERY interpolated data value (body-injection guard). The template
// markup itself is trusted; only ${data.*} values pass through here.
function esc(v: string | number | undefined | null): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderTemplate(template: EmailTemplate, data: Record<string, string | number>): { subject: string; html: string } {
  const brandColor = '#E8A44A'
  const bgColor = '#0A1628'
  const textColor = '#F5F0E8'

  const base = (content: string) => `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="margin:0;padding:0;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <span style="font-size:28px;font-weight:900;color:${brandColor};">RENTIVO</span>
        </div>
        <div style="background:#1A2942;border-radius:16px;padding:32px;color:${textColor};">
          ${content}
        </div>
        <div style="text-align:center;margin-top:24px;color:#8A9BB5;font-size:12px;">
          &copy; 2026 Rentivo &middot; <a href="https://rentivo.app/legal/privacy" style="color:#8A9BB5;">Privacy</a> &middot; <a href="https://rentivo.app/legal/terms" style="color:#8A9BB5;">Terms</a>
        </div>
      </div>
    </body>
    </html>
  `

  const btn = (text: string, url: string) =>
    `<a href="${url}" style="display:inline-block;background:${brandColor};color:#000;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;margin-top:16px;">${text}</a>`

  switch (template) {
    case 'operator_welcome':
      return {
        subject: 'Welcome to Rentivo — Your dashboard is ready',
        html: base(`
          <h1 style="font-size:24px;font-weight:800;color:${brandColor};margin:0 0 16px;">Welcome, ${esc(data.name)}!</h1>
          <p style="line-height:1.6;color:#8A9BB5;">Your operator account on Rentivo is ready. Start listing your vehicles and accepting bookings today.</p>
          <ul style="color:#8A9BB5;line-height:2;">
            <li>Add your first vehicle listing</li>
            <li>Set your pricing and availability</li>
            <li>Get your first booking within 48 hours</li>
          </ul>
          <div style="text-align:center;">${btn('Open Rentivo App', 'https://rentivo.app')}</div>
        `)
      }
    case 'booking_confirmed_guest':
      return {
        subject: `Booking confirmed — ${data.listing_title}`,
        html: base(`
          <h1 style="font-size:24px;font-weight:800;color:${brandColor};margin:0 0 16px;">Your booking is confirmed</h1>
          <p style="line-height:1.6;color:#8A9BB5;">Great news! Your booking for <strong style="color:#F5F0E8;">${esc(data.listing_title)}</strong> has been confirmed.</p>
          <div style="background:#0A1628;border-radius:12px;padding:20px;margin:16px 0;">
            <div style="color:#8A9BB5;font-size:13px;margin-bottom:8px;">BOOKING DETAILS</div>
            <div style="color:#F5F0E8;font-size:15px;font-weight:600;">${esc(data.start_date)} &rarr; ${esc(data.end_date)}</div>
            <div style="color:${brandColor};font-size:20px;font-weight:800;margin-top:8px;">Total: &euro;${esc(data.total_amount)}</div>
          </div>
          <p style="color:#8A9BB5;font-size:13px;">Booking ID: ${esc(data.booking_id)}</p>
          <div style="text-align:center;">${btn('View Booking', 'https://rentivo.app')}</div>
        `)
      }
    case 'booking_confirmed_operator':
      return {
        subject: `New confirmed booking — ${data.guest_name}`,
        html: base(`
          <h1 style="font-size:24px;font-weight:800;color:${brandColor};margin:0 0 16px;">New booking confirmed</h1>
          <p style="line-height:1.6;color:#8A9BB5;"><strong style="color:#F5F0E8;">${esc(data.guest_name)}</strong> has booked <strong style="color:#F5F0E8;">${esc(data.listing_title)}</strong>.</p>
          <div style="background:#0A1628;border-radius:12px;padding:20px;margin:16px 0;">
            <div style="color:#8A9BB5;font-size:13px;margin-bottom:8px;">RENTAL PERIOD</div>
            <div style="color:#F5F0E8;font-size:15px;font-weight:600;">${esc(data.start_date)} &rarr; ${esc(data.end_date)}</div>
            <div style="color:#2D9B6F;font-size:20px;font-weight:800;margin-top:8px;">You receive: &euro;${esc(data.payout)}</div>
          </div>
          <div style="text-align:center;">${btn('Manage Booking', 'https://rentivo.app')}</div>
        `)
      }
    case 'booking_cancelled_guest':
      return {
        subject: `Booking cancelled — ${data.listing_title}`,
        html: base(`
          <h1 style="font-size:24px;font-weight:800;color:#E05252;margin:0 0 16px;">Booking cancelled</h1>
          <p style="line-height:1.6;color:#8A9BB5;">Your booking for <strong style="color:#F5F0E8;">${esc(data.listing_title)}</strong> has been cancelled.</p>
          <p style="color:#8A9BB5;">If you paid, a refund will be processed within 5-7 business days.</p>
          <div style="text-align:center;">${btn('Book Again', 'https://rentivo.app')}</div>
        `)
      }
    case 'booking_cancelled_operator':
      return {
        subject: `Booking cancelled by guest — ${data.listing_title}`,
        html: base(`
          <h1 style="font-size:24px;font-weight:800;color:#E05252;margin:0 0 16px;">Booking cancelled</h1>
          <p style="line-height:1.6;color:#8A9BB5;"><strong style="color:#F5F0E8;">${esc(data.guest_name)}</strong> cancelled their booking for <strong style="color:#F5F0E8;">${esc(data.listing_title)}</strong>.</p>
          <p style="color:#8A9BB5;">The dates are now available for new bookings.</p>
          <div style="text-align:center;">${btn('View Dashboard', 'https://rentivo.app')}</div>
        `)
      }
    case 'operator_day3_tips':
      return {
        subject: 'Quick tips to get your first booking on Rentivo',
        html: base(`
          <h1 style="font-size:24px;font-weight:800;color:${brandColor};margin:0 0 16px;">3 tips to get booked faster</h1>
          <p style="line-height:1.6;color:#8A9BB5;">Hey ${esc(data.name)}, it&apos;s been a few days — here&apos;s how top operators on Rentivo fill their calendars:</p>
          <ul style="color:#8A9BB5;line-height:2.2;padding-left:20px;">
            <li><strong style="color:#F5F0E8;">Add 5+ photos</strong> — listings with more images get 3× more views</li>
            <li><strong style="color:#F5F0E8;">Enable Instant Book</strong> — removes friction and boosts ranking</li>
            <li><strong style="color:#F5F0E8;">Set a competitive price</strong> — use our AI Pricing tool in the app</li>
          </ul>
          <div style="text-align:center;">${btn('Update My Listing', 'https://rentivo.app')}</div>
        `)
      }
    case 'operator_day7_pricing':
      return {
        subject: 'Are you pricing correctly? See what similar operators charge',
        html: base(`
          <h1 style="font-size:24px;font-weight:800;color:${brandColor};margin:0 0 16px;">Your pricing matters</h1>
          <p style="line-height:1.6;color:#8A9BB5;">Hi ${esc(data.name)}, the #1 reason operators don&apos;t get bookings is pricing mismatch. We analyzed your market in <strong style="color:#F5F0E8;">${esc(data.city ?? 'your city')}</strong>:</p>
          <div style="background:#0A1628;border-radius:12px;padding:20px;margin:16px 0;color:#8A9BB5;">
            <div>Market average: <strong style="color:${brandColor};">&euro;${esc(data.avg_price ?? '—')}/day</strong></div>
            <div>Your price: <strong style="color:#F5F0E8;">&euro;${esc(data.your_price ?? '—')}/day</strong></div>
          </div>
          <p style="color:#8A9BB5;font-size:14px;">Open the AI Pricing tool in the Rentivo operator app to see detailed suggestions.</p>
          <div style="text-align:center;">${btn('Check AI Pricing', 'https://rentivo.app')}</div>
        `)
      }
    case 'operator_day14_growth':
      return {
        subject: 'Unlock more bookings — here\'s your growth checklist',
        html: base(`
          <h1 style="font-size:24px;font-weight:800;color:${brandColor};margin:0 0 16px;">Your 14-day growth review</h1>
          <p style="line-height:1.6;color:#8A9BB5;">Hi ${esc(data.name)}, two weeks in — let&apos;s make sure you&apos;re set up for maximum visibility:</p>
          <div style="background:#0A1628;border-radius:12px;padding:20px;margin:16px 0;">
            <div style="color:#8A9BB5;margin-bottom:8px;">GROWTH CHECKLIST</div>
            <ul style="color:#8A9BB5;line-height:2;list-style:none;padding:0;margin:0;">
              <li>✅ Complete your operator profile (bio + photo)</li>
              <li>✅ Enable delivery zones — reach more guests</li>
              <li>✅ Add seasonal pricing for peak months</li>
              <li>✅ Get verified — Verified badge = 40% more bookings</li>
            </ul>
          </div>
          <p style="color:#8A9BB5;font-size:14px;">Questions? Reply to this email — our team reads every message.</p>
          <div style="text-align:center;">${btn('Open Dashboard', 'https://rentivo.app')}</div>
        `)
      }
    case 'identity_verified':
      return {
        subject: "Identity verified — You're all set!",
        html: base(`
          <h1 style="font-size:24px;font-weight:800;color:${brandColor};margin:0 0 16px;">Identity verified</h1>
          <p style="line-height:1.6;color:#8A9BB5;">Congratulations <strong style="color:#F5F0E8;">${esc(data.name)}</strong>! Your identity has been verified successfully.</p>
          <p style="color:#8A9BB5;">You can now make bookings on Rentivo without restrictions.</p>
          <div style="text-align:center;">${btn('Start Exploring', 'https://rentivo.app')}</div>
        `)
      }
    default: {
      const _exhaustive: never = template
      return { subject: 'Rentivo Notification', html: base('<p>You have a new notification from Rentivo.</p>') }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── Server-to-server only. send-email may send Rentivo-branded mail to arbitrary
  //    recipients, so it must never be reachable by a public (anon-key) caller.
  //    Fail-closed: if the shared secret is not configured, deny everything (503).
  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET')
  if (!internalSecret) {
    return new Response(JSON.stringify({ error: 'not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (req.headers.get('X-Internal-Secret') !== internalSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const payload = await req.json() as EmailPayload
    const { to, template, data } = payload

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { subject, html } = renderTemplate(template, data)

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Rentivo <noreply@rentivo.app>',
        to: [to],
        subject,
        html,
      })
    })

    if (!resp.ok) {
      await resp.text()
      return new Response(JSON.stringify({ error: 'Email send failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const result = await resp.json()
    return new Response(JSON.stringify({ success: true, id: (result as { id?: string }).id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (_err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
