/**
 * Shared harness for the end-to-end flow proofs.
 *
 * Every script under scripts/e2e drives the REAL deployed edge functions and the
 * REAL database with Stripe test-mode money. Nothing here mocks anything: a test
 * that mocks the thing it is meant to prove proves nothing.
 *
 * Stripe TEST keys only. The helpers refuse to run against a live key.
 */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  // \r?\n, not \n. `.` does not match a carriage return in JS, so with CRLF line
  // endings `(.*)$` fails on every line and the whole file parses to {}.
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map(l => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map(m => [m[1], m[2].trim()]),
)

export const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL
export const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const STRIPE_KEY = env.STRIPE_SECRET_KEY

if (!STRIPE_KEY || !STRIPE_KEY.startsWith('sk_test_')) {
  console.error('REFUSING TO RUN: STRIPE_SECRET_KEY is missing or is not a test key.')
  process.exit(1)
}

/** Test-mode Connect account belonging to the seeded "Test Operator". */
export const TEST_CONNECT_ACCOUNT = 'acct_1Tqc56ER42YjEKEJ'

// ── Reporting ───────────────────────────────────────────────────────────────
let passed = 0
let failed = 0
const failures = []

export function step(ok, label, detail = '') {
  const line = `${label}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`
  if (ok) { passed++; console.log(`  PASS  ${line}`) }
  else { failed++; failures.push(line); console.log(`  FAIL  ${line}`) }
  return ok
}

export function section(title) {
  console.log(`\n=== ${title} ===`)
}

export function finish() {
  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  if (failures.length) {
    console.log('failures:')
    for (const f of failures) console.log(`  - ${f}`)
  }
  process.exit(failed === 0 ? 0 : 1)
}

export const sleep = ms => new Promise(r => setTimeout(r, ms))

/** ISO date N days from today. */
export const day = n => {
  const t = new Date()
  t.setDate(t.getDate() + n)
  return t.toISOString().slice(0, 10)
}

// ── HTTP ────────────────────────────────────────────────────────────────────

/** Supabase REST / Auth / Functions call. `token` defaults to the anon key. */
export async function sb(path, opts = {}, token) {
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
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: res.status, ok: res.ok, body }
}

/** Stripe REST call. Form-encoded, as the API expects. */
export async function stripe(path, params, method = 'POST') {
  const encode = (obj, prefix = '') =>
    Object.entries(obj ?? {}).flatMap(([k, v]) => {
      const key = prefix ? `${prefix}[${k}]` : k
      return v && typeof v === 'object' && !Array.isArray(v)
        ? encode(v, key)
        : [[key, String(v)]]
    })
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? new URLSearchParams(encode(params)).toString() : undefined,
  })
  return { status: res.status, ok: res.ok, body: await res.json() }
}

// ── Accounts ────────────────────────────────────────────────────────────────

/**
 * Sign in, creating the account on first run.
 *
 * Two things to know. A `.test` TLD is rejected by Supabase's address validator,
 * so use a domain the project owns. And email confirmation is on, so a brand-new
 * account cannot use the password grant until `auth.users.email_confirmed_at` is
 * set — the caller does that with the Supabase MCP (`execute_sql`) and re-runs.
 * `needsConfirmation` in the result tells you that is what happened.
 */
export async function signIn(email, password) {
  const grant = () => sb('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  let res = await grant()
  if (res.status !== 200) {
    const signUp = await sb('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (signUp.status !== 200) {
      return { token: null, uid: null, error: signUp.body, needsConfirmation: false }
    }
    res = await grant()
  }

  if (res.status !== 200) {
    return {
      token: null,
      uid: null,
      error: res.body,
      needsConfirmation: String(res.body?.error_code ?? '').includes('not_confirmed')
        || String(res.body?.msg ?? '').toLowerCase().includes('not confirmed'),
    }
  }
  return {
    token: res.body.access_token,
    uid: res.body.user?.id,
    error: null,
    needsConfirmation: false,
  }
}

// ── Booking + payment ───────────────────────────────────────────────────────

/** create-booking as the signed-in traveler. */
export async function createBooking(token, { listingId, start, end, extra = {} }) {
  return sb('/functions/v1/create-booking', {
    method: 'POST',
    body: JSON.stringify({
      listing_id: listingId,
      start_date: start,
      end_date: end,
      guest_name: 'E2E Traveler',
      ...extra,
    }),
  }, token)
}

/**
 * Take a booking all the way to paid: create the PaymentIntent, confirm it with
 * a real test card so the real webhook fires, then WAIT for the webhook to land
 * rather than assuming it did.
 */
export async function payBooking(token, bookingId, { card = 'pm_card_visa' } = {}) {
  const pi = await sb('/functions/v1/create-payment-intent', {
    method: 'POST',
    body: JSON.stringify({ booking_id: bookingId }),
  }, token)
  if (pi.status !== 200) return { ok: false, stage: 'create-payment-intent', detail: pi.body }

  const secret = pi.body?.client_secret ?? pi.body?.clientSecret
  const piId = pi.body?.payment_intent_id ?? (secret ? secret.split('_secret_')[0] : null)
  if (!piId) return { ok: false, stage: 'payment-intent-id', detail: pi.body }

  const confirmed = await stripe(`/payment_intents/${piId}/confirm`, {
    payment_method: card,
    return_url: 'https://rentivo.domrol.com/return',
  })
  if (confirmed.body?.status !== 'succeeded') {
    return { ok: false, stage: 'confirm', detail: confirmed.body?.status ?? confirmed.body, piId, pi: confirmed.body }
  }

  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    const r = await sb(
      `/rest/v1/rentivo_bookings?id=eq.${bookingId}&select=status,payment_status,paid_at,stripe_charge_id`,
      {}, token,
    )
    const row = Array.isArray(r.body) ? r.body[0] : null
    if (row?.payment_status === 'paid') {
      return { ok: true, piId, booking: row, pi: confirmed.body }
    }
  }
  return { ok: false, stage: 'webhook', detail: 'payment_status never became paid', piId, pi: confirmed.body }
}

/** Read a booking's columns as the given token. */
export async function readBooking(token, bookingId, select = '*') {
  const r = await sb(
    `/rest/v1/rentivo_bookings?id=eq.${bookingId}&select=${encodeURIComponent(select)}`,
    {}, token,
  )
  return Array.isArray(r.body) ? r.body[0] ?? null : null
}

/** cancel-booking as whoever holds the token. */
export async function cancelBooking(token, bookingId) {
  return sb('/functions/v1/cancel-booking', {
    method: 'POST',
    body: JSON.stringify({ booking_id: bookingId }),
  }, token)
}
