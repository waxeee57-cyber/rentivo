/**
 * End-to-end proof of OPERATOR Stripe Connect onboarding, against the REAL
 * deployed project and REAL Stripe test-mode Connect accounts.
 *
 * `create-stripe-account-link` used to hardcode `country: 'HU'`, so every
 * operator — including the Spanish ones this marketplace is built for — was
 * handed a Hungarian Express account, asked for a Hungarian tax ID, and could
 * never finish. The broken account id was cached, so every retry reopened the
 * same dead account, and `create-payment-intent` then refused to charge for an
 * owner who is not onboarded: a live, visible listing that rejects every renter,
 * with nothing on screen explaining why. This proves the fix, the cache reuse,
 * the country-mismatch guard, the webhook that flips `stripe_onboarded` in both
 * directions, and who is allowed to ask for a link at all.
 *
 * Nothing is mocked. Real accounts, real edge functions, real Stripe.
 *
 * Run from the repo root:  node scripts/e2e/operator-onboarding.mjs
 */
import { readFileSync } from 'node:fs'
import {
  sb, stripe, signIn, createBooking, cancelBooking,
  step, section, finish, day, sleep, TEST_CONNECT_ACCOUNT,
} from './_lib.mjs'

const OPERATOR = ['e2e-newop@rentivo.domrol.com', 'e2e-NewOp-Pass-2026!']
const OUTSIDER = ['e2e-host@rentivo.domrol.com', 'e2e-Host-Pass-2026!']
const TRAVELER = ['e2e-hosttraveler@rentivo.domrol.com', 'e2e-HostTrav-Pass-2026!']

const OPERATOR_SETUP_SCREEN = 'app/auth/operator-setup.tsx'
const OPERATOR_STRIPE_SCREEN = 'app/auth/operator-stripe.tsx'
const ACCOUNT_LINK_FN = 'supabase/functions/create-stripe-account-link/index.ts'
const WEBHOOK_FN = 'supabase/functions/stripe-webhook/index.ts'
const CREATE_BOOKING_FN = 'supabase/functions/create-booking/index.ts'
const PAYMENT_INTENT_FN = 'supabase/functions/create-payment-intent/index.ts'
const BOOKING_SCREEN = 'app/(consumer)/booking/[listingId].tsx'

/** The operator's own country, as app/auth/operator-setup.tsx records it. */
const HOME_COUNTRY = 'ES'
/** A different supported country, used only to trip the mismatch guard. */
const OTHER_COUNTRY = 'PT'
/** Stable listing for the payout-gate section. */
const GATE_TITLE = 'E2E Operator Not Onboarded'
/** Booking window this task owns. Nothing outside +250..+290 days. */
const WINDOW = { from: 252, to: 268 }
const PRICE_PER_DAY = 300

// ── helpers ─────────────────────────────────────────────────────────────────

async function login(label, [email, password]) {
  const s = await signIn(email, password)
  if (!s.token) {
    console.error(`\nCould not sign in ${label} (${email}).`)
    if (s.needsConfirmation) {
      console.error('The account exists but its email is unconfirmed. Run:')
      console.error(`  update auth.users set email_confirmed_at = now() where email = '${email}' and email_confirmed_at is null;`)
    } else {
      console.error(JSON.stringify(s.error))
    }
    process.exit(1)
  }
  return s
}

async function rows(token, path) {
  const r = await sb(`/rest/v1/${path}`, {}, token)
  return { status: r.status, body: r.body, list: Array.isArray(r.body) ? r.body : [] }
}

async function insert(token, table, payload, prefer = 'return=representation') {
  return sb(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: prefer },
    body: JSON.stringify(payload),
  }, token)
}

