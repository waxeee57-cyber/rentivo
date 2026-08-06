/**
 * End-to-end proof of the cancellation + refund matrix, against the REAL deployed
 * edge functions, the REAL database and REAL Stripe test-mode money.
 *
 * Nothing here is mocked. Every cell books a vehicle, pays it with a real test
 * card, waits for the real webhook, calls the real `cancel-booking` function and
 * then reads the resulting Refund, Charge and Transfer back OUT of Stripe.
 *
 * Three numbers have to agree for every cell, and the script asserts all three:
 *
 *   SPEC    — the policy as written down in the task/product rules, re-stated
 *             independently in `expectedPercent()` below.
 *   SERVER  — what supabase/functions/cancel-booking/index.ts actually computed.
 *   CLIENT  — what lib/utils/cancellation.ts tells the renter they will get,
 *             loaded from the REAL TypeScript source (transpiled at run time,
 *             never re-typed here — a copy of the rule would prove nothing).
 *
 * A renter shown "100% refund" who receives 50% is the worst defect this flow
 * can have. CLIENT === SERVER is therefore asserted for every single cell.
 *
 * Run from the repo root:  node scripts/e2e/cancellation-matrix.mjs
 *
 * ── The one privileged step ────────────────────────────────────────────────
 * Timing bands are a function of the booking's own start_date, so the matrix
 * needs bookings that start in a few hours. Bookings are CREATED inside the date
 * window FIXTURES.cancellation declares (so nothing near-term is ever held), and
 * their start_date is then moved with a single SQL UPDATE. start_date is not in
 * the `authenticated` column grant, so no client token can do it — which is
 * itself asserted below. The script prints the statement and waits for it.
 *
 * That statement is the one thing scripts/e2e/all.mjs cannot drive for itself,
 * and it is why this suite pauses in the middle of a full run. all.mjs prints
 * the same SQL up front so it can be fired the moment the pause is reached.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import ts from 'typescript'
import {
  sb, stripe, signIn, createBooking, payBooking, cancelBooking,
  step, section, finish, sleep, day, TEST_CONNECT_ACCOUNT,
} from './_lib.mjs'
import {
  FIXTURES, CANCELLATION_LISTINGS, PRIVATE_OPERATORS, assertFixture,
} from './fixtures.mjs'

// ── Fixtures ────────────────────────────────────────────────────────────────
//
// Operator-owned COPIES of the Sea Ray Sundancer fixture, seeded for this task
// and pointed at an operator row whose auth_id is the e2e-cancelop account below.
// The original 2ef4cd6e-… listing and the operator that owns it are untouched.
//
// One listing per (policy x canceller) so that two cells in different timing
// bands never collide on rentivo_bookings_no_overlap, and one spare for the
// non-matrix scenarios. They live in fixtures.mjs now, where every other suite
// can see that these eight ids are spoken for — fixtures.mjs had `cancellation`
// pointing at the seeded Porsche Cayenne, which belongs to the PROJECT OWNER's
// operator and is not one of these at all.
const L = CANCELLATION_LISTINGS
const OPERATOR_ID = PRIVATE_OPERATORS.cancellation
const FX = FIXTURES.cancellation

const TRAVELER = ['e2e-cancel@rentivo.domrol.com', 'e2e-Cancel-Pass-2026!']
const OWNER    = ['e2e-cancelop@rentivo.domrol.com', 'e2e-CancelOp-Pass-2026!']
const STRANGER = ['e2e-cancelstranger@rentivo.domrol.com', 'e2e-CancelStranger-Pass-2026!']

/** Marker written into `notes`; the shift statement keys off it. */
const TAG = 'E2E-CANCEL-MATRIX'
const SHIFT_TIMEOUT_MS = Number(process.env.E2E_SHIFT_TIMEOUT_MS ?? 900000)

// Bookings are created inside this suite's own window and nowhere else. The base
// used to be `300 + random(30)`, which is what you write when you cannot know
// what is free: a completed booking is terminal and keeps holding its dates on
// purpose, so every run had to hope it landed somewhere clear. `pickFarBase`
// below looks instead, and takes the first base whose 26-day span holds no LIVE
// booking on any of the eight listings.
const MATRIX_OFFSETS = [0, 3, 6]
const SCENARIO_OFFSETS = [12, 15, 18, 21, 24]
const SPAN = 26
let FAR_BASE = FX.from
/** Slot k for a matrix listing (k = 0..2) — three days apart, never adjacent. */
const slot = k => FAR_BASE + MATRIX_OFFSETS[k]
/** Slot k for the shared scenarios listing (k = 0..4), clear of the matrix ones. */
const scenarioSlot = k => FAR_BASE + SCENARIO_OFFSETS[k]

// ── SPEC ────────────────────────────────────────────────────────────────────
// The product rule, re-stated here independently of both implementations so a
// shared bug in server+client cannot pass unnoticed.
//   flexible : 100% at 24h or more before start, else 0
//   moderate : 100% at 48h+, 50% at 24-48h, 0 under 24h
//   strict   : 100% at 72h+, else 0
//   owner-initiated: always 100% — the renter did nothing wrong.
function expectedPercent(policy, hoursUntilStart, by) {
  if (by === 'owner') return 100
  if (policy === 'flexible') return hoursUntilStart >= 24 ? 100 : 0
  if (policy === 'strict') return hoursUntilStart >= 72 ? 100 : 0
  if (hoursUntilStart >= 48) return 100
  if (hoursUntilStart >= 24) return 50
  return 0
}

/** The refund in euros, to the cent — what the money must actually be. */
const expectedAmount = (total, percent) => Math.round(total * percent) / 100

