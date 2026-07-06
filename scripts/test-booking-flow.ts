/**
 * Re-runnable pre-payment integration test — Rentivo create-booking + the
 * create-payment-intent Connect gate. No phone / RN client, no Stripe key.
 *
 *   Run:  npm run test:booking
 *
 * WHAT IT PROVES (against the DEPLOYED edge functions):
 *  T1  create-booking (Mercedes GLE 400, 3 days, basic) returns the SERVER-derived
 *      financials: total_amount=660, subtotal=600, platform_fee=60, deposit_amount=0.
 *  T2  the persisted booking row is status='pending'.
 *  T3  create-payment-intent for that booking returns EXACTLY 400
 *      "Owner is not set up to receive payments" — the operator has
 *      stripe_onboarded=false, so the Connect gate MUST block payment. This is the
 *      correct, expected behaviour; the test asserts the gate, it is not a failure.
 *  T4  idempotency: a second identical create-booking returns reused=true and the
 *      SAME booking_id (no duplicate row).
 *
 * The test user (waxeee57) gets a real access token via admin generateLink →
 * verifyOtp (no password needed). Self-cleaning: the pending test booking is
 * removed at start (stale sweep) and at the end (teardown).
 *
 * Required env (.env or CI): EXPO_PUBLIC_SUPABASE_URL,
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string
}
declare const process: {
  env: Record<string, string | undefined>
  exit(code?: number): never
  argv: string[]
}

import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ── Env loading (merge .env without overriding real env) ──
function loadDotEnv(): void {
  try {
    const raw = readFileSync('.env', 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let val = m[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = val
    }
  } catch {
    /* no .env — rely on real environment (CI) */
  }
}
loadDotEnv()

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// ── Fixtures (measured today via Supabase MCP) ──
const TEST_USER_ID = '6f02c5a9-eff1-41a0-bf1f-257048775769' // confirmed user (waxeee57@gmail.com)
const MERCEDES_ID = '29bd5b55-358e-4992-a3e0-baa5174149eb'  // operator listing, price_per_day=200, deposit=0
const RENTAL_DAYS = 3
const EXPECT = { total: 660, subtotal: 600, fee: 60, deposit: 0 }

// ── Assertion recorder ──
type Status = 'PASS' | 'FAIL'
const results: { id: string; desc: string; status: Status; expected?: string; actual?: string }[] = []
function check(id: string, desc: string, cond: boolean, expected: string, actual: string): void {
  results.push({ id, desc, status: cond ? 'PASS' : 'FAIL', expected: cond ? undefined : expected, actual: cond ? undefined : actual })
  const tag = cond ? '✓' : '✗'
  let line = `  ${tag} ${id}  ${desc}  [${cond ? 'PASS' : 'FAIL'}]`
  if (!cond) line += `\n       expected: ${expected}\n       actual:   ${actual}`
  console.log(line)
}

// ── Edge function caller (real JWT + anon apikey, like the RN client) ──
interface FnResult { status: number; body: Record<string, unknown> }
async function callFn(slug: string, jwt: string, payload: Record<string, unknown>): Promise<FnResult> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: ANON_KEY },
    body: JSON.stringify(payload),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, body }
}

/** Mint a real access token for the test user without their password. */
async function mintUserJwt(admin: SupabaseClient): Promise<string> {
  const { data: u, error: uErr } = await admin.auth.admin.getUserById(TEST_USER_ID)
  if (uErr || !u.user?.email) throw new Error(`getUserById failed: ${uErr?.message ?? 'no email'}`)
  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email })
  const hashed = link?.properties?.hashed_token
  if (lErr || !hashed) throw new Error(`generateLink failed: ${lErr?.message ?? 'no token'}`)
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const { data: otp, error: oErr } = await anon.auth.verifyOtp({ token_hash: hashed, type: 'magiclink' })
  if (oErr || !otp.session) throw new Error(`verifyOtp failed: ${oErr?.message ?? 'no session'}`)
  return otp.session.access_token
}

