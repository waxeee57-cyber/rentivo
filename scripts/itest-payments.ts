/**
 * Re-runnable backend integration test — Rentivo payment + Deposit Model B flow.
 *
 * Exercises the deployed Supabase Edge Functions (create-payment-intent,
 * create-deposit-setup, charge-deposit) and the stripe-webhook against Stripe
 * TEST mode. No phone / RN client required.
 *
 *   Run:  npm run itest:payments
 *
 * SAFETY
 *  - Refuses to run unless STRIPE_SECRET_KEY starts with 'sk_test_' (live key => abort).
 *  - All test data is marked (email: rentivo-itest+<uuid>@example.com) and torn down
 *    by id at the end; a marker sweep also runs at start so crashed runs never pile up.
 *
 * CAPABILITY LAYERS (auto-detected — see the preflight matrix it prints)
 *  - A  auth/guard only (no Stripe call, no webhook). Needs Supabase config only.
 *  - B  sync Stripe (needs sk_test_ + a charges_enabled Connect account).
 *  - C  webhook-driven (needs B + a stripe-webhook endpoint subscribed to the 4 events).
 *
 * Required env (from CI secrets or .env): EXPO_PUBLIC_SUPABASE_URL,
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PLATFORM_CUT,
 *   ITEST_CONNECT_ACCOUNT_ID (force a specific test Connect account).
 */

// ── Minimal Node ambient (avoids pulling @types/node into the app typecheck,
//    which would clash with the RN/Expo global types). ──
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

// ─────────────────────────────────────────────────────────────────────────────
// Env loading (merge .env without overriding real env) + config
// ─────────────────────────────────────────────────────────────────────────────
function loadDotEnv(): void {
  try {
    const raw = readFileSync('.env', 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      let val = m[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  } catch {
    // no .env — rely on real environment (CI)
  }
}
loadDotEnv()

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY ?? ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''
const PLATFORM_CUT = parseFloat(process.env.PLATFORM_CUT ?? process.env.EXPO_PUBLIC_PLATFORM_CUT ?? '0.10')
const FORCED_CONNECT_ACCOUNT = process.env.ITEST_CONNECT_ACCOUNT_ID ?? ''

const MARKER = 'rentivo-itest+'
const RENTER_PASSWORD = 'Itest!Pw_2026_xyz'

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────────────────────
type Status = 'PASS' | 'FAIL' | 'SKIP'
interface Assertion { id: string; desc: string; status: Status; expected?: string; actual?: string }
const results: Assertion[] = []

function record(id: string, desc: string, status: Status, expected?: string, actual?: string): void {
  results.push({ id, desc, status, expected, actual })
  const tag = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '–'
  let line = `  ${tag} ${id}  ${desc}  [${status}]`
  if (status === 'FAIL') line += `\n       expected: ${expected}\n       actual:   ${actual}`
  console.log(line)
}

/** Assert helper: PASS if cond, else FAIL with expected/actual. */
function check(id: string, desc: string, cond: boolean, expected: string, actual: string): void {
  record(id, desc, cond ? 'PASS' : 'FAIL', cond ? undefined : expected, cond ? undefined : actual)
}

function uuidish(): string {
  // RFC4122-v4-ish without crypto dep; only used for unique marker emails.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ── Edge function caller ──
interface FnResult { status: number; body: Record<string, unknown> }
async function callFn(slug: string, jwt: string, payload: Record<string, unknown>): Promise<FnResult> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(payload),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, body }
}

// ── Stripe REST (form-encoded; no SDK dependency) ──
async function stripe<T = Record<string, unknown>>(
  method: 'GET' | 'POST',
  path: string,
  params?: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${STRIPE_SECRET}` }
  let url = `https://api.stripe.com/v1/${path}`
  let bodyStr: string | undefined
  if (method === 'GET' && params) {
    url += '?' + new URLSearchParams(params).toString()
  } else if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    bodyStr = new URLSearchParams(params).toString()
  }
  const res = await fetch(url, { method, headers, body: bodyStr })
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────
interface Fixture {
  renterAuthId: string
  renterJwt: string
  renter2Jwt: string
  operatorAuthId: string
  operatorJwt: string
  operatorRowId: string
  listingId: string
  connectAccountId: string
  operatorOnboarded: boolean
}

const created = {
  authUserIds: [] as string[],
  bookingIds: [] as string[],
  listingIds: [] as string[],
  operatorIds: [] as string[],
}

async function signIn(email: string): Promise<string> {
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: RENTER_PASSWORD })
  if (error || !data.session) throw new Error(`signIn failed for ${email}: ${error?.message}`)
  return data.session.access_token
}