async function patch(token, table, filter, payload) {
  return sb(`/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  }, token)
}

/** The edge function under test. */
const accountLink = token => sb('/functions/v1/create-stripe-account-link', {
  method: 'POST', body: JSON.stringify({}),
}, token)

function source(relPath) {
  try { return readFileSync(relPath, 'utf8') } catch { return null }
}

/** Poll a column until it reaches `want`, so the webhook gets its chance. */
async function waitForColumn(token, filter, column, want, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const r = await rows(token, `rentivo_operators?${filter}&select=${column}`)
    if (r.list[0]?.[column] === want) return { ok: true, value: r.list[0][column], waited: i }
    await sleep(1500)
  }
  const last = await rows(token, `rentivo_operators?${filter}&select=${column}`)
  return { ok: false, value: last.list[0]?.[column], waited: tries }
}

// ── run ─────────────────────────────────────────────────────────────────────

const operator = await login('operator', OPERATOR)
const outsider = await login('outsider', OUTSIDER)
const traveler = await login('traveler', TRAVELER)

section('0 — Identities')
step(!!operator.token, 'operator account signed in', operator.uid)
step(!!outsider.token, 'outsider signed in', outsider.uid)
step(!!traveler.token, 'traveler signed in', traveler.uid)
step(new Set([operator.uid, outsider.uid, traveler.uid]).size === 3, 'the three identities are distinct')

section('1 — An operator record is created the way app/auth/operator-setup.tsx does it')

const setupSrc = source(OPERATOR_SETUP_SCREEN)
step(!!setupSrc, 'operator-setup screen readable', OPERATOR_SETUP_SCREEN)

const NAME = 'E2E New Operator'
const slugBase = NAME.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

/** Exactly the row app/auth/operator-setup.tsx writes on "Get started". */
const operatorSetupRow = () => ({
  name: NAME,
  slug: `${slugBase}-${Date.now()}`,
  city: 'Marbella',
  country: HOME_COUNTRY,
  phone: '+34600000000',
  latitude: 36.5101,
  longitude: -4.8824,
  auth_id: operator.uid,
})

const existingOperator = (await rows(operator.token, `rentivo_operators?auth_id=eq.${operator.uid}&select=*`)).list[0] ?? null
let created = null
if (!existingOperator) {
  const ins = await insert(operator.token, 'rentivo_operators', operatorSetupRow())
  created = Array.isArray(ins.body) ? ins.body[0] : ins.body
  step(ins.status === 201 && !!created?.id, 'operator-setup insert accepted', `${ins.status} ${JSON.stringify(ins.body).slice(0, 120)}`)
} else {
  created = existingOperator
  step(true, 'reusing the operator record from an earlier run', created.id)
}
const operatorRow = created
step(operatorRow?.auth_id === operator.uid, 'the operator record is keyed to this auth user', operatorRow?.auth_id)
step(operatorRow?.country === HOME_COUNTRY, `and records its own country (${HOME_COUNTRY})`, operatorRow?.country)

// Re-entering setup must not fight the unique index on auth_id.
const rerun = await insert(operator.token, 'rentivo_operators?on_conflict=auth_id', operatorSetupRow(), 'resolution=merge-duplicates,return=representation')
step(rerun.status === 200 || rerun.status === 201, 're-running operator setup is accepted, not rejected as a duplicate', `${rerun.status} ${String(rerun.body?.code ?? '')}`)
const afterRerun = await rows(operator.token, `rentivo_operators?auth_id=eq.${operator.uid}&select=id`)
step(afterRerun.list.length === 1, 'the account still has EXACTLY ONE operator row', `n=${afterRerun.list.length}`)
step(afterRerun.list[0]?.id === operatorRow.id, 'and it is the same row', afterRerun.list[0]?.id)
step(/\.upsert\(/.test(setupSrc ?? ''), 'operator-setup writes with upsert, so a second attempt resumes instead of erroring')
step(/onConflict:\s*'auth_id'/.test(setupSrc ?? ''), "and de-duplicates on 'auth_id'")
step(
  /const\s*\{\s*data,\s*error\s*\}\s*=\s*await\s+supabase/.test(setupSrc ?? '') && /if \(error\) throw error/.test(setupSrc ?? ''),
  'and destructures and acts on the error',
)

// Payout columns are server-owned here too.
const payoutGrab = await patch(operator.token, 'rentivo_operators', `id=eq.${operatorRow.id}`, {
  stripe_account_id: 'acct_e2e_should_never_land', stripe_onboarded: true,
})
step(payoutGrab.status >= 400, 'an operator cannot write their own payout columns', `${payoutGrab.status} ${String(payoutGrab.body?.code ?? '')}`)

section('2 — create-stripe-account-link issues a real Connect onboarding link')

const linkSrc = source(ACCOUNT_LINK_FN)
step(!!linkSrc, 'the edge function source is readable', ACCOUNT_LINK_FN)
step(!/country:\s*'HU'/.test(linkSrc ?? ''), "the hardcoded country: 'HU' is gone", (linkSrc ?? '').match(/country:\s*'[A-Z]{2}'/)?.[0] ?? 'none')
step(/const claimed = String\(operator\.country/.test(linkSrc ?? ''), "the country is derived from the operator's own record")

// Make sure the operator's country is the home one before asking for a link.
await patch(operator.token, 'rentivo_operators', `id=eq.${operatorRow.id}`, { country: HOME_COUNTRY })

const first = await accountLink(operator.token)
step(first.status === 200, 'the operator gets an onboarding link', `${first.status} ${JSON.stringify(first.body).slice(0, 140)}`)
step(
  typeof first.body?.url === 'string' && /^https:\/\/connect\.stripe\.com\//.test(first.body.url),
  'and it is a real Stripe Connect onboarding URL',
  first.body?.url,
)

// Diagnosis for a 404 that has nothing to do with the operator existing: the
// function selects `stripe_account_country`, and if that column was never added
// the select errors, `opError` is set, and every operator on the platform is
// told "Operator profile not found".
const countryColumn = await rows(operator.token, `rentivo_operators?id=eq.${operatorRow.id}&select=stripe_account_country`)
step(
  countryColumn.status === 200,
  'rentivo_operators.stripe_account_country exists (create-stripe-account-link selects it)',
  countryColumn.status === 200 ? 'present' : `${countryColumn.status} ${String(countryColumn.body?.code ?? '')} ${String(countryColumn.body?.message ?? '').slice(0, 90)}`,
)
if (countryColumn.status !== 200) {
  console.log('  NOTE  supabase/migrations/20260805001_operator_stripe_country.sql has not been applied to this project.')
  console.log('  NOTE  Until it is, create-stripe-account-link 404s for EVERY operator and Connect onboarding is dead.')
}
const operatorSelfRead = await rows(operator.token, `rentivo_operators?auth_id=eq.${operator.uid}&select=id`)
step(operatorSelfRead.list.length === 1, 'the operator record the function looks up is genuinely there', `n=${operatorSelfRead.list.length}`)

const afterFirst = (await rows(operator.token, `rentivo_operators?id=eq.${operatorRow.id}&select=stripe_account_id,country`)).list[0] ?? {}
afterFirst.stripe_account_country = countryColumn.list[0]?.stripe_account_country ?? null
// Tied to the call succeeding: an id that is only there because it was seeded by
// hand proves nothing about the function.
step(
  first.status === 200 && !!afterFirst?.stripe_account_id,
  'create-stripe-account-link recorded a Connect account id on the operator',
  first.status === 200 ? (afterFirst?.stripe_account_id ?? 'none') : `the call failed (${first.status}); id on the row is ${afterFirst?.stripe_account_id ?? 'none'}`,
)
step(afterFirst?.stripe_account_country === HOME_COUNTRY, 'together with the country it was opened for', String(afterFirst?.stripe_account_country))

// Ask STRIPE what country the account really is, not our own column.
const acct = afterFirst.stripe_account_id
  ? (await stripe(`/accounts/${afterFirst.stripe_account_id}`, null, 'GET')).body
  : null
step(!!acct?.id && acct.id === afterFirst.stripe_account_id, 'the account exists at Stripe', acct?.id ?? 'no account to look up')
step(acct?.country === HOME_COUNTRY, `and Stripe opened it in the operator's own country, not HU`, `${acct?.country} (operator: ${afterFirst.country})`)
step(acct?.type === 'express', 'it is an Express account', acct?.type)

// Calling twice must REUSE, not mint a second account.
const second = await accountLink(operator.token)
step(second.status === 200, 'a second call also returns a link', String(second.status))
const afterSecond = (await rows(operator.token, `rentivo_operators?id=eq.${operatorRow.id}&select=stripe_account_id`)).list[0]
step(
  first.status === 200 && second.status === 200
  && !!afterFirst.stripe_account_id && afterSecond?.stripe_account_id === afterFirst.stripe_account_id,
  'and it reuses the SAME Connect account rather than creating another',
  `${afterFirst.stripe_account_id} -> ${afterSecond?.stripe_account_id} (calls: ${first.status}, ${second.status})`,
)
step(
  typeof first.body?.url === 'string' && second.body?.url !== first.body?.url,
  'a fresh single-use link is minted each time',
  `${String(first.body?.url).slice(-12)} vs ${String(second.body?.url).slice(-12)}`,
)

// How many accounts exist for this operator's email — a second account would show up here.
const byEmail = (await stripe('/accounts?limit=100', null, 'GET')).body
const mine = (byEmail?.data ?? []).filter(a => a.email === OPERATOR[0])
step(mine.length === 1, 'Stripe holds EXACTLY ONE Connect account for this operator after two link calls', `n=${mine.length} ${mine.map(a => a.id).join(',')}`)

section('2b — The country-mismatch guard')

// The operator re-registers the business elsewhere. A Connect account's country
// is immutable, so reusing the cached one is exactly what made the original bug
// permanent — the operator could never escape it from inside the app.
await patch(operator.token, 'rentivo_operators', `id=eq.${operatorRow.id}`, { country: OTHER_COUNTRY })
const mismatch = await accountLink(operator.token)
step(mismatch.status === 409, 'a cached account whose country no longer matches is refused', `${mismatch.status} ${JSON.stringify(mismatch.body).slice(0, 160)}`)
step(mismatch.body?.error === 'stripe_country_mismatch', 'with the stripe_country_mismatch code the client can branch on', mismatch.body?.error)
step(
  new RegExp(`${afterFirst.stripe_account_country}`).test(String(mismatch.body?.message ?? '')) &&
  new RegExp(`${OTHER_COUNTRY}`).test(String(mismatch.body?.message ?? '')),
  'and a message naming both countries',
  String(mismatch.body?.message ?? '').slice(0, 140),
)
const notReplaced = (await rows(operator.token, `rentivo_operators?id=eq.${operatorRow.id}&select=stripe_account_id`)).list[0]
step(notReplaced?.stripe_account_id === afterFirst.stripe_account_id, 'and the refusal did NOT silently mint a replacement account', notReplaced?.stripe_account_id)

// Put it back and confirm the operator is unblocked again.
await patch(operator.token, 'rentivo_operators', `id=eq.${operatorRow.id}`, { country: HOME_COUNTRY })
const recovered = await accountLink(operator.token)
step(recovered.status === 200, 'restoring the country unblocks onboarding', `${recovered.status}`)

section('3 — An operator who is NOT onboarded cannot receive bookings')

const onboardedNow = (await rows(operator.token, `rentivo_operators?id=eq.${operatorRow.id}&select=stripe_onboarded,stripe_account_id`)).list[0]
step(onboardedNow?.stripe_onboarded !== true, 'this operator is NOT onboarded for payouts', `stripe_onboarded=${onboardedNow?.stripe_onboarded}`)

// A live, visible listing owned by that operator — exactly the state the app
// leaves an operator in after they abandon (or cannot complete) onboarding.
let gateListing = (await rows(operator.token, `rentivo_listings?operator_id=eq.${operatorRow.id}&title=eq.${encodeURIComponent(GATE_TITLE)}&select=*`)).list[0] ?? null
if (!gateListing) {
  const ins = await insert(operator.token, 'rentivo_listings', {
    operator_id: operatorRow.id,
    owner_type: 'operator',
    title: GATE_TITLE,
    description: 'E2E payout-gate fixture',
    category: 'car',
    price_per_day: PRICE_PER_DAY,
    currency: 'EUR',
    available: true,
    min_rental_days: 1,
    cancellation_policy: 'moderate',
    instant_book: true,
  })
  gateListing = Array.isArray(ins.body) ? ins.body[0] : ins.body
  step(!!gateListing?.id, 'the operator published a listing while not onboarded', `${ins.status} ${JSON.stringify(ins.body).slice(0, 110)}`)
} else {
  step(true, 'reusing the payout-gate listing from an earlier run', gateListing.id)
}
// The previous run parks it; put it back on the market so the gate below is
// tested by the payout state and not by an "unavailable" short-circuit.
await patch(operator.token, 'rentivo_listings', `id=eq.${gateListing.id}`, { available: true })
const publiclyVisible = await rows(undefined, `rentivo_listings?id=eq.${gateListing.id}&select=id,available`)
step(publiclyVisible.list.length === 1, 'and it is publicly visible in the marketplace', `n=${publiclyVisible.list.length}`)
step(publiclyVisible.list[0]?.available === true, 'and bookable as far as the marketplace is concerned', String(publiclyVisible.list[0]?.available))

// Where is "not onboarded" actually enforced? Fixed dates, so create-booking's
// own idempotency reuses one row across runs instead of breeding them.
const gateRes = await createBooking(traveler.token, {
  listingId: gateListing.id, start: day(WINDOW.from), end: day(WINDOW.from + 1),
})
const gateBookingId = gateRes.status === 200 ? (gateRes.body?.booking_id ?? gateRes.body?.id ?? null) : null
if (gateRes.status !== 200 && gateRes.status !== 400 && gateRes.status !== 409) {
  step(false, 'create-booking answered unexpectedly for an un-onboarded owner', `${gateRes.status} ${JSON.stringify(gateRes.body)}`)
}
step(
  gateBookingId === null,
  'create-booking REFUSES a listing whose owner cannot be paid',
  gateBookingId ? `it accepted the booking: ${gateBookingId} — the gate is not enforced server-side at booking time` : 'refused',
)

// The money gate that IS enforced server-side.
if (gateBookingId) {
  const pay = await sb('/functions/v1/create-payment-intent', {
    method: 'POST', body: JSON.stringify({ booking_id: gateBookingId }),
  }, traveler.token)
  step(pay.status === 400, 'create-payment-intent refuses to charge for an un-onboarded owner', `${pay.status} ${JSON.stringify(pay.body).slice(0, 120)}`)
  step(
    /not set up to receive payments/i.test(String(pay.body?.error ?? '')),
    'with the payout reason, so no money can move to a dead account',
    pay.body?.error,
  )
  const stuck = (await rows(traveler.token, `rentivo_bookings?id=eq.${gateBookingId}&select=status,payment_status`)).list[0]
  step(
    stuck?.status === 'pending' && stuck?.payment_status === 'pending',
    'the booking is left stranded in pending — created, unpayable, and holding the renter',
    `${stuck?.status}/${stuck?.payment_status}`,
  )
  // Do not leave the fixture holding a booking. Unpaid, so no money moves.
  const closed = await cancelBooking(traveler.token, gateBookingId)
  step(closed.status === 200, 'the stranded booking is cancelled again so the fixture stays clean', `${closed.status} refund=${closed.body?.refund_amount}`)
}

const cbSrc = source(CREATE_BOOKING_FN)
const piSrc = source(PAYMENT_INTENT_FN)
const bookingScreenSrc = source(BOOKING_SCREEN)
step(!!cbSrc && !!piSrc && !!bookingScreenSrc, 'the three places a payout gate could live are readable')
step(
  /stripe_onboarded/.test(cbSrc ?? ''),
  'create-booking checks the owner can be paid before taking a booking',
  /stripe_onboarded/.test(cbSrc ?? '') ? 'present' : 'no stripe_onboarded check anywhere in create-booking',
)
step(
  /stripe_onboarded/.test(piSrc ?? ''),
  'create-payment-intent checks it before charging (the real server-side gate)',
)
step(
  /const operatorCanReceivePayments\s*=/.test(bookingScreenSrc ?? ''),
  'the booking screen also gates — but that decision lives in a bundle the renter holds',
  (bookingScreenSrc ?? '').match(/listing\.operator\?\.stripe_onboarded[^\n]*/)?.[0]?.trim(),
)
step(
  /listing\.host\?\.stripe_onboarded/.test(bookingScreenSrc ?? ''),
  'and that client gate covers HOST-owned listings too',
  /listing\.operator\?\.stripe_onboarded/.test(bookingScreenSrc ?? '')
    ? 'it only reads listing.operator — every host listing fails the gate and is unbookable in the app'
    : 'covered',
)

section('4 — The account.updated webhook flips stripe_onboarded in BOTH directions')

const webhookSrc = source(WEBHOOK_FN)
step(!!webhookSrc, 'stripe-webhook source readable', WEBHOOK_FN)
step(
  /const onboarded = !!\(account\.charges_enabled && account\.payouts_enabled\)/.test(webhookSrc ?? ''),
  'the handler derives onboarded from the CURRENT capability state, not from a one-way "activated" flag',
)
step(
  /rentivo_operators'\)\s*\n?\s*\.update\(\{ stripe_onboarded: onboarded \}\)/.test(webhookSrc ?? '')
  && /rentivo_hosts'\)\s*\n?\s*\.update\(\{ stripe_onboarded: onboarded \}\)/.test(webhookSrc ?? ''),
  'and writes it to BOTH rentivo_operators and rentivo_hosts',
)

// The event has to be able to reach us at all.
const endpoints = (await stripe('/webhook_endpoints?limit=100', null, 'GET')).body
const ours = (endpoints?.data ?? []).filter(e => /stripe-webhook/.test(String(e.url)))
step(ours.length > 0, 'a Stripe webhook endpoint points at the deployed stripe-webhook function', ours.map(e => e.url).join(' | ') || 'none')
const connectEp = ours.find(e => e.connect === true && (e.enabled_events ?? []).some(x => x === '*' || x === 'account.updated'))
step(
  !!connectEp,
  'and a CONNECT endpoint is subscribed to account.updated (otherwise the event never arrives)',
  ours.map(e => `${e.id} connect=${e.connect} [${(e.enabled_events ?? []).join(', ')}]`).join(' | ') || 'none',
)

/** The Connect account the operator is pointed at, creating one if onboarding is broken. */
let opAcctId = onboardedNow?.stripe_account_id ?? null
if (!opAcctId) {
  const all = (await stripe('/accounts?limit=100', null, 'GET')).body
  const marked = (all?.data ?? []).find(a => a.metadata?.rentivo_e2e === 'operator-onboarding')
  if (marked) {
    opAcctId = marked.id
  } else {
    const made = await stripe('/accounts', {
      type: 'express',
      country: HOME_COUNTRY,
      email: OPERATOR[0],
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { rentivo_e2e: 'operator-onboarding' },
    })
    opAcctId = made.body?.id ?? null
  }
  console.log('  NOTE  the operator has no Connect account because create-stripe-account-link is 404ing.')
  console.log(`  NOTE  attach one with:  update rentivo_operators set stripe_account_id = '${opAcctId}', stripe_onboarded = true where auth_id = '${operator.uid}';`)
}

/**
 * Drive a REAL account.updated: touch the account at Stripe, then wait for our
 * own row to reflect what Stripe says the account can do. Nothing here is
 * hand-fed to the function — Stripe signs and delivers the event.
 */
async function driveAccountUpdated(token, table, filter, accountId, label) {
  const before = (await rows(token, `${table}?${filter}&select=stripe_onboarded,stripe_account_id`)).list[0]
  const live = (await stripe(`/accounts/${accountId}`, null, 'GET')).body
  const truth = !!(live?.charges_enabled && live?.payouts_enabled)
  step(
    before?.stripe_account_id === accountId,
    `${label}: row is pointed at the account under test`,
    `${before?.stripe_account_id} (want ${accountId})`,
  )
  const touched = await stripe(`/accounts/${accountId}`, { metadata: { rentivo_e2e_ping: String(Date.now()) } })
  step(touched.status === 200, `${label}: a real account.updated was triggered at Stripe`, `${touched.status} charges=${live?.charges_enabled} payouts=${live?.payouts_enabled}`)

  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    const now = (await rows(token, `${table}?${filter}&select=stripe_onboarded`)).list[0]
    if (now?.stripe_onboarded === truth) {
      step(true, `${label}: stripe_onboarded now matches Stripe (${truth})`, before?.stripe_onboarded === truth ? `confirmed ${truth} (already correct before the event)` : `FLIPPED ${before?.stripe_onboarded} -> ${truth}`)
      return { ok: true, before: before?.stripe_onboarded, after: truth, flipped: before?.stripe_onboarded !== truth }
    }
  }
  const last = (await rows(token, `${table}?${filter}&select=stripe_onboarded`)).list[0]
  step(false, `${label}: stripe_onboarded never reached Stripe's truth (${truth})`, `still ${last?.stripe_onboarded}`)
  return { ok: false, before: before?.stripe_onboarded, after: last?.stripe_onboarded, flipped: false }
}

// Direction A — an account that cannot take money must drive the flag to FALSE.
const down = await driveAccountUpdated(
  operator.token, 'rentivo_operators', `id=eq.${operatorRow.id}`, opAcctId, 'incomplete account',
)
step(down.ok && down.after === false, 'an operator whose Connect account cannot charge is marked NOT onboarded', `${down.before} -> ${down.after}`)

// Direction B — a fully verified account must drive the flag to TRUE.
const hostFixture = (await rows(outsider.token, `rentivo_hosts?auth_id=eq.${outsider.uid}&select=id,stripe_account_id,stripe_onboarded`)).list[0]
step(
  hostFixture?.stripe_account_id === TEST_CONNECT_ACCOUNT,
  'the host fixture is pointed at the verified test Connect account',
  `${hostFixture?.stripe_account_id} (want ${TEST_CONNECT_ACCOUNT})`,
)
const up = await driveAccountUpdated(
  outsider.token, 'rentivo_hosts', `id=eq.${hostFixture?.id}`, TEST_CONNECT_ACCOUNT, 'verified account',
)
step(up.ok && up.after === true, 'an owner whose Connect account is live is marked onboarded', `${up.before} -> ${up.after}`)
// Both directions "matching" is only meaningful if at least one of them actually
// MOVED. Invert the two flags with service-role SQL and re-run to force it:
//   update rentivo_operators set stripe_onboarded = true  where auth_id = '<operator>';
//   update rentivo_hosts     set stripe_onboarded = false where auth_id = '<host>';
// Doing exactly that produced "still true" / "still false" — no connected-account
// event reached the handler, which is what the connect endpoint assertion above
// predicts.
step(
  down.flipped || up.flipped,
  'at least one of the two was a genuine transition rather than a confirmation',
  `down ${down.before}->${down.after} flipped=${down.flipped}; up ${up.before}->${up.after} flipped=${up.flipped}` +
  ` — force one with:  update rentivo_operators set stripe_onboarded = true where auth_id = '${operator.uid}';  update rentivo_hosts set stripe_onboarded = false where auth_id = '${outsider.uid}';`,
)

section('5 — Only the operator themselves can ask for their onboarding link')

const anon = await sb('/functions/v1/create-stripe-account-link', { method: 'POST', body: JSON.stringify({}) })
step(anon.status === 401, 'an unauthenticated caller is rejected', `${anon.status} ${JSON.stringify(anon.body).slice(0, 100)}`)

const bogus = await sb('/functions/v1/create-stripe-account-link', {
  method: 'POST', body: JSON.stringify({}),
}, 'not-a-real-jwt')
step(bogus.status === 401, 'a forged token is rejected', `${bogus.status}`)

// A signed-in user who owns no operator record gets nothing, however they ask.
const outsiderOperator = await rows(outsider.token, `rentivo_operators?auth_id=eq.${outsider.uid}&select=id`)
step(outsiderOperator.list.length === 0, 'the outsider owns no operator record', `n=${outsiderOperator.list.length}`)
const outsiderPlain = await accountLink(outsider.token)
step(outsiderPlain.status === 404, 'and gets no onboarding link', `${outsiderPlain.status} ${JSON.stringify(outsiderPlain.body).slice(0, 100)}`)
step(typeof outsiderPlain.body?.url !== 'string', 'certainly no URL', String(outsiderPlain.body?.url))

// Naming someone else's operator in the body must not redirect the function.
const impersonate = await sb('/functions/v1/create-stripe-account-link', {
  method: 'POST',
  body: JSON.stringify({ operator_id: operatorRow.id, account_id: opAcctId, auth_id: operator.uid }),
}, outsider.token)
step(impersonate.status !== 200, "naming another operator in the body does not hand over their link", `${impersonate.status} ${JSON.stringify(impersonate.body).slice(0, 110)}`)
step(
  /\.eq\('auth_id', user\.id\)/.test(linkSrc ?? '') && !/req\.json\(\)/.test(linkSrc ?? ''),
  'because the operator is resolved from the JWT and the body is never read',
  /req\.json\(\)/.test(linkSrc ?? '') ? 'the function reads the request body' : 'body ignored',
)

// And the account it would open belongs to the caller, nobody else.
const stillOps = (await rows(operator.token, `rentivo_operators?id=eq.${operatorRow.id}&select=stripe_account_id`)).list[0]
step(
  stillOps?.stripe_account_id === (onboardedNow?.stripe_account_id ?? stillOps?.stripe_account_id),
  "the operator's account id was not changed by the outsider's attempts",
  stillOps?.stripe_account_id ?? 'none',
)

section('6 — Cleanup')

// Put the operator's country back and leave no bookable un-payable listing.
await patch(operator.token, 'rentivo_operators', `id=eq.${operatorRow.id}`, { country: HOME_COUNTRY })
const restored = (await rows(operator.token, `rentivo_operators?id=eq.${operatorRow.id}&select=country`)).list[0]
step(restored?.country === HOME_COUNTRY, 'operator country restored', restored?.country)

const parked = await patch(operator.token, 'rentivo_listings', `id=eq.${gateListing.id}`, { available: false })
step(parked.status === 200 && parked.body?.length === 1, 'the payout-gate listing is parked as unavailable', `${parked.status} n=${parked.body?.length ?? 0}`)

finish()