function isoDays(): { start: string; end: string } {
  const t = new Date()
  const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
  const end = new Date(start.getTime() + RENTAL_DAYS * 86400000)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error('FATAL: missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (.env or CI).')
    process.exit(1)
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { start, end } = isoDays()

  // Stale sweep: remove any prior pending test booking so T1 always creates fresh.
  await admin.from('rentivo_bookings').delete()
    .eq('user_id', TEST_USER_ID).eq('listing_id', MERCEDES_ID)
    .eq('start_date', start).eq('end_date', end).eq('payment_status', 'pending')

  console.log('\n══════════ RENTIVO PRE-PAYMENT INTEGRATION TEST ══════════')
  console.log(`  listing=Mercedes GLE 400  days=${RENTAL_DAYS}  insurance=basic  dates=${start}..${end}\n`)

  const jwt = await mintUserJwt(admin)
  let bookingId = ''

  try {
    // ── T1: create-booking returns server-derived financials ──
    const r1 = await callFn('create-booking', jwt, {
      listing_id: MERCEDES_ID, start_date: start, end_date: end, insurance_id: 'basic',
    })
    bookingId = String(r1.body.booking_id ?? '')
    const okFin =
      r1.status === 200 && !!bookingId &&
      Number(r1.body.total_amount) === EXPECT.total &&
      Number(r1.body.subtotal) === EXPECT.subtotal &&
      Number(r1.body.platform_fee) === EXPECT.fee &&
      Number(r1.body.deposit_amount) === EXPECT.deposit
    check('T1', 'create-booking → total 660 / subtotal 600 / fee 60 / deposit 0', okFin,
      `200 + total=660 subtotal=600 fee=60 deposit=0`,
      `${r1.status} total=${r1.body.total_amount} subtotal=${r1.body.subtotal} fee=${r1.body.platform_fee} deposit=${r1.body.deposit_amount}`)

    // ── T2: persisted booking is status='pending' ──
    const { data: row } = await admin.from('rentivo_bookings').select('status, payment_status').eq('id', bookingId).maybeSingle()
    check('T2', 'persisted booking status = pending', row?.status === 'pending',
      "status='pending'", `status='${row?.status}' payment_status='${row?.payment_status}'`)

    // ── T3: create-payment-intent blocked by Connect gate (stripe_onboarded=false) ──
    const r3 = await callFn('create-payment-intent', jwt, { booking_id: bookingId })
    const msg3 = String(r3.body.error ?? '')
    check('T3', 'create-payment-intent → 400 "Owner is not set up to receive payments"',
      r3.status === 400 && msg3 === 'Owner is not set up to receive payments',
      '400 + "Owner is not set up to receive payments"', `${r3.status} "${msg3}"`)

    // ── T4: idempotency — second identical create-booking reuses same booking ──
    const r4 = await callFn('create-booking', jwt, {
      listing_id: MERCEDES_ID, start_date: start, end_date: end, insurance_id: 'basic',
    })
    check('T4', 'second create-booking → reused=true + same booking_id',
      r4.body.reused === true && String(r4.body.booking_id) === bookingId,
      `reused=true + booking_id=${bookingId}`,
      `reused=${r4.body.reused} booking_id=${r4.body.booking_id}`)
  } finally {
    // ── Teardown: remove the test booking ──
    if (bookingId) {
      await admin.from('rentivo_bookings').delete().eq('id', bookingId)
      console.log(`\n  cleanup: removed test booking ${bookingId}`)
    }
  }

  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  console.log('\n══════════ ASSERTION TABLE ══════════')
  for (const a of results) console.log(`  ${a.id.padEnd(4)} ${a.status.padEnd(5)} ${a.desc}`)
  console.log(`\n  TOTAL: ${pass} PASS, ${fail} FAIL`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err)
  process.exit(1)
})