/**
 * Every cell of the matrix.
 *
 * `d` is the day offset the booking's start_date is moved to. start_date is a
 * DATE, so it always resolves to UTC midnight and hoursUntilStart is
 * `d * 24 - (hours elapsed today, UTC)` — which lands strictly inside one band
 * for every d. `band` records which band that is meant to be; the script
 * re-derives the band from the start_date it actually reads back and fails if
 * the cell did not land where it was aimed.
 * `k` is which of the three matrix slots the booking is CREATED on, before the
 * shift; `far` is filled in once pickFarBase() has chosen the base.
 */
const CELLS = [
  { id: 'FLEX/>=24h/traveler', listing: L.flexTraveler, policy: 'flexible', d: 2, k: 0, by: 'traveler', band: '>=24h' },
  { id: 'FLEX/<24h/traveler',  listing: L.flexTraveler, policy: 'flexible', d: 1, k: 1, by: 'traveler', band: '<24h' },
  { id: 'MOD/>=48h/traveler',  listing: L.modTraveler,  policy: 'moderate', d: 3, k: 0, by: 'traveler', band: '>=48h' },
  { id: 'MOD/24-48h/traveler', listing: L.modTraveler,  policy: 'moderate', d: 2, k: 1, by: 'traveler', band: '24-48h' },
  { id: 'MOD/<24h/traveler',   listing: L.modTraveler,  policy: 'moderate', d: 1, k: 2, by: 'traveler', band: '<24h' },
  { id: 'STRICT/>=72h/traveler', listing: L.strTraveler, policy: 'strict', d: 4, k: 0, by: 'traveler', band: '>=72h' },
  { id: 'STRICT/<72h/traveler',  listing: L.strTraveler, policy: 'strict', d: 3, k: 1, by: 'traveler', band: '<72h' },
  { id: 'MOD-odd/24-48h/traveler', listing: L.modOdd,   policy: 'moderate', d: 2, k: 0, by: 'traveler', band: '24-48h' },
  { id: 'FLEX/>=24h/owner', listing: L.flexOwner, policy: 'flexible', d: 2, k: 0, by: 'owner', band: '>=24h' },
  { id: 'FLEX/<24h/owner',  listing: L.flexOwner, policy: 'flexible', d: 1, k: 1, by: 'owner', band: '<24h' },
  { id: 'MOD/>=48h/owner',  listing: L.modOwner,  policy: 'moderate', d: 3, k: 0, by: 'owner', band: '>=48h' },
  { id: 'MOD/24-48h/owner', listing: L.modOwner,  policy: 'moderate', d: 2, k: 1, by: 'owner', band: '24-48h' },
  { id: 'MOD/<24h/owner',   listing: L.modOwner,  policy: 'moderate', d: 1, k: 2, by: 'owner', band: '<24h' },
  { id: 'STRICT/>=72h/owner', listing: L.strOwner, policy: 'strict', d: 4, k: 0, by: 'owner', band: '>=72h' },
  { id: 'STRICT/<72h/owner',  listing: L.strOwner, policy: 'strict', d: 3, k: 1, by: 'owner', band: '<72h' },
]

/** Which band a measured hoursUntilStart falls in, per policy. */
function bandOf(policy, h) {
  if (policy === 'flexible') return h >= 24 ? '>=24h' : '<24h'
  if (policy === 'strict') return h >= 72 ? '>=72h' : '<72h'
  return h >= 48 ? '>=48h' : h >= 24 ? '24-48h' : '<24h'
}

/** Distance in hours from the nearest band edge — margin against clock skew. */
function bandMargin(policy, h) {
  const edges = policy === 'flexible' ? [24] : policy === 'strict' ? [72] : [24, 48]
  return Math.min(...edges.map(e => Math.abs(h - e)))
}

// ── The REAL client rule, loaded from the REAL TypeScript source ────────────
//
// lib/utils/cancellation.ts is what the booking screen shows the renter before
// they confirm. Re-typing its logic here would prove nothing, so it is
// transpiled (types stripped, no other transformation) and imported. Its only
// runtime import is `t` from constants/i18n.ts, which is emitted alongside it and
// re-pointed at the emitted copy; `@/types` is an `import type` and disappears.
const CACHE = resolve('node_modules/.cache/rentivo-e2e-cancel')

function emitModule(srcPath, outName, rewrites = {}) {
  const source = readFileSync(srcPath, 'utf8')
  let js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  for (const [from, to] of Object.entries(rewrites)) js = js.split(`'${from}'`).join(`'${to}'`)
  const out = resolve(CACHE, outName)
  writeFileSync(out, js)
  return pathToFileURL(out).href
}

mkdirSync(CACHE, { recursive: true })
emitModule('constants/i18n.ts', 'i18n.mjs')
const clientMod = await import(
  emitModule('lib/utils/cancellation.ts', 'cancellation.mjs', { '@/constants/i18n': './i18n.mjs' })
)
const clientRefund = clientMod.calculateCancellationRefund

/**
 * What the CLIENT would put in front of the renter for this cell.
 *
 * `cancelledBy` is passed positionally after `now`; a build of cancellation.ts
 * that does not accept it simply ignores the argument, and the owner cells then
 * fail the parity assertion rather than being quietly skipped.
 */
const clientSays = (policy, startDate, total, now, by) =>
  clientRefund(policy, startDate, total, 'en', now, by)

// ── Small helpers ───────────────────────────────────────────────────────────

async function login(label, [email, password]) {
  const s = await signIn(email, password)
  if (!s.token) {
    console.error(`\nCould not sign in ${label} (${email}).`)
    if (s.needsConfirmation) {
      console.error(`  update auth.users set email_confirmed_at = now() where email = '${email}';`)
    } else {
      console.error(JSON.stringify(s.error))
    }
    process.exit(1)
  }
  return s
}

/** REST read as `token`, always as an array so callers can assert on length. */
async function rows(token, path) {
  const r = await sb(`/rest/v1/${path}`, {}, token)
  return { status: r.status, body: r.body, list: Array.isArray(r.body) ? r.body : [] }
}