async function createMarkedUser(admin: SupabaseClient, label: string): Promise<string> {
  const email = `${MARKER}${label}-${uuidish()}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: RENTER_PASSWORD,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  created.authUserIds.push(data.user.id)
  return data.user.id
}

/** Delete every marker user + their owned rows. Used at start (sweep) and end (cleanup). */
async function cleanupByMarker(admin: SupabaseClient): Promise<void> {
  // Collect marker auth users (paginate).
  const markerIds: string[] = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data.users.length) break
    for (const u of data.users) if (u.email && u.email.startsWith(MARKER)) markerIds.push(u.id)
    if (data.users.length < 200) break
  }
  const ids = Array.from(new Set([...markerIds, ...created.authUserIds]))
  if (ids.length) {
    // Rows reference auth uid via user_id / auth_id. Delete children → parents.
    await admin.from('rentivo_bookings').delete().in('user_id', ids)
    if (created.bookingIds.length) await admin.from('rentivo_bookings').delete().in('id', created.bookingIds)
    if (created.listingIds.length) await admin.from('rentivo_listings').delete().in('id', created.listingIds)
    await admin.from('rentivo_operators').delete().in('auth_id', ids)
    await admin.from('rentivo_users').delete().in('auth_id', ids)
    for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => undefined)
  }
  created.authUserIds = []
  created.bookingIds = []
  created.listingIds = []
  created.operatorIds = []
}

/** Resolve a charges_enabled TEST Connect account, or null if none available. */
async function resolveConnectAccount(admin: SupabaseClient): Promise<string | null> {
  if (!STRIPE_SECRET) return null
  const verify = async (acct: string): Promise<boolean> => {
    const r = await stripe<{ charges_enabled?: boolean }>('GET', `accounts/${acct}`)
    return r.ok && r.data.charges_enabled === true
  }
  // 1) forced account
  if (FORCED_CONNECT_ACCOUNT) return (await verify(FORCED_CONNECT_ACCOUNT)) ? FORCED_CONNECT_ACCOUNT : null
  // 2) reuse an already-onboarded operator's account
  const { data } = await admin
    .from('rentivo_operators')
    .select('stripe_account_id')
    .eq('stripe_onboarded', true)
    .not('stripe_account_id', 'is', null)
    .limit(10)
  for (const row of (data ?? []) as { stripe_account_id: string | null }[]) {
    const acct = row.stripe_account_id
    if (acct && acct.startsWith('acct_') && (await verify(acct))) return acct
  }
  // 3) best-effort create a Custom account (usually NOT charges_enabled w/o full onboarding)
  const created = await stripe<{ id?: string; charges_enabled?: boolean }>('POST', 'accounts', {
    type: 'custom',
    country: 'DE',
    'capabilities[card_payments][requested]': 'true',
    'capabilities[transfers][requested]': 'true',
    business_type: 'individual',
    'business_profile[mcc]': '7512',
    'business_profile[url]': 'https://rentivo-itest.example.com',
    'tos_acceptance[date]': String(Math.floor(Date.now() / 1000)),
    'tos_acceptance[ip]': '8.8.8.8',
  })
  if (created.ok && created.data.id && (await verify(created.data.id))) return created.data.id
  return null
}

/** Insert a booking with explicit financial state; returns booking id. */
async function makeBooking(
  admin: SupabaseClient,
  fx: Fixture,
  opts: { userId: string; total: number; deposit: number; depositStatus?: string },
): Promise<string> {
  const today = new Date()
  const start = today.toISOString().slice(0, 10)
  const end = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10)
  const { data, error } = await admin
    .from('rentivo_bookings')
    .insert({
      listing_id: fx.listingId,
      operator_id: fx.operatorRowId,
      owner_type: 'operator',
      user_id: opts.userId,
      guest_name: 'ITest Guest',
      guest_email: `${MARKER}guest@example.com`,
      start_date: start,
      end_date: end,
      total_days: 2,
      price_per_day: 60,
      subtotal: opts.total,
      total_amount: opts.total,
      deposit_amount: opts.deposit,
      currency: 'EUR',
      status: 'pending',
      payment_status: 'pending',
      deposit_status: opts.depositStatus ?? 'none',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`booking insert: ${error?.message}`)
  created.bookingIds.push(data.id as string)
  return data.id as string
}

async function pollBooking(
  admin: SupabaseClient,
  id: string,
  predicate: (row: Record<string, unknown>) => boolean,
  timeoutMs = 20000,
): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + timeoutMs
  let last: Record<string, unknown> | null = null
  while (Date.now() < deadline) {
    const { data } = await admin.from('rentivo_bookings').select('*').eq('id', id).single()
    last = (data as Record<string, unknown>) ?? last
    if (last && predicate(last)) return last
    await sleep(1500)
  }
  return last
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // HARD GUARD — never run against a live Stripe key. Checked FIRST, always.
  if (STRIPE_SECRET && !STRIPE_SECRET.startsWith('sk_test_')) {
    console.error('FATAL: STRIPE_SECRET_KEY is not a test key (must start with sk_test_). Aborting.')
    process.exit(1)
  }

  const haveSupabase = !!(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY)
  const haveStripe = STRIPE_SECRET.startsWith('sk_test_')
  let webhookReady = false
  if (haveStripe && STRIPE_WEBHOOK_SECRET) {
    const eps = await stripe<{ data?: { url?: string; enabled_events?: string[]; status?: string }[] }>(
      'GET', 'webhook_endpoints', { limit: '100' },
    )
    const need = ['payment_intent.succeeded', 'payment_intent.payment_failed', 'setup_intent.succeeded', 'account.updated']
    webhookReady = (eps.data.data ?? []).some((e) => {
      const url = e.url ?? ''
      const evs = e.enabled_events ?? []
      const all = evs.includes('*') || need.every((n) => evs.includes(n))
      return url.includes('stripe-webhook') && e.status !== 'disabled' && all
    })
  }

  // ── Preflight capability matrix (always printed) ──
  console.log('\n══════════ PREFLIGHT / CAPABILITY MATRIX ══════════')
  console.log(`  Supabase config (A-layer):  ${haveSupabase ? 'PRESENT' : 'ABSENT  → CANNOT RUN'}`)
  console.log(`  STRIPE_SECRET_KEY (test):   ${haveStripe ? 'PRESENT' : 'ABSENT  → B/C SKIP'}`)
  console.log(`  STRIPE_WEBHOOK_SECRET:      ${STRIPE_WEBHOOK_SECRET ? 'PRESENT' : 'ABSENT'}`)
  console.log(`  stripe-webhook endpoint:    ${webhookReady ? 'SUBSCRIBED (4 events)' : 'NOT CONFIRMED → C SKIP'}`)

  if (!haveSupabase) {
    console.error('\nFATAL: missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.')
    console.error('       Required for fixtures (createUser, service-role SQL) and cleanup. Provide via CI secrets or .env.')
    process.exit(1)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  // Start clean.
  await cleanupByMarker(admin)

  let runB = false
  let runC = false
  let fx: Fixture | null = null

  try {
    // Build fixture (also resolves the Connect account → decides B/C eligibility).
    const renterAuthId = await createMarkedUser(admin, 'renter')
    const renter2AuthId = await createMarkedUser(admin, 'renter2')
    const operatorAuthId = await createMarkedUser(admin, 'operator')

    const renterEmail = (await admin.auth.admin.getUserById(renterAuthId)).data.user?.email ?? ''
    const renter2Email = (await admin.auth.admin.getUserById(renter2AuthId)).data.user?.email ?? ''
    const operatorEmail = (await admin.auth.admin.getUserById(operatorAuthId)).data.user?.email ?? ''

    const { error: uErr } = await admin.from('rentivo_users').insert([
      { id: renterAuthId, auth_id: renterAuthId, email: renterEmail, name: 'ITest Renter', role: 'traveler' },
      { id: renter2AuthId, auth_id: renter2AuthId, email: renter2Email, name: 'ITest Renter2', role: 'traveler' },
      { id: operatorAuthId, auth_id: operatorAuthId, email: operatorEmail, name: 'ITest Operator', role: 'operator' },
    ])
    if (uErr) throw new Error(`rentivo_users insert: ${uErr.message}`)

    const acct = await resolveConnectAccount(admin)
    const onboarded = acct !== null
    const connectAccountId = acct ?? 'acct_itest_unonboarded'

    const { data: opRow, error: opErr } = await admin
      .from('rentivo_operators')
      .insert({
        auth_id: operatorAuthId,
        name: 'ITest Operator',
        slug: `itest-op-${uuidish()}`,
        email: operatorEmail,
        active: true,
        stripe_account_id: connectAccountId,
        stripe_onboarded: onboarded,
      })
      .select('id')
      .single()
    if (opErr || !opRow) throw new Error(`rentivo_operators insert: ${opErr?.message}`)
    created.operatorIds.push(opRow.id as string)

    const { data: listingRow, error: lErr } = await admin
      .from('rentivo_listings')
      .insert({
        operator_id: opRow.id,
        owner_type: 'operator',
        title: 'ITest Vehicle',
        category: 'car',
        price_per_day: 60,
        deposit_amount: 80,
        currency: 'EUR',
        available: true,
      })
      .select('id')
      .single()
    if (lErr || !listingRow) throw new Error(`rentivo_listings insert: ${lErr?.message}`)
    created.listingIds.push(listingRow.id as string)

    fx = {
      renterAuthId,
      renterJwt: await signIn(renterEmail),
      renter2Jwt: await signIn(renter2Email),
      operatorAuthId,
      operatorJwt: await signIn(operatorEmail),
      operatorRowId: opRow.id as string,
      listingId: listingRow.id as string,
      connectAccountId,
      operatorOnboarded: onboarded,
    }

    runB = haveStripe && onboarded
    runC = runB && webhookReady

    console.log(`  Connect account resolved:   ${onboarded ? connectAccountId + ' (charges_enabled)' : 'NONE → B/C SKIP'}`)
    console.log('═══════════════════════════════════════════════════\n')

    // ─────────── A-LAYER (always) ───────────
    console.log('── A-LAYER  auth/guard (no Stripe, no webhook) ──')
    const TOTAL = 120
    const DEPOSIT = 80

    // A1: create-payment-intent with a DIFFERENT renter → 403
    const bA = await makeBooking(admin, fx, { userId: fx.renterAuthId, total: TOTAL, deposit: DEPOSIT })
    {
      const r = await callFn('create-payment-intent', fx.renter2Jwt, { booking_id: bA })
      const msg = String(r.body.error ?? '')
      check('A1', 'create-payment-intent wrong renter → 403',
        r.status === 403, '403 (ownership)', `${r.status} ${msg}`)
    }

    // A2: charge-deposit owner, deposit_status='none' → 409
    {
      const r = await callFn('charge-deposit', fx.operatorJwt, { booking_id: bA, assessed_amount: 10 })
      check('A2', 'charge-deposit owner, status=none → 409 not chargeable',
        r.status === 409, '409 (not chargeable)', `${r.status} ${String(r.body.error ?? '')}`)
    }

    // A3: charge-deposit renter (not owner) → 403  [critical: stranger cannot charge a saved card]
    {
      const r = await callFn('charge-deposit', fx.renterJwt, { booking_id: bA, assessed_amount: 10 })
      check('A3', 'charge-deposit non-owner renter → 403',
        r.status === 403, '403 (not authorized)', `${r.status} ${String(r.body.error ?? '')}`)
    }

    // A4: deposit_status='authorized' + pm_dummy via SQL; assessed > cap → 400  [critical]
    {
      const { error } = await admin
        .from('rentivo_bookings')
        .update({ deposit_status: 'authorized', deposit_payment_method_id: 'pm_dummy' })
        .eq('id', bA)
      if (error) throw new Error(`A4 fixture update: ${error.message}`)
      const r = await callFn('charge-deposit', fx.operatorJwt, { booking_id: bA, assessed_amount: DEPOSIT + 50 })
      check('A4', 'charge-deposit assessed > deposit cap → 400',
        r.status === 400, '400 (exceeds cap)', `${r.status} ${String(r.body.error ?? '')}`)
    }

    // ─────────── B-LAYER (sync Stripe) ───────────
    console.log('\n── B-LAYER  sync Stripe ──')
    if (!runB) {
      record('B1', 'create-payment-intent → PI shape', 'SKIP')
      record('B2', 'create-payment-intent idempotent', 'SKIP')
    } else {
      const bB = await makeBooking(admin, fx, { userId: fx.renterAuthId, total: TOTAL, deposit: DEPOSIT })
      const r1 = await callFn('create-payment-intent', fx.renterJwt, { booking_id: bB })
      const piId = String(r1.body.payment_intent_id ?? '')
      if (r1.status !== 200 || !piId) {
        check('B1', 'create-payment-intent returns PI', false, '200 + payment_intent_id', `${r1.status} ${JSON.stringify(r1.body)}`)
        record('B2', 'create-payment-intent idempotent', 'SKIP')
      } else {
        const pi = await stripe<{
          amount?: number; currency?: string; application_fee_amount?: number
          transfer_data?: { destination?: string }
        }>('GET', `payment_intents/${piId}`)
        const expFee = Math.round(Math.round(TOTAL * 100) * PLATFORM_CUT)
        const okAmount = pi.data.amount === TOTAL * 100
        const okCurrency = pi.data.currency === 'eur'
        const okDest = pi.data.transfer_data?.destination === fx.connectAccountId
        const okFee = pi.data.application_fee_amount === expFee
        check('B1', 'PI amount/currency/destination/fee match server truth',
          okAmount && okCurrency && okDest && okFee,
          `amount=${TOTAL * 100}, currency=eur, dest=${fx.connectAccountId}, fee=${expFee}`,
          `amount=${pi.data.amount}, currency=${pi.data.currency}, dest=${pi.data.transfer_data?.destination}, fee=${pi.data.application_fee_amount}`)

        const r2 = await callFn('create-payment-intent', fx.renterJwt, { booking_id: bB })
        const piId2 = String(r2.body.payment_intent_id ?? '')
        check('B2', 'second call returns SAME payment_intent_id (idempotent)',
          piId2 === piId, piId, `${piId2} (status ${r2.status})`)
      }
    }

    // ─────────── C-LAYER (webhook-driven) ───────────
    console.log('\n── C-LAYER  webhook-driven ──')
    if (!runC) {
      for (const id of ['C1', 'C2', 'C3', 'C4']) record(id, 'webhook-driven flow', 'SKIP')
    } else {
      const bC = await makeBooking(admin, fx, { userId: fx.renterAuthId, total: TOTAL, deposit: DEPOSIT })

      // C1: confirm rental PI server-side with pm_card_visa → webhook flips paid/confirmed
      const rPi = await callFn('create-payment-intent', fx.renterJwt, { booking_id: bC })
      const piId = String(rPi.body.payment_intent_id ?? '')
      await stripe('POST', `payment_intents/${piId}/confirm`, {
        payment_method: 'pm_card_visa',
        return_url: 'https://rentivo-itest.example.com/return',
      })
      const c1 = await pollBooking(admin, bC, (b) => b.payment_status === 'paid' && b.status === 'confirmed' && !!b.stripe_charge_id)
      check('C1', 'rental webhook → payment_status=paid, status=confirmed, charge id set',
        c1?.payment_status === 'paid' && c1?.status === 'confirmed' && !!c1?.stripe_charge_id,
        'paid/confirmed + stripe_charge_id', `status=${c1?.status}, payment_status=${c1?.payment_status}, charge=${c1?.stripe_charge_id}`)

      // C2: create-deposit-setup → confirm SI with pm_card_visa → webhook flips authorized
      const rSi = await callFn('create-deposit-setup', fx.renterJwt, { booking_id: bC })
      const siId = String(rSi.body.setup_intent_id ?? '')
      await stripe('POST', `setup_intents/${siId}/confirm`, {
        payment_method: 'pm_card_visa',
        return_url: 'https://rentivo-itest.example.com/return',
      })
      const c2 = await pollBooking(admin, bC, (b) => b.deposit_status === 'authorized' && !!b.deposit_payment_method_id)
      check('C2', 'setup_intent webhook → deposit_status=authorized + pm saved',
        c2?.deposit_status === 'authorized' && !!c2?.deposit_payment_method_id,
        'authorized + deposit_payment_method_id', `deposit_status=${c2?.deposit_status}, pm=${c2?.deposit_payment_method_id}`)

      // C3: charge-deposit assessed <= cap → 'charged' + off_session PI succeeded
      if (c2?.deposit_status === 'authorized') {
        const assessed = 40
        const r = await callFn('charge-deposit', fx.operatorJwt, { booking_id: bC, assessed_amount: assessed })
        const depPiId = String(r.body.payment_intent_id ?? '')
        const c3 = await pollBooking(admin, bC, (b) => b.deposit_status === 'charged')
        let piSucceeded = false
        if (depPiId) {
          const dpi = await stripe<{ status?: string }>('GET', `payment_intents/${depPiId}`)
          piSucceeded = dpi.data.status === 'succeeded'
        }
        check('C3', 'charge-deposit ≤ cap → charged + off_session PI succeeded',
          r.status === 200 && String(r.body.deposit_status) === 'charged' &&
            c3?.deposit_status === 'charged' && Number(c3?.deposit_charged_amount) === assessed && piSucceeded,
          `200 charged, deposit_charged_amount=${assessed}, PI succeeded`,
          `${r.status} ${String(r.body.deposit_status)}, db=${c3?.deposit_status}/${c3?.deposit_charged_amount}, piSucceeded=${piSucceeded}`)
      } else {
        record('C3', 'charge-deposit ≤ cap → charged', 'SKIP')
      }

      // C4: failure branch — vault a declining card, charge → 402 + charge_failed
      const bC4 = await makeBooking(admin, fx, { userId: fx.renterAuthId, total: TOTAL, deposit: DEPOSIT })
      const rSi4 = await callFn('create-deposit-setup', fx.renterJwt, { booking_id: bC4 })
      const siId4 = String(rSi4.body.setup_intent_id ?? '')
      await stripe('POST', `setup_intents/${siId4}/confirm`, {
        payment_method: 'pm_card_chargeCustomerFail',
        return_url: 'https://rentivo-itest.example.com/return',
      })
      const c4auth = await pollBooking(admin, bC4, (b) => b.deposit_status === 'authorized' && !!b.deposit_payment_method_id)
      if (c4auth?.deposit_status === 'authorized') {
        const r = await callFn('charge-deposit', fx.operatorJwt, { booking_id: bC4, assessed_amount: 30 })
        const c4 = await pollBooking(admin, bC4, (b) => b.deposit_status === 'charge_failed', 10000)
        check('C4', 'declining card → 402 + deposit_status=charge_failed',
          r.status === 402 && c4?.deposit_status === 'charge_failed',
          '402 + charge_failed', `${r.status} ${String(r.body.error ?? '')}, db=${c4?.deposit_status}`)
      } else {
        record('C4', 'declining card → charge_failed (setup not authorized in time)', 'SKIP')
      }
    }
  } finally {
    // CLEANUP — delete test rows + auth users (test Stripe objects may remain).
    console.log('\n── CLEANUP ──')
    await cleanupByMarker(admin).catch((e) => console.error('cleanup error:', e))
    console.log('  test rows + auth users removed.')
  }

  // ─────────── Summary ───────────
  console.log('\n══════════ ASSERTION TABLE ══════════')
  console.log('  ID    STATUS  DESCRIPTION')
  for (const a of results) {
    console.log(`  ${a.id.padEnd(4)}  ${a.status.padEnd(6)}  ${a.desc}`)
    if (a.status === 'FAIL') {
      console.log(`         expected: ${a.expected}`)
      console.log(`         actual:   ${a.actual}`)
    }
  }
  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  const skip = results.filter((r) => r.status === 'SKIP').length
  console.log(`\n  TOTAL: ${pass} PASS, ${fail} FAIL, ${skip} SKIP`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err)
  process.exit(1)
})
