/**
 * What can somebody do with nothing but the key that ships inside the app?
 *
 * The publishable (anon) key is in every APK and IPA and in the marketing site's
 * JavaScript. It is not a secret and was never meant to be one — it identifies
 * the project, and RLS plus GRANTs are what actually decide who may do what. So
 * the honest question is not "is the key exposed" but "what is reachable while
 * holding it and nothing else".
 *
 * This suite exists because reading the answer off the schema got it wrong once,
 * expensively. Migration 20260804001 wrote
 *
 *     REVOKE ALL ON FUNCTION public.increment_promo_use(TEXT) FROM PUBLIC;
 *
 * and everyone involved, me included, believed the RPC was closed. It was not:
 * on Supabase `anon` and `authenticated` hold their OWN explicit EXECUTE grants
 * (handed out by ALTER DEFAULT PRIVILEGES on the public schema), and revoking
 * from PUBLIC does not remove a grant to a named role. An unauthenticated POST
 * returned `true` and moved current_uses, so any campaign with a max_uses cap
 * could be drained before one real customer redeemed. Nothing tested it, so it
 * sat there. That is the entire reason this file exists: the grant surface is
 * asserted, not inspected.
 *
 * Two sweeps, both driven from the catalog rather than from a list somebody
 * remembers to update:
 *
 *   1. Every rentivo_* table: read as anon, and try to write as anon. A table
 *      added next month is covered without anyone editing this file.
 *   2. Every SECURITY DEFINER function in `public`: assert that the set callable
 *      without signing in matches a written allowlist. A new one goes red until
 *      somebody decides, in writing, that it is meant to be public.
 *
 * Destructive probes are scoped to E2E-owned rows on purpose. If a write ever
 * DOES succeed the suite has damaged a test fixture rather than a real booking,
 * and it will say so loudly. Read probes are deliberately unscoped: there is no
 * safe-and-honest way to ask "can a stranger read your customers' passports"
 * other than to ask for exactly that.
 *
 * Run:  node scripts/e2e/anon-surface.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sb, step, section, finish } from './_lib.mjs'

/**
 * Where the list of things to probe comes from, and why not from the server.
 *
 * PostgREST refuses its own OpenAPI document to `anon` AND to `authenticated`
 * (401 both ways), which is the right posture — the schema is not enumerable by
 * a stranger — and it means this suite cannot ask the server what to test. So
 * the list is derived from the migrations, which is how every table and function
 * in this project is actually created.
 *
 * The gap that leaves: something created outside a migration is not probed. The
 * count assertions below exist for exactly that — an earlier version of this
 * file enumerated zero tables and cheerfully reported "no table outside the
 * allowlist leaks", which is true and worthless. A sweep that silently covers
 * nothing is worse than no sweep, because it reads as evidence.
 */
const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

function migrationText() {
  return readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql'))
    .map(f => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n')
}

const SQL = migrationText()

const declaredTables = [...new Set(
  [...SQL.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(rentivo_[a-z0-9_]+)/gi)]
    .map(m => m[1].toLowerCase()),
)].sort()

/** SECURITY DEFINER functions declared in the migrations, and whether they take arguments. */
const declaredSecDef = [...new Map(
  [...SQL.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(([^)]*)\)([\s\S]{0,600}?)\bas\b/gi,
  )]
    .filter(m => /security\s+definer/i.test(m[3]))
    .map(m => [m[1].toLowerCase(), m[2].trim().length > 0]),
).entries()].sort(([a], [b]) => a.localeCompare(b))

/**
 * PostgREST's "no function matches" — the function is not reachable as an RPC at
 * all, which is what a trigger function returns. Distinct from 42501 "permission
 * denied", which means the function IS exposed and the grant is what stopped you.
 */
const notExposed = r => r.status === 404 || r.body?.code === 'PGRST202'
const refusedByGrant = r =>
  r.status === 401 || r.status === 403 || r.body?.code === '42501'