/** PATCH returning the affected rows, so a zero-row update is visible. */
async function patch(token, table, filter, payload) {
  return sb(`/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  }, token)
}

/** Stripe GET. `stripe()` only sends a body for a truthy params argument. */
const get = path => stripe(path, null, 'GET')

/** Exactly what cancel-booking computes: start_date is a DATE, so UTC midnight. */
const hoursUntil = startDate => (Date.parse(startDate) - Date.now()) / 3600000

/**
 * Create a booking on `listing` for a single day at +`far`, and (unless
 * `pay: false`) take it all the way to paid through the real PaymentIntent, the
 * real test card and the real webhook.
 */
async function book(token, { listing, far, note, pay = true }) {
  const res = await createBooking(token, {
    listingId: listing,
    start: day(far),
    end: day(far + 1),
    extra: { notes: note },
  })
  const id = res.body?.booking_id ?? res.body?.booking?.id ?? res.body?.id
  if (res.status !== 200 || !id) {
    step(false, `create booking on ${listing.slice(-4)} @+${far}d`, `${res.status} ${JSON.stringify(res.body).slice(0, 180)}`)
    return null
  }
  if (!pay) return { id, total: res.body?.total_amount ?? 0, paid: false }

  const paid = await payBooking(token, id)
  if (!paid.ok) {
    step(false, `pay booking ${id}`, `${paid.stage}: ${JSON.stringify(paid.detail).slice(0, 180)}`)
    return null
  }
  return { id, total: res.body?.total_amount ?? 0, paid: true, piId: paid.piId }
}

// ── Sign in ─────────────────────────────────────────────────────────────────

const traveler = await login('traveler', TRAVELER)
const owner = await login('owner', OWNER)
const stranger = await login('stranger', STRANGER)

section('Setup — three distinct identities, and the owner really owns the fixtures')
step(!!traveler.token, 'traveler signed in', traveler.uid)
step(!!owner.token, 'owner signed in', owner.uid)
step(!!stranger.token, 'stranger signed in', stranger.uid)
step(new Set([traveler.uid, owner.uid, stranger.uid]).size === 3, 'the three identities are distinct')

const op = await rows(owner.token, `rentivo_operators?id=eq.${OPERATOR_ID}&select=id,auth_id,stripe_account_id,stripe_onboarded`)
step(op.list[0]?.auth_id === owner.uid, 'the seeded operator row belongs to the owner account', op.list[0]?.auth_id)
step(op.list[0]?.stripe_account_id === TEST_CONNECT_ACCOUNT, 'operator points at the test Connect account', op.list[0]?.stripe_account_id)

const fixtures = await rows(traveler.token, `rentivo_listings?id=in.(${Object.values(L).join(',')})&select=id,cancellation_policy,price_per_day,operator_id`)
step(fixtures.list.length === Object.keys(L).length, 'all fixture listings exist', `n=${fixtures.list.length}`)
step(
  fixtures.list.every(l => l.operator_id === OPERATOR_ID),
  'every fixture listing is owned by the seeded operator, not the original one',
)
const policyOf = Object.fromEntries(fixtures.list.map(l => [l.id, l.cancellation_policy]))
step(
  CELLS.every(c => policyOf[c.listing] === c.policy),
  'each cell listing carries the cancellation_policy the cell tests',
  CELLS.filter(c => policyOf[c.listing] !== c.policy).map(c => c.id).join(',') || 'all match',
)

// Fail loudly on the wrong vehicle rather than quietly refunding somebody else's.
const declared = await assertFixture(sb, 'cancellation', traveler.token)
step(true, 'cancellation fixture is ours', `${declared.row.title}, +${FX.from}..+${FX.to}`)

/**
 * The first base whose whole span is free of LIVE bookings on all eight listings.
 *
 * The completed-booking case at scenarioSlot(3) is terminal on purpose and keeps
 * holding its night forever, so the base does have to move — but by looking, not
 * by rolling a die and hoping. It advances one day per run, which gives roughly
 * (window width - span) runs before the window is genuinely full; that is a
 * fixture fact worth failing loudly on rather than colliding over.
 */
async function pickFarBase(token) {
  const ids = Object.values(L)
  const live = await rows(token,
    `rentivo_bookings?listing_id=in.(${ids.join(',')})&status=neq.cancelled`
    + `&start_date=gte.${day(FX.from)}&start_date=lte.${day(FX.to)}&select=listing_id,start_date`)
  const taken = new Set(live.list.map(b => `${b.listing_id}|${b.start_date}`))
  for (let base = FX.from; base <= FX.to - SPAN; base++) {
    const needed = []
    for (const id of ids) for (const k of MATRIX_OFFSETS) needed.push(`${id}|${day(base + k)}`)
    for (const k of SCENARIO_OFFSETS) needed.push(`${L.scenarios}|${day(base + k)}`)
    if (needed.every(n => !taken.has(n))) return base
  }
  return null
}

const picked = await pickFarBase(traveler.token)
if (picked === null) {
  step(false, `a free ${SPAN}-day base inside +${FX.from}..+${FX.to}`,
    'every base is blocked by a live booking — the completed-rental fixtures have filled the window')
  finish()
}
FAR_BASE = picked
for (const c of CELLS) c.far = slot(c.k)
step(true, 'this run owns a free base', `+${FAR_BASE}..+${FAR_BASE + SPAN}`)

// ── Phase 1 — book and pay every cell, inside this suite's own window ───────

section(`Phase 1 — ${CELLS.length} paid bookings, created at +${slot(0)}..+${scenarioSlot(4)} days`)

for (const c of CELLS) {
  const made = await book(traveler.token, {
    listing: c.listing,
    far: c.far,
    note: `${TAG}:${c.id}:shift=${c.d}`,
  })
  if (!made) { c.failed = true; continue }
  c.bookingId = made.id
  c.total = made.total
  c.piId = made.piId
  step(true, `${c.id} — booked and paid`, `${made.id} EUR ${made.total} @+${c.far}d`)
}

const live = CELLS.filter(c => c.bookingId)
step(live.length === CELLS.length, 'every matrix cell has a paid booking', `${live.length}/${CELLS.length}`)
if (live.length === 0) finish()

// ── The privileged step — move start_date into the band under test ──────────

section('Phase 1b — start_date shift (the one statement no client token can run)')

// Proof that this genuinely needs the service role: `start_date` is not in the
// UPDATE column grant for `authenticated`, so a renter cannot move their own
// booking forward and cash out at 100% under a strict policy.
const TAMPER_DAY = day(FAR_BASE + SPAN + 1)
const tamper = await patch(traveler.token, 'rentivo_bookings', `id=eq.${live[0].bookingId}`, {
  start_date: TAMPER_DAY,
})
step(
  tamper.status >= 400,
  'a traveler CANNOT move their own start_date (the refund band is not client-settable)',
  `${tamper.status} ${JSON.stringify(tamper.body).slice(0, 140)}`,
)
// Asserted as "the value the traveler asked for did not land", not as "the value
// is still the creation date". The privileged shift below is applied by a human
// out of band, and if it happens to land between the PATCH and this read the
// second form fails on a booking nothing went wrong with — an authorisation
// assertion should not depend on the timing of an unrelated statement.
// TAMPER_DAY is outside every legitimate value this column can hold here (the
// creation slot, or the shifted band date), so it is a complete test on its own.
const untampered = await rows(traveler.token, `rentivo_bookings?id=eq.${live[0].bookingId}&select=start_date`)
const afterTamper = untampered.list[0]?.start_date
step(
  afterTamper !== TAMPER_DAY && (afterTamper === day(live[0].far) || afterTamper === day(live[0].d)),
  'and the start_date the traveler asked for did NOT land',
  `${afterTamper} (tried ${TAMPER_DAY}, created at ${day(live[0].far)}, band target ${day(live[0].d)})`,
)

// `created_at > now() - interval '3 hours'` is not cosmetic. The tag matches
// every booking this suite has ever made, and an interrupted run leaves paid,
// un-cancelled cells behind carrying it. Without the age filter the statement
// dragged those old rows onto the same near-term dates as this run's cells and
// the UPDATE died on rentivo_bookings_no_overlap — which reads as "the shift
// never happened" and times the suite out fifteen minutes later.
const SHIFT_SQL = `update public.rentivo_bookings b
set start_date = current_date + (substring(b.notes from 'shift=([0-9]+)'))::int,
    end_date   = current_date + (substring(b.notes from 'shift=([0-9]+)'))::int + 1
where b.notes like '${TAG}:%shift=%'
  and b.status <> 'cancelled'
  and b.created_at > now() - interval '3 hours'
  and b.start_date > current_date + 200;`

console.log('\n  Run this with the service role (Supabase MCP execute_sql), then this')
console.log('  script continues on its own:\n')
console.log(SHIFT_SQL.split('\n').map(l => '    ' + l).join('\n'))
console.log('')

const deadline = Date.now() + SHIFT_TIMEOUT_MS
let shifted = false
while (Date.now() < deadline) {
  const ids = live.map(c => c.bookingId).join(',')
  const r = await rows(traveler.token, `rentivo_bookings?id=in.(${ids})&select=id,start_date,end_date`)
  if (r.status !== 200) {
    step(false, 'poll booking dates', `${r.status} ${JSON.stringify(r.body).slice(0, 140)}`)
    break
  }
  const byId = Object.fromEntries(r.list.map(b => [b.id, b]))
  if (live.every(c => byId[c.bookingId]?.start_date === day(c.d))) {
    for (const c of live) { c.startDate = byId[c.bookingId].start_date; c.endDate = byId[c.bookingId].end_date }
    shifted = true
    break
  }
  process.stdout.write('.')
  await sleep(5000)
}
console.log('')
step(shifted, 'every cell start_date moved into its target band', shifted ? 'ok' : `timed out after ${SHIFT_TIMEOUT_MS}ms`)
if (!shifted) finish()

// ── Phase 2 — cancel every cell and follow the money ────────────────────────

section('Phase 2 — the matrix')

const results = []

for (const c of live) {
  const measuredBefore = hoursUntil(c.startDate)
  const band = bandOf(c.policy, measuredBefore)
  const margin = bandMargin(c.policy, measuredBefore)
  step(
    band === c.band,
    `${c.id} — landed in the intended timing band`,
    `start=${c.startDate} h=${measuredBefore.toFixed(2)} band=${band}`,
  )
  step(
    margin >= 0.25,
    `${c.id} — band has margin against clock skew`,
    `${margin.toFixed(2)}h from the nearest edge`,
  )

  // The authoritative total is the one create-payment-intent healed onto the row
  // and actually charged, not the figure create-booking first quoted.
  const before = await rows(traveler.token, `rentivo_bookings?id=eq.${c.bookingId}&select=total_amount,payment_status,payment_intent_id`)
  c.total = Number(before.list[0]?.total_amount ?? c.total)
  c.piId = before.list[0]?.payment_intent_id ?? c.piId
  step(before.list[0]?.payment_status === 'paid', `${c.id} — paid before we cancel it`, before.list[0]?.payment_status)

  const specPercent = expectedPercent(c.policy, measuredBefore, c.by)
  const specAmount = expectedAmount(c.total, specPercent)

  // What the renter is shown, computed from the REAL client source at the same
  // instant the server is about to compute its own answer.
  const now = new Date()
  const client = clientSays(c.policy, c.startDate, c.total, now, c.by)

  const token = c.by === 'owner' ? owner.token : traveler.token
  const res = await cancelBooking(token, c.bookingId)
  step(res.status === 200, `${c.id} — cancel accepted`, `${res.status} ${JSON.stringify(res.body).slice(0, 160)}`)

  const serverPercent = res.body?.refund_percent
  const serverAmount = res.body?.refund_amount
  const refundId = res.body?.refund_id ?? null

  step(serverPercent === specPercent, `${c.id} — SERVER percent matches the spec`, `spec=${specPercent} server=${serverPercent}`)
  step(serverAmount === specAmount, `${c.id} — SERVER amount matches the spec`, `spec=${specAmount} server=${serverAmount}`)
  step(res.body?.policy === c.policy, `${c.id} — server used the LISTING policy`, `${res.body?.policy}`)

  // The assertion this whole script exists for.
  step(
    client.refundPercent === serverPercent,
    `${c.id} — CLIENT percent === SERVER percent`,
    `client=${client.refundPercent} server=${serverPercent}`,
  )
  step(
    client.refundAmount === serverAmount,
    `${c.id} — CLIENT amount === SERVER amount (to the cent)`,
    `client=${client.refundAmount} server=${serverAmount}`,
  )

  const after = await rows(traveler.token, `rentivo_bookings?id=eq.${c.bookingId}&select=status,payment_status,refund_amount,refund_id,cancelled_at`)
  const row = after.list[0] ?? {}
  step(row.status === 'cancelled', `${c.id} — booking is cancelled`, row.status)
  const wantStatus = specPercent === 100 ? 'refunded' : specPercent === 0 ? 'paid' : 'partially_refunded'
  step(row.payment_status === wantStatus, `${c.id} — payment_status`, `want=${wantStatus} got=${row.payment_status}`)
  step(Number(row.refund_amount) === specAmount, `${c.id} — refund_amount persisted`, String(row.refund_amount))
  step(
    specPercent > 0 ? row.refund_id === refundId && !!refundId : row.refund_id === null,
    `${c.id} — refund_id persisted`,
    String(row.refund_id),
  )
  step(!!row.cancelled_at, `${c.id} — cancelled_at stamped`, row.cancelled_at)

  // ── The money, read back out of Stripe.
  let stripeStatus = 'none'
  let reversal = null
  let feeRefunded = null
  if (specPercent > 0) {
    step(!!refundId, `${c.id} — a Stripe refund id came back`, refundId ?? 'NONE')
    const refund = (await get(`/refunds/${refundId}`)).body
    stripeStatus = refund?.status ?? 'error'
    step(
      refund?.status === 'succeeded' || refund?.status === 'pending',
      `${c.id} — STRIPE refund status`,
      `${refund?.status}`,
    )
    step(
      refund?.amount === Math.round(specAmount * 100),
      `${c.id} — STRIPE refund amount === the amount the function reported`,
      `stripe=${refund?.amount} want=${Math.round(specAmount * 100)}`,
    )
    step(refund?.currency === 'eur', `${c.id} — refund currency`, refund?.currency)

    const charge = (await get(`/charges/${refund?.charge}`)).body
    step(
      charge?.amount_refunded === refund?.amount,
      `${c.id} — the CHARGE shows exactly that much refunded`,
      `amount=${charge?.amount} refunded=${charge?.amount_refunded}`,
    )
    step(
      charge?.transfer_data?.destination === TEST_CONNECT_ACCOUNT,
      `${c.id} — the charge really was a Connect destination charge`,
      charge?.transfer_data?.destination,
    )

    // reverse_transfer: the money has to come back OUT of the connected account,
    // proportionally. Without it the platform funds the whole refund itself.
    step(!!refund?.transfer_reversal, `${c.id} — refund carries a transfer reversal`, String(refund?.transfer_reversal))
    const transfer = (await get(`/transfers/${charge?.transfer}`)).body
    const wantReversed = Math.round(transfer?.amount * (refund?.amount / charge?.amount))
    reversal = transfer?.amount_reversed
    step(
      Math.abs((transfer?.amount_reversed ?? -1) - wantReversed) <= 1,
      `${c.id} — the transfer was reversed proportionally`,
      // The connected account settles in its own currency, so these figures are
      // the FX-converted payout, not the EUR charge. The RATIO is the assertion.
      `transfer=${transfer?.amount} ${transfer?.currency} reversed=${transfer?.amount_reversed} want=${wantReversed}`,
    )
    step(
      transfer?.destination === TEST_CONNECT_ACCOUNT,
      `${c.id} — reversed against the right connected account`,
      transfer?.destination,
    )

    // refund_application_fee: the platform's cut goes back proportionally too.
    step(!!charge?.application_fee, `${c.id} — the charge carries an application fee`, String(charge?.application_fee))
    if (charge?.application_fee) {
      const fee = (await get(`/application_fees/${charge.application_fee}`)).body
      const wantFee = Math.round(fee?.amount * (refund?.amount / charge?.amount))
      feeRefunded = fee?.amount_refunded
      step(
        Math.abs((fee?.amount_refunded ?? -1) - wantFee) <= 1,
        `${c.id} — the application fee was refunded proportionally`,
        `fee=${fee?.amount} refunded=${fee?.amount_refunded} want=${wantFee}`,
      )
    }
  } else {
    step(refundId === null, `${c.id} — NO Stripe refund was created for a 0% cell`, String(refundId))
    const list = (await get(`/refunds?payment_intent=${c.piId}&limit=10`)).body
    step(
      (list?.data?.length ?? -1) === 0,
      `${c.id} — Stripe holds no refund at all against this PaymentIntent`,
      `n=${list?.data?.length}`,
    )
  }

  results.push({
    cell: c.id, policy: c.policy, by: c.by, band,
    hours: measuredBefore.toFixed(2), total: c.total,
    specPercent, serverPercent, clientPercent: client.refundPercent,
    specAmount, serverAmount, clientAmount: client.refundAmount,
    stripeStatus, paymentStatus: row.payment_status, reversal, feeRefunded,
  })
}

// ── Partial refund — the CHECK constraint that used to reject it ────────────

section('Partial refund — the 50% band must SURVIVE the write, not just the refund')

// The UPDATE runs AFTER stripe.refunds.create. When 'partially_refunded' was not
// in rentivo_bookings_payment_status_check, the money left Stripe and the write
// then threw: a refunded booking that still looked active and paid. These cells
// prove the whole sequence now completes.
const halves = results.filter(r => r.specPercent === 50)
step(halves.length >= 2, 'the 50% band was exercised', `${halves.length} cells`)
for (const r of halves) {
  step(r.paymentStatus === 'partially_refunded', `${r.cell} — payment_status is partially_refunded`, r.paymentStatus)
  step(r.serverAmount * 2 === r.total, `${r.cell} — exactly half the money went back`, `${r.serverAmount} of ${r.total}`)
}

// ── Unpaid cancellation ─────────────────────────────────────────────────────

section('Unpaid cancellation — refunds nothing and never touches Stripe')

const unpaid = await book(traveler.token, { listing: L.scenarios, far: scenarioSlot(4), note: `${TAG}:unpaid`, pay: false })
step(!!unpaid?.id, 'unpaid booking created', unpaid?.id)
if (unpaid?.id) {
  const pre = await rows(traveler.token, `rentivo_bookings?id=eq.${unpaid.id}&select=status,payment_status,payment_intent_id`)
  step(pre.list[0]?.payment_status === 'pending', 'it really is unpaid', pre.list[0]?.payment_status)
  step(pre.list[0]?.payment_intent_id === null, 'and it has no PaymentIntent at all', String(pre.list[0]?.payment_intent_id))

  // The screen must not have promised anything in the first place. This is the
  // REAL gate app/(consumer)/bookings/[id].tsx uses, run against the REAL row.
  step(
    clientMod.shouldShowRefundEstimate(pre.list[0]?.status ?? 'pending', pre.list[0]?.payment_status) === false,
    'the booking screen shows NO refund estimate for an unpaid booking',
    `status=${pre.list[0]?.status} payment_status=${pre.list[0]?.payment_status}`,
  )

  const res = await cancelBooking(traveler.token, unpaid.id)
  step(res.status === 200, 'unpaid cancel accepted', `${res.status} ${JSON.stringify(res.body).slice(0, 140)}`)
  step(res.body?.refund_amount === 0, 'refund amount is 0', String(res.body?.refund_amount))
  step(res.body?.refund_id == null, 'no Stripe refund object was created', String(res.body?.refund_id))

  // Documented, not asserted as correct: cancel-booking reports the POLICY
  // percent even when nothing was paid, so an unpaid cancellation answers
  // {refund_amount: 0, refund_percent: 100}. lib/api/bookings.ts refuses to pass
  // that 100 on; the edge function itself still needs the fix (see the report).
  console.log(`  NOTE  the function reported refund_percent=${res.body?.refund_percent} for a EUR 0 refund`)
  const apiSrc = readFileSync('lib/api/bookings.ts', 'utf8')
  step(
    /refundAmount\s*>\s*0\s*\?\s*\(raw\.refund_percent/.test(apiSrc),
    'lib/api/bookings.ts reports 0% when 0 euros moved, whatever the function says',
  )

  const after = await rows(traveler.token, `rentivo_bookings?id=eq.${unpaid.id}&select=status,payment_status,refund_amount,refund_id`)
  step(after.list[0]?.status === 'cancelled', 'booking is cancelled', after.list[0]?.status)
  step(after.list[0]?.payment_status === 'pending', 'payment_status is left alone', after.list[0]?.payment_status)
  step(Number(after.list[0]?.refund_amount) === 0, 'refund_amount is 0', String(after.list[0]?.refund_amount))
  step(after.list[0]?.refund_id === null, 'refund_id stays null', String(after.list[0]?.refund_id))
}

// ── Double cancellation ─────────────────────────────────────────────────────

section('Double cancellation — idempotent, and there is no second refund')

const twice = await book(traveler.token, { listing: L.scenarios, far: scenarioSlot(1), note: `${TAG}:double` })
step(!!twice?.id, 'booking for the double-cancel created and paid', twice?.id)
if (twice?.id) {
  const first = await cancelBooking(traveler.token, twice.id)
  step(first.status === 200 && first.body?.cancelled === true, 'first cancel refunded', JSON.stringify(first.body).slice(0, 160))
  step(first.body?.refund_amount > 0, 'and it moved real money', String(first.body?.refund_amount))

  const second = await cancelBooking(traveler.token, twice.id)
  step(second.status === 200, 'second cancel is accepted, not an error', String(second.status))
  step(second.body?.already_cancelled === true, 'second cancel reports already_cancelled', JSON.stringify(second.body).slice(0, 140))
  step(second.body?.refund_amount === 0, 'second cancel refunds nothing', String(second.body?.refund_amount))

  // The proof that matters: ask STRIPE, not our own row.
  const list = (await get(`/refunds?payment_intent=${twice.piId}&limit=10`)).body
  step(
    (list?.data?.length ?? -1) === 1,
    'Stripe holds EXACTLY ONE refund against this PaymentIntent',
    `n=${list?.data?.length} ids=${(list?.data ?? []).map(r => r.id).join(',')}`,
  )
  step(
    list?.data?.[0]?.id === first.body?.refund_id,
    'and it is the one the first call created',
    `${list?.data?.[0]?.id} vs ${first.body?.refund_id}`,
  )
  const chg = (await get(`/charges/${list?.data?.[0]?.charge}`)).body
  step(
    chg?.amount_refunded === list?.data?.[0]?.amount,
    'the charge was not refunded twice',
    `amount=${chg?.amount} refunded=${chg?.amount_refunded}`,
  )
}

// ── A stranger cannot cancel someone else's booking ─────────────────────────

section("A stranger cannot cancel someone else's booking")

const victim = await book(traveler.token, { listing: L.scenarios, far: scenarioSlot(2), note: `${TAG}:stranger` })
step(!!victim?.id, 'victim booking created and paid', victim?.id)
if (victim?.id) {
  // The other half of the gate: a booking that WAS paid must still get its
  // estimate, or the fix above would just have hidden the flow entirely.
  const paidRow = (await rows(traveler.token, `rentivo_bookings?id=eq.${victim.id}&select=status,payment_status`)).list[0]
  step(
    clientMod.shouldShowRefundEstimate(paidRow?.status, paidRow?.payment_status) === true,
    'a PAID booking still shows its refund estimate',
    `status=${paidRow?.status} payment_status=${paidRow?.payment_status}`,
  )

  const res = await cancelBooking(stranger.token, victim.id)
  step(res.status === 403, 'signed-in stranger is REFUSED', `${res.status} ${JSON.stringify(res.body).slice(0, 140)}`)

  const after = await rows(traveler.token, `rentivo_bookings?id=eq.${victim.id}&select=status,payment_status,refund_id`)
  step(after.list[0]?.status !== 'cancelled', 'the booking is untouched', after.list[0]?.status)
  step(after.list[0]?.refund_id === null, 'no refund was written', String(after.list[0]?.refund_id))
  const list = (await get(`/refunds?payment_intent=${victim.piId}&limit=10`)).body
  step((list?.data?.length ?? -1) === 0, 'and Stripe issued nothing', `n=${list?.data?.length}`)

  // Leave it clean: the real owner cancels it, which is also the owner-side
  // authorisation path working on a listing the stranger could not touch.
  const proper = await cancelBooking(owner.token, victim.id)
  step(proper.status === 200 && proper.body?.refund_percent === 100, 'the real owner still can, at 100%', JSON.stringify(proper.body).slice(0, 140))
}

// ── A completed booking cannot be cancelled ─────────────────────────────────

section('A completed booking cannot be cancelled')

const done = await book(traveler.token, { listing: L.scenarios, far: scenarioSlot(3), note: `${TAG}:completed` })
step(!!done?.id, 'booking created and paid', done?.id)
if (done?.id) {
  // The owner marks the rental finished — the legal confirmed -> completed
  // transition, done with a real owner session, not with SQL.
  const complete = await patch(owner.token, 'rentivo_bookings', `id=eq.${done.id}`, { status: 'completed' })
  step(complete.status === 200 && complete.body?.length === 1, 'owner completed the booking', `${complete.status} n=${complete.body?.length}`)

  const asTraveler = await cancelBooking(traveler.token, done.id)
  step(asTraveler.status === 409, 'traveler cannot cancel a completed booking', `${asTraveler.status} ${JSON.stringify(asTraveler.body).slice(0, 140)}`)
  const asOwner = await cancelBooking(owner.token, done.id)
  step(asOwner.status === 409, 'nor can the owner', `${asOwner.status} ${JSON.stringify(asOwner.body).slice(0, 140)}`)

  const after = await rows(traveler.token, `rentivo_bookings?id=eq.${done.id}&select=status,payment_status,refund_id`)
  step(after.list[0]?.status === 'completed', 'it is still completed', after.list[0]?.status)
  step(after.list[0]?.payment_status === 'paid', 'and still paid', after.list[0]?.payment_status)
  const list = (await get(`/refunds?payment_intent=${done.piId}&limit=10`)).body
  step((list?.data?.length ?? -1) === 0, 'Stripe issued no refund for it', `n=${list?.data?.length}`)
}

// ── Dates are released and the vehicle is sellable again ────────────────────

section('Cancellation releases the dates and the vehicle becomes sellable again')

const held = await book(traveler.token, { listing: L.scenarios, far: scenarioSlot(0), note: `${TAG}:release` })
step(!!held?.id, 'booking created and paid', held?.id)
if (held?.id) {
  const blocked = await rows(traveler.token, `rentivo_availability?booking_id=eq.${held.id}&select=id,blocked_date,end_date,reason`)
  step(blocked.list.length === 1, 'paying blocked the dates', JSON.stringify(blocked.list).slice(0, 160))

  // While it is live the same dates must NOT be sellable — otherwise "released"
  // proves nothing, because they were never held.
  const whileHeld = await createBooking(traveler.token, {
    listingId: L.scenarios, start: day(scenarioSlot(0)), end: day(scenarioSlot(0) + 1), extra: { notes: `${TAG}:clash` },
  })
  step(whileHeld.status === 409, 'the dates are genuinely sold while the booking lives', `${whileHeld.status} ${JSON.stringify(whileHeld.body).slice(0, 120)}`)

  const res = await cancelBooking(traveler.token, held.id)
  step(res.status === 200, 'cancelled', `${res.status}`)

  const after = await rows(traveler.token, `rentivo_availability?booking_id=eq.${held.id}&select=id`)
  step(after.list.length === 0, 'the availability block is gone', `n=${after.list.length}`)

  const resold = await createBooking(traveler.token, {
    listingId: L.scenarios, start: day(scenarioSlot(0)), end: day(scenarioSlot(0) + 1), extra: { notes: `${TAG}:resold` },
  })
  step(resold.status === 200, 'the vehicle is sellable again on the same dates', `${resold.status} ${JSON.stringify(resold.body).slice(0, 120)}`)
}

// ── Band edges, which real money cannot reach ───────────────────────────────

section('Band edges — the client rule against the SPEC, second by second')

// start_date is a DATE column, so a real booking can only ever sit at a whole
// number of days from UTC midnight: the live matrix above lands 1.2h or 22.8h
// from a threshold and can never exercise the boundary itself. What could still
// bite is the ROUNDING: the client truncates with date-fns differenceInHours
// while the server divides floats. This sweeps every 30 seconds either side of
// all three thresholds and checks the CLIENT against the SPEC — not against a
// re-implementation of the server, which would prove nothing.
let edgeChecked = 0
const edgeMismatches = []
for (const policy of ['flexible', 'moderate', 'strict']) {
  for (const edge of [24, 48, 72]) {
    for (let delta = -900; delta <= 900; delta += 30) {
      const now = new Date('2026-06-15T12:00:00.000Z')
      const start = new Date(now.getTime() + (edge * 3600 + delta) * 1000)
      const hours = (start.getTime() - now.getTime()) / 3600000
      const got = clientSays(policy, start.toISOString(), 1000, now, 'traveler')
      const want = expectedPercent(policy, hours, 'traveler')
      edgeChecked++
      if (got.refundPercent !== want) {
        edgeMismatches.push(`${policy} @${hours.toFixed(4)}h: client=${got.refundPercent} spec=${want}`)
      }
    }
  }
}
step(
  edgeMismatches.length === 0,
  'the client rule matches the spec at every second around all three thresholds',
  `${edgeChecked} points checked${edgeMismatches.length ? ' — ' + edgeMismatches.slice(0, 4).join(' | ') : ''}`,
)

// And the same for the money: half of every cent-level total must land on the
// cent the server would refund, not on a whole euro.
const centMismatches = []
let centChecked = 0
for (let cents = 100; cents <= 200000; cents += 137) {
  const total = cents / 100
  // 36h out — squarely inside moderate's 50% band.
  const got = clientSays('moderate', '2026-06-17T00:00:00.000Z', total, new Date('2026-06-15T12:00:00.000Z'), 'traveler')
  if (got.refundPercent !== 50) continue
  centChecked++
  const want = expectedAmount(total, 50)
  if (got.refundAmount !== want) centMismatches.push(`${total} -> ${got.refundAmount} (want ${want})`)
}
step(centChecked > 1000, 'the cent sweep really ran in the 50% band', `${centChecked} totals`)
step(
  centMismatches.length === 0,
  'the 50% band rounds to the CENT for every total, never to whole euros',
  centMismatches.slice(0, 4).join(' | ') || `${centChecked} totals checked`,
)

// ── The matrix, printed ─────────────────────────────────────────────────────

section('The matrix')

const cols = [
  ['cell', 34], ['h', 7], ['total', 8],
  ['spec%', 6], ['srv%', 6], ['cli%', 6],
  ['specEUR', 9], ['srvEUR', 9], ['cliEUR', 9],
  ['stripe', 10], ['payment_status', 20], ['revsd', 7], ['feeRef', 7],
]
const pad = (v, w) => String(v ?? '').padEnd(w)
console.log(cols.map(([h, w]) => pad(h, w)).join(''))
console.log(cols.map(([, w]) => '-'.repeat(w - 1) + ' ').join(''))
for (const r of results) {
  console.log([
    pad(r.cell, 34), pad(r.hours, 7), pad(r.total, 8),
    pad(r.specPercent, 6), pad(r.serverPercent, 6), pad(r.clientPercent, 6),
    pad(r.specAmount, 9), pad(r.serverAmount, 9), pad(r.clientAmount, 9),
    pad(r.stripeStatus, 10), pad(r.paymentStatus, 20),
    pad(r.reversal ?? '-', 7), pad(r.feeRefunded ?? '-', 7),
  ].join(''))
}

const disagreements = results.filter(
  r => r.clientPercent !== r.serverPercent || r.clientAmount !== r.serverAmount,
)
step(
  disagreements.length === 0,
  'NO cell shows the renter a number the server does not honour',
  disagreements.map(d => `${d.cell}: client ${d.clientPercent}%/${d.clientAmount} vs server ${d.serverPercent}%/${d.serverAmount}`).join(' | ') || 'all 15 agree',
)

// ── Cleanup ─────────────────────────────────────────────────────────────────

section('Cleanup — release every night this run held')

// The re-sale at the end of the "dates are released" section is a live booking
// by design — it is the proof the vehicle became sellable again — and it used to
// be left behind, so the next run had to roll a random base and hope.
//
// Exactly one kind of row legitimately survives: a COMPLETED rental, which
// cannot be cancelled at all (asserted two sections above) and therefore holds
// its night forever. The exemption is on the STATUS, not on this run's booking
// id: every previous run left one too, and treating those as cleanup failures
// turns a correct terminal state into permanent red.
const liveInWindow = await rows(traveler.token,
  `rentivo_bookings?listing_id=in.(${Object.values(L).join(',')})&status=neq.cancelled`
  + `&start_date=gte.${day(FX.from)}&start_date=lte.${day(FX.to)}&select=id,status,start_date`)
const cancellable = liveInWindow.list.filter(b => b.status !== 'completed')

let releasedCount = 0
const unexpected = []
for (const b of cancellable) {
  const r = await cancelBooking(traveler.token, b.id)
  if (r.status === 200) releasedCount++
  else unexpected.push(`${b.id} ${b.start_date} ${b.status} -> ${r.status}`)
}
step(unexpected.length === 0, 'every cancellable booking in this suite\'s window was released',
  `${releasedCount} of ${cancellable.length} released${unexpected.length ? ', stuck: ' + unexpected.join(', ') : ''}`)

const stillHeld = await rows(traveler.token,
  `rentivo_bookings?listing_id=in.(${Object.values(L).join(',')})&status=neq.cancelled`
  + `&start_date=gte.${day(FX.from)}&start_date=lte.${day(FX.to)}&select=id,status,start_date`)
step(
  stillHeld.list.every(b => b.status === 'completed'),
  'the only bookings left holding a night are completed rentals, which are terminal by design',
  stillHeld.list.map(b => `${b.status}@${b.start_date}`).join(', ') || 'none',
)

finish()
