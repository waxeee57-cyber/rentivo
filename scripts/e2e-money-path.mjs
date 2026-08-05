/**
 * End-to-end proof that the money path works, against the DEPLOYED functions.
 *
 * Everything fixed today was verified by reading code and querying the schema.
 * That is not the same as money moving. This drives the real loop with a real
 * Stripe test-mode card: book, pay, confirm via webhook, block the dates,
 * reject a double sale, cancel, refund.
 *
 * Stripe TEST keys only. The script refuses to run against a live key.
 *
 * Run: node scripts/e2e-money-path.mjs
 */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    // Split on \r?\n, not \n. With CRLF endings a trailing \r survives, and `.`
    // does not match a carriage return in JS, so `(.*)$` fails on EVERY line and
    // the whole file parses to an empty object.
    .split(/\r?\n/)
    .map(l => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map(m => [m[1], m[2].trim()]),
)

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const STRIPE = env.STRIPE_SECRET_KEY

if (!STRIPE.startsWith('sk_test_')) {
  console.error('REFUSING TO RUN: STRIPE_SECRET_KEY is not a test key.')
  process.exit(1)
}

const LISTING_ID = process.argv[2] ?? '141754da-7824-4f49-ba05-cbb94117462d'

let pass = 0
let fail = 0
const step = (ok, label, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`) }
}

async function sb(path, opts = {}, token) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token ?? ANON}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body }
}

async function stripe(path, params, method = 'POST') {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  })
  return { status: res.status, body: await res.json() }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── 0. A traveler account. Reused across runs so the Stripe customer persists.
// A .test TLD is rejected by Supabase's address validator, so this uses a real
// domain the project already owns.
const EMAIL = 'e2e-traveler@rentivo.domrol.com'
const PASSWORD = 'e2e-Traveler-Pass-2026!'

console.log('\n=== 0. Auth ===')
let signIn = await sb('/auth/v1/token?grant_type=password', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
if (signIn.status !== 200) {
  const signUp = await sb('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (signUp.status !== 200) {
    console.log('  signup failed:', signUp.status, JSON.stringify(signUp.body).slice(0, 300))
    process.exit(1)
  }
  console.log('  signup:', signUp.status, JSON.stringify(signUp.body).slice(0, 300))
  signIn = await sb('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
}
if (signIn.status !== 200) {
  console.log('  signin:', signIn.status, JSON.stringify(signIn.body).slice(0, 300))
}
const TOKEN = signIn.body?.access_token
const UID = signIn.body?.user?.id
step(!!TOKEN, 'traveler signed in', UID)
if (!TOKEN) process.exit(1)

// Dates far enough out that the cancellation policy still refunds 100%.
const d = n => {
  const t = new Date()
  t.setDate(t.getDate() + n)
  return t.toISOString().slice(0, 10)
}
const START = d(30)
const END = d(33)

// ── 1. Create the booking.
console.log('\n=== 1. create-booking ===')
const booking = await sb('/functions/v1/create-booking', {
  method: 'POST',
  body: JSON.stringify({
    listing_id: LISTING_ID, start_date: START, end_date: END,
    guest_name: 'E2E Traveler', guest_email: EMAIL,
  }),
}, TOKEN)
step(booking.status === 200, 'booking created', JSON.stringify(booking.body).slice(0, 200))
const BOOKING_ID = booking.body?.booking_id
if (!BOOKING_ID) process.exit(1)

const expectedSubtotal = 150 * 3
const expectedFee = Math.round(expectedSubtotal * 0.10)
step(
  booking.body.total_amount === expectedSubtotal + expectedFee,
  'server priced it itself',
  `got ${booking.body.total_amount}, expected ${expectedSubtotal + expectedFee}`,
)

// ── 2. PaymentIntent.
console.log('\n=== 2. create-payment-intent ===')
const pi = await sb('/functions/v1/create-payment-intent', {
  method: 'POST',
  body: JSON.stringify({ booking_id: BOOKING_ID }),
}, TOKEN)
step(pi.status === 200, 'payment intent created', JSON.stringify(pi.body).slice(0, 220))
const CLIENT_SECRET = pi.body?.client_secret ?? pi.body?.clientSecret
const PI_ID = CLIENT_SECRET ? CLIENT_SECRET.split('_secret_')[0] : null
step(!!PI_ID, 'payment intent id', PI_ID ?? 'none')
if (!PI_ID) process.exit(1)

// ── 3. Pay it. Real Stripe test card, so the real webhook fires.
console.log('\n=== 3. Confirm the charge ===')
const confirmed = await stripe(`/payment_intents/${PI_ID}/confirm`, {
  payment_method: 'pm_card_visa',
  return_url: 'https://rentivo.domrol.com/return',
})
step(
  confirmed.status === 200 && confirmed.body.status === 'succeeded',
  'charge succeeded',
  confirmed.body.status ?? JSON.stringify(confirmed.body.error ?? {}).slice(0, 200),
)
if (confirmed.body.status !== 'succeeded') process.exit(1)
step(
  confirmed.body.transfer_data?.destination === 'acct_1Tqc56ER42YjEKEJ',
  'destination charge routed to the operator',
  confirmed.body.transfer_data?.destination ?? 'NO DESTINATION',
)
step(
  confirmed.body.application_fee_amount === expectedFee * 100,
  'platform fee applied',
  `${confirmed.body.application_fee_amount} minor units`,
)

// ── 4. The webhook has to do the rest. Poll rather than assume.
console.log('\n=== 4. Webhook effects ===')
let row = null
for (let i = 0; i < 20; i++) {
  await sleep(1500)
  const r = await sb(
    `/rest/v1/rentivo_bookings?id=eq.${BOOKING_ID}&select=status,payment_status,paid_at,stripe_charge_id`,
    {}, TOKEN,
  )
  row = Array.isArray(r.body) ? r.body[0] : null
  if (row?.payment_status === 'paid') break
}
step(row?.payment_status === 'paid', 'payment_status = paid', row?.payment_status ?? 'never arrived')
step(row?.status === 'confirmed', 'status = confirmed', row?.status ?? '-')
step(!!row?.paid_at, 'paid_at written', row?.paid_at ?? '-')
step(!!row?.stripe_charge_id, 'stripe_charge_id written', row?.stripe_charge_id ?? '-')

const avail = await sb(
  `/rest/v1/rentivo_availability?booking_id=eq.${BOOKING_ID}&select=blocked_date,end_date,reason`,
  {}, TOKEN,
)
step(
  Array.isArray(avail.body) && avail.body.length === 1,
  'dates blocked in rentivo_availability',
  JSON.stringify(avail.body).slice(0, 160),
)

// ── 5. The same dates must not be sellable twice.
console.log('\n=== 5. Double-booking guard ===')
const clash = await sb('/functions/v1/create-booking', {
  method: 'POST',
  body: JSON.stringify({
    listing_id: LISTING_ID, start_date: START, end_date: END, guest_name: 'Second Renter',
  }),
}, TOKEN)
step(clash.status === 409, 'second booking rejected', `${clash.status} ${JSON.stringify(clash.body).slice(0, 120)}`)

// ── 6. A renter cannot promote their own booking.
console.log('\n=== 6. Client write guards ===')
const selfConfirm = await sb(`/rest/v1/rentivo_bookings?id=eq.${BOOKING_ID}`, {
  method: 'PATCH',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ status: 'active' }),
}, TOKEN)
step(selfConfirm.status >= 400, 'traveler cannot change status', `${selfConfirm.status} ${JSON.stringify(selfConfirm.body).slice(0, 140)}`)

const selfPay = await sb(`/rest/v1/rentivo_bookings?id=eq.${BOOKING_ID}`, {
  method: 'PATCH',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ total_amount: 1 }),
}, TOKEN)
step(selfPay.status >= 400, 'traveler cannot rewrite the price', `${selfPay.status} ${JSON.stringify(selfPay.body).slice(0, 140)}`)

const selfKyc = await sb('/rest/v1/rentivo_identity_verifications', {
  method: 'POST',
  body: JSON.stringify({ user_id: UID, status: 'approved', liveness_passed: true }),
}, TOKEN)
step(selfKyc.status >= 400, 'traveler cannot self-approve KYC', `${selfKyc.status} ${JSON.stringify(selfKyc.body).slice(0, 140)}`)

// ── 7. Cancel, and check the money actually goes back.
console.log('\n=== 7. cancel-booking ===')
const cancelled = await sb('/functions/v1/cancel-booking', {
  method: 'POST',
  body: JSON.stringify({ booking_id: BOOKING_ID }),
}, TOKEN)
step(cancelled.status === 200, 'cancel accepted', JSON.stringify(cancelled.body).slice(0, 200))
step(
  cancelled.body?.refund_amount === expectedSubtotal + expectedFee,
  'full refund computed',
  `${cancelled.body?.refund_amount} (policy ${cancelled.body?.policy}, ${cancelled.body?.refund_percent}%)`,
)
step(!!cancelled.body?.refund_id, 'stripe refund id returned', cancelled.body?.refund_id ?? 'NONE')

if (cancelled.body?.refund_id) {
  const refund = await stripe(`/refunds/${cancelled.body.refund_id}`, null, 'GET')
  step(
    refund.body?.status === 'succeeded' || refund.body?.status === 'pending',
    'refund exists in Stripe',
    `${refund.body?.status} ${refund.body?.amount} ${refund.body?.currency}`,
  )
}

const availAfter = await sb(
  `/rest/v1/rentivo_availability?booking_id=eq.${BOOKING_ID}&select=id`, {}, TOKEN,
)
step(
  Array.isArray(availAfter.body) && availAfter.body.length === 0,
  'dates released after cancellation',
  JSON.stringify(availAfter.body).slice(0, 120),
)

const rebook = await sb('/functions/v1/create-booking', {
  method: 'POST',
  body: JSON.stringify({
    listing_id: LISTING_ID, start_date: START, end_date: END, guest_name: 'Third Renter',
  }),
}, TOKEN)
step(rebook.status === 200, 'vehicle is sellable again', `${rebook.status}`)

console.log(`\n=== ${pass} passed, ${fail} failed ===`)
process.exit(fail === 0 ? 0 : 1)