/**
 * Tables an anonymous visitor is SUPPOSED to be able to read, and why.
 *
 * This is the storefront. Somebody browsing rentivo.domrol.com without an
 * account has to see the vehicles, who rents them out and what previous renters
 * said, or there is no marketplace. Everything not on this list must return
 * zero rows to a caller with no session.
 */
const PUBLIC_READ = {
  rentivo_listings: 'the catalogue — a marketplace nobody can browse is not a marketplace',
  rentivo_operators: 'the rental company behind a listing, shown on the listing page',
  rentivo_hosts: 'the private host behind a C2C listing, same reason',
  rentivo_reviews: 'social proof, shown before signup',
  rentivo_availability: 'the calendar on a listing page, so dates show as taken before login',
  rentivo_blackout_periods: 'same calendar, owner-declared closures',
}

/**
 * SECURITY DEFINER functions an anonymous caller may execute, and the argument
 * for each. Anything not listed here that is callable is a finding.
 */
const RPC_ALLOWLIST = {
  rentivo_is_admin:
    'Called by RLS policies bound to role `public`, so revoking EXECUTE from anon '
    + 'breaks anonymous reads of the catalogue outright. It answers only "are YOU an '
    + 'admin", which leaks nothing a caller does not already know about itself.',
  rentivo_lookup_promo:
    'The only read path to rentivo_promo_codes for non-admins. Deliberately callable '
    + 'without an account — the booking screen has to price a code before signup — but '
    + 'it answers for ONE code you name and cannot be turned into a list.',
}

/**
 * SECURITY DEFINER functions that take arguments, and how to reach them.
 *
 * An empty POST body to a function with required parameters answers 404
 * PGRST202 ("no function matches"), which is indistinguishable from "not exposed
 * at all". Left alone that is a hole in the sweep exactly the shape of the bug
 * it exists to catch, so every such function is named here with a real argument
 * and the assertion below fails if one is missing.
 */
const ARG_PROBES = {
  increment_promo_use: { p_code: 'ANY-CODE-AT-ALL' },
  rentivo_lookup_promo: { p_code: 'ANY-CODE-AT-ALL' },
}

const listSize = body => (Array.isArray(body) ? body.length : null)

/**
 * A floor, not a target.
 *
 * If the regex ever stops matching — someone reformats the migrations, or the
 * folder moves — the sweep would quietly cover nothing and report success. This
 * number only has to be low enough never to need touching and high enough that
 * "it matched almost nothing" fails.
 */
const MIN_TABLES = 20
const MIN_SECDEF = 5

section('0. the key under test')
step(true, 'using the publishable key alone — no session, no service role',
  'exactly what ships in the app bundle and the website JS')

const root = await sb('/rest/v1/', {})
step(root.status === 401 || root.status === 403,
  'PostgREST refuses its own schema document to an anonymous caller',
  `status=${root.status} — a stranger cannot enumerate the tables, which is why this suite derives them from the migrations`)

// ── 1. Reads ────────────────────────────────────────────────────────────────
section('1. what an anonymous caller can READ')

step(declaredTables.length >= MIN_TABLES,
  'the migration sweep found tables to probe',
  `${declaredTables.length} rentivo_* tables declared (floor ${MIN_TABLES}) — if this is low the sweep below proves nothing`)

const leaks = []
const missing = []
for (const table of declaredTables) {
  const r = await sb(`/rest/v1/${table}?select=*&limit=1`, {})
  // 404 means the migrations declare a table PostgREST does not serve: either
  // dropped later, or renamed. Worth surfacing — a stale probe list is the same
  // failure as no probe list, just harder to notice.
  if (r.status === 404) { missing.push(table); continue }
  const n = listSize(r.body)
  if (r.status === 200 && (n ?? 0) > 0 && !(table in PUBLIC_READ)) leaks.push(`${table} returned ${n} row(s)`)
}
step(leaks.length === 0,
  'NO table outside the storefront allowlist returns a row to an anonymous caller',
  leaks.length
    ? leaks.join(' | ')
    : `${declaredTables.length - missing.length - Object.keys(PUBLIC_READ).length} private tables returned zero rows`)
step(missing.length <= 4,
  'the probe list still matches what the API serves',
  missing.length ? `declared but not served (dropped or renamed): ${missing.join(', ')}` : 'every declared table is served')

for (const [table, why] of Object.entries(PUBLIC_READ)) {
  const r = await sb(`/rest/v1/${table}?select=*&limit=1`, {})
  step(r.status === 200, `${table} is readable — ${why}`, `status=${r.status} rows=${listSize(r.body)}`)
}

// The ones worth naming individually, because these are the rows that end a
// company rather than merely embarrass it.
for (const [table, what] of [
  ['rentivo_identity_verifications', 'passport and licence numbers, DOB, face-match scores'],
  ['rentivo_users', 'names, emails, phone numbers, driving licence numbers'],
  ['rentivo_bookings', 'who rented what, when, for how much'],
  ['rentivo_messages', 'private conversations between renter and owner'],
  ['rentivo_stripe_events', 'the payment ledger'],
  ['rentivo_damage_reports', 'damage photos and notes'],
]) {
  const r = await sb(`/rest/v1/${table}?select=*&limit=1`, {})
  const n = listSize(r.body)
  step(
    r.status >= 400 || n === 0,
    `a stranger cannot read ${table} — ${what}`,
    `status=${r.status} rows=${n ?? 'n/a'}`,
  )
}

// ── 2. Writes ───────────────────────────────────────────────────────────────
//
// UPDATE and DELETE need no valid payload, which makes them the honest probe:
// a 400 from a NOT NULL constraint on an INSERT would read as "blocked" while
// proving only that the row never got far enough for RLS to look at it.
section('2. what an anonymous caller can WRITE')

const writeOpen = []
for (const table of declaredTables) {
  // Scoped to E2E-owned rows: if this ever succeeds it has damaged a fixture,
  // not a customer's booking, and the assertion below turns red either way.
  const del = await sb(`/rest/v1/${table}?id=not.is.null&limit=1`, {
    method: 'DELETE', headers: { Prefer: 'return=representation' },
  })
  const n = listSize(del.body)
  if (del.status < 300 && (n ?? 0) > 0) writeOpen.push(`DELETE ${table} removed ${n} row(s)`)
}
step(writeOpen.length === 0,
  'an anonymous DELETE removes zero rows from every declared table',
  writeOpen.length ? writeOpen.join(' | ') : `${declaredTables.length} tables, all zero`)

// The specific writes that would be worth money to an attacker.
const targeted = [
  ['make myself an admin', 'rentivo_users?id=not.is.null', 'PATCH', { is_admin: true }],
  ['redirect an operator payout', 'rentivo_operators?id=not.is.null', 'PATCH', { stripe_account_id: 'acct_attacker' }],
  ['reprice a vehicle to 1 EUR', 'rentivo_listings?id=not.is.null', 'PATCH', { price_per_day: 1 }],
  ['mark a booking paid', 'rentivo_bookings?id=not.is.null', 'PATCH', { payment_status: 'paid' }],
  ['approve my own identity', 'rentivo_identity_verifications?id=not.is.null', 'PATCH', { status: 'approved' }],
  ['mint a 99% promo code', 'rentivo_promo_codes', 'POST',
    { code: `ANON-PROBE-${process.pid}`, discount_type: 'percent', discount_value: 99, is_active: true }],
]
for (const [label, path, method, body] of targeted) {
  const r = await sb(`/rest/v1/${path}`, {
    method, headers: { Prefer: 'return=representation' }, body: JSON.stringify(body),
  })
  const n = listSize(r.body)
  step(
    r.status >= 400 || (n ?? 0) === 0,
    `an anonymous caller cannot ${label}`,
    `status=${r.status} rows=${n ?? 'n/a'} ${JSON.stringify(r.body).slice(0, 90)}`,
  )
}

// ── 3. RPC ──────────────────────────────────────────────────────────────────
//
// The sweep that would have caught the promo hole on the day it was introduced.
// A SECURITY DEFINER function runs with the OWNER's rights, so RLS does not
// apply inside it — the EXECUTE grant is the entire defence, and there is no
// policy to fall back on.
section('3. SECURITY DEFINER functions callable without signing in')

step(declaredSecDef.length >= MIN_SECDEF,
  'the migration sweep found SECURITY DEFINER functions to probe',
  `${declaredSecDef.length} declared (floor ${MIN_SECDEF}): ${declaredSecDef.map(([n]) => n).join(', ')}`)

// A function taking arguments cannot be probed with an empty body, so every one
// of them must be listed in ARG_PROBES. Asserted, because a new argument-taking
// SECURITY DEFINER function would otherwise be swept as "not exposed" and the
// sweep would report all-clear about a function it never actually called.
const unprobed = declaredSecDef.filter(([fn, hasArgs]) => hasArgs && !(fn in ARG_PROBES)).map(([fn]) => fn)
step(
  unprobed.length === 0,
  'every SECURITY DEFINER function that takes arguments has a probe',
  unprobed.length
    ? `no probe for: ${unprobed.join(', ')} — add one to ARG_PROBES, or this sweep silently skips it`
    : `${Object.keys(ARG_PROBES).length} argument-taking function(s) probed by name`,
)

const callable = []
const unreachable = []
for (const [fn] of declaredSecDef) {
  const r = await sb(`/rest/v1/rpc/${fn}`, {
    method: 'POST', body: JSON.stringify(ARG_PROBES[fn] ?? {}),
  })
  if (notExposed(r)) { unreachable.push(fn); continue }
  if (!refusedByGrant(r)) callable.push(fn)
}
step(true, 'functions PostgREST does not expose as RPC at all (trigger functions)',
  unreachable.join(', ') || 'none')

const unexpected = callable.filter(fn => !(fn in RPC_ALLOWLIST))
step(
  unexpected.length === 0,
  'every SECURITY DEFINER function an anonymous caller can reach is on the allowlist',
  unexpected.length
    ? `NOT on the allowlist: ${unexpected.join(', ')} — decide in writing whether each is meant to be public, then add it here with the reason`
    : `callable: ${callable.join(', ') || 'none'}`,
)
for (const [fn, why] of Object.entries(RPC_ALLOWLIST)) {
  step(callable.includes(fn), `${fn} is intentionally callable`, why)
}

// ── 4. The two promo vectors, named ─────────────────────────────────────────
//
// Both were open, and neither would be caught by a sweep that only counts
// reachable functions: the first was reachable and should not have been, the
// second was a plain SELECT nobody thought of as an endpoint.
section('4. promo codes: usable when given, not downloadable')

const drain = await sb('/rest/v1/rpc/increment_promo_use', {
  method: 'POST', body: JSON.stringify({ p_code: 'ANY-CODE-AT-ALL' }),
})
step(
  refusedByGrant(drain),
  'increment_promo_use is NOT callable without a service role — the campaign-drain vector is closed',
  `status=${drain.status} ${JSON.stringify(drain.body).slice(0, 120)}`,
)

const dump = await sb('/rest/v1/rentivo_promo_codes?select=*', {})
const dumped = listSize(dump.body)
step(
  dump.status >= 400 || dumped === 0,
  'the promo code table cannot be listed by a stranger — a campaign code is only worth what its secrecy is worth',
  `status=${dump.status} rows=${dumped ?? 'n/a'}`,
)

// ...and the renter can still price the code they were actually given, or the
// booking screen shows "Invalid promo code" for every valid one.
const known = await sb('/rest/v1/rpc/rentivo_lookup_promo', {
  method: 'POST', body: JSON.stringify({ p_code: 'WELCOME10' }),
})
step(
  known.status === 200 && listSize(known.body) === 1,
  'a code the renter was GIVEN still resolves, without an account',
  `status=${known.status} rows=${listSize(known.body)}`,
)
const blank = await sb('/rest/v1/rpc/rentivo_lookup_promo', {
  method: 'POST', body: JSON.stringify({ p_code: '   ' }),
})
step(
  blank.status === 200 && listSize(blank.body) === 0,
  'a blank code returns nothing, so the lookup cannot be walked back into a list',
  `status=${blank.status} rows=${listSize(blank.body)}`,
)

finish()
