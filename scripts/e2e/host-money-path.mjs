/**
 * End-to-end proof of the HOST money path, against the REAL deployed project.
 *
 * Until this week the host half of the marketplace did not exist in production:
 * no `rentivo_hosts` row was ever written, `createListing` sent `operator_id: ''`
 * into a uuid column, photos were persisted as `file://` picker URIs, hosts had
 * no RLS SELECT policy on bookings, and no owner policy on listings matched.
 * Everything below drives the real code and the real database to show which of
 * those are genuinely fixed — and which are still broken.
 *
 * Nothing is mocked. `lib/api/listings.ts` and `lib/api/hosts.ts` are IMPORTED
 * AND EXECUTED as written (see the loader below), against a real Supabase
 * client holding a real user JWT, so RLS decides every read and write. The money
 * is real Stripe test-mode money on a real Connect destination charge.
 *
 * Run from the repo root:  node scripts/e2e/host-money-path.mjs
 */
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import {
  sb, stripe, signIn, createBooking, payBooking, cancelBooking, releaseWindow,
  step, section, finish, day, sleep, TEST_CONNECT_ACCOUNT,
} from './_lib.mjs'
import { FIXTURES, PRIVATE_HOSTS, assertFixture } from './fixtures.mjs'

const HOST = ['e2e-host@rentivo.domrol.com', 'e2e-Host-Pass-2026!']
const HOST2 = ['e2e-host2@rentivo.domrol.com', 'e2e-Host2-Pass-2026!']
const TRAVELER = ['e2e-hosttraveler@rentivo.domrol.com', 'e2e-HostTrav-Pass-2026!']

const HOST_SETUP_SCREEN = 'app/auth/host-setup.tsx'
const NEW_LISTING_SCREEN = 'app/(host)/listings/new.tsx'
const HOST_BOOKINGS_SCREEN = 'app/(host)/bookings/index.tsx'
const LISTINGS_API = 'lib/api/listings.ts'
const PAYMENT_INTENT_FN = 'supabase/functions/create-payment-intent/index.ts'
const CREATE_BOOKING_FN = 'supabase/functions/create-booking/index.ts'

/** Stable listing the money sections reuse, so re-runs do not breed listings. */
const MONEY_TITLE = 'E2E Host Money Path'
/**
 * Booking window this suite owns. It used to be +250..+288, which sat straight
 * across the identity window (+270..+300); the two suites never shared a listing
 * so it never bit, but a window that overlaps a neighbour's is a collision
 * waiting for the first fixture that does.
 */
const FX = FIXTURES.host
const WINDOW = { from: FX.from, to: FX.to }
const PRICE_PER_DAY = 500

// ── Run the app's own modules, unmodified ───────────────────────────────────
//
// `lib/api/listings.ts` is the thing under test, so it must be the thing that
// runs — not a re-implementation of it in this file. Node 24 strips the types;
// the loader below only supplies what a phone would have supplied:
//   • `@/…`            → the real file in this repo
//   • `@/lib/supabase` → a REAL supabase-js client (the app's own client module
//                        pulls in AsyncStorage, which does not exist off-device)
//                        that puts the CURRENT test identity's JWT on every
//                        request, so RLS is enforced exactly as in the app
//   • `@/lib/sentry`   → no-op; @sentry/react-native cannot load outside RN and
//                        crash reporting is not what is being proved here
// Nothing in listings.ts / hosts.ts is substituted.
const ROOT = process.cwd()

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const dataUrl = src => 'data:text/javascript,' + encodeURIComponent(src)

const SUPABASE_SHIM = dataUrl(`
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init = {}) => {
        const headers = new Headers(init.headers)
        if (process.env.E2E_ACCESS_TOKEN) {
          headers.set('Authorization', 'Bearer ' + process.env.E2E_ACCESS_TOKEN)
        }
        return fetch(input, { ...init, headers })
      },
    },
  },
)
`)

const SENTRY_SHIM = dataUrl('export function initSentry() {}\nexport function captureException() {}\n')

register(dataUrl(`
import { statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

let cfg
export async function initialize(data) { cfg = data }

const isFile = p => { try { return statSync(p).isFile() } catch { return false } }

export async function resolve(spec, ctx, next) {
  if (cfg.shims[spec]) return { url: cfg.shims[spec], shortCircuit: true }
  if (spec.startsWith('@/')) {
    const base = join(cfg.root, spec.slice(2))
    for (const c of [base, base + '.ts', base + '.tsx', join(base, 'index.ts')]) {
      if (isFile(c)) return { url: pathToFileURL(c).href, shortCircuit: true }
    }
  }
  // A shim lives at a data: URL, which has no directory to resolve
  // node_modules from. Re-root bare specifiers at the repo instead.
  if ((ctx.parentURL ?? '').startsWith('data:') && !/^[a-z]+:/.test(spec)) {
    return next(spec, { ...ctx, parentURL: pathToFileURL(join(cfg.root, 'e2e.mjs')).href })
  }
  return next(spec, ctx)
}
`), { parentURL: import.meta.url, data: {
  root: ROOT,
  shims: { '@/lib/supabase': SUPABASE_SHIM, '@/lib/sentry': SENTRY_SHIM },
} })

const listingsApi = await import('@/lib/api/listings')
const hostsApi = await import('@/lib/api/hosts')
const payoutUtil = await import('@/lib/utils/payout')

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

/** Make the app's supabase client speak as this identity for the next call. */
const as = session => { process.env.E2E_ACCESS_TOKEN = session.token }

/** REST read as `token`; returns the raw array so callers can assert on length. */
async function rows(token, path) {
  const r = await sb(`/rest/v1/${path}`, {}, token)
  return { status: r.status, body: r.body, list: Array.isArray(r.body) ? r.body : [] }
}

/** Insert returning the created row(s). Mirrors supabase-js `.insert().select()`. */
async function insert(token, table, payload, prefer = 'return=representation') {
  return sb(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: prefer },
    body: JSON.stringify(payload),
  }, token)
}

/** Patch returning the affected row(s), so a zero-row UPDATE is visible. */
async function patch(token, table, filter, payload) {
  return sb(`/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  }, token)
}

function source(relPath) {
  try { return readFileSync(relPath, 'utf8') } catch { return null }
}

const money = n => Math.round(Number(n) * 100) / 100

/**
 * Book a fixed slot inside the window this suite owns.
 *
 * This used to pick a random start and retry twelve times, because re-runs piled
 * onto the same nights and started failing the overlap constraint. Section 9 now
 * releases every night this run held, so the offsets can be fixed and a failure
 * here is a real failure rather than "the window filled up".
 */
async function bookAt(token, listingId, offset, label) {
  if (offset < WINDOW.from || offset + 2 > WINDOW.to) {
    step(false, `create booking (${label})`, `+${offset}..+${offset + 2} is outside +${WINDOW.from}..+${WINDOW.to}`)
    finish()
  }
  const res = await createBooking(token, {
    listingId, start: day(offset), end: day(offset + 2),
  })
  const id = res.body?.booking?.id ?? res.body?.booking_id ?? res.body?.id
  if (res.status === 200 && id) return { id, start: offset, body: res.body }
  step(false, `create booking (${label})`, `${res.status} ${JSON.stringify(res.body ?? '')}`)
  finish()
}

// ── run ─────────────────────────────────────────────────────────────────────

const host = await login('host', HOST)
const host2 = await login('second host', HOST2)
const traveler = await login('traveler', TRAVELER)

section('0 — Identities')
step(!!host.token, 'host signed in', host.uid)
step(!!host2.token, 'second host signed in', host2.uid)
step(!!traveler.token, 'traveler signed in', traveler.uid)
step(new Set([host.uid, host2.uid, traveler.uid]).size === 3, 'the three identities are distinct')
step(
  !!listingsApi.createListing && !!hostsApi.setHostListingAvailability,
  'the app modules under test loaded and are executable',
  `${LISTINGS_API}, lib/api/hosts.ts`,
)

section('1 — A host record is created the way app/auth/host-setup.tsx does it')

const hostSetupSrc = source(HOST_SETUP_SCREEN)
step(!!hostSetupSrc, 'host-setup screen readable', HOST_SETUP_SCREEN)

/** Exactly the row app/auth/host-setup.tsx upserts on "Complete setup". */
const hostSetupRow = (session, name) => ({
  auth_id: session.uid,
  name,
  city: 'Marbella',
  bio: 'E2E host fixture',
  email: `${name.toLowerCase().replace(/\s+/g, '-')}@rentivo.domrol.com`,
  country: 'ES',
  active: true,
  identity_verified: false,
})

/** PostgREST equivalent of `.upsert(row, { onConflict: 'auth_id' }).select().single()`. */
const hostUpsert = (session, name) => insert(
  session.token,
  'rentivo_hosts?on_conflict=auth_id',
  hostSetupRow(session, name),
  'resolution=merge-duplicates,return=representation',
)

// 201 the first time the row is minted, 200 when the upsert resolves to an update.
const upserted = r => r.status === 201 || r.status === 200

const firstSetup = await hostUpsert(host, 'E2E Host One')
step(upserted(firstSetup), 'host-setup upsert accepted', `${firstSetup.status} ${JSON.stringify(firstSetup.body).slice(0, 120)}`)
const hostRow = Array.isArray(firstSetup.body) ? firstSetup.body[0] : firstSetup.body
step(!!hostRow?.id, 'a rentivo_hosts row now exists for the account', hostRow?.id)
step(hostRow?.auth_id === host.uid, 'and it is keyed to this auth user')

// Re-entering setup must UPDATE, never mint a second host record.
const secondSetup = await hostUpsert(host, 'E2E Host One Renamed')
step(upserted(secondSetup), 're-running setup is accepted', String(secondSetup.status))
const afterSecond = await rows(host.token, `rentivo_hosts?auth_id=eq.${host.uid}&select=id,name`)
step(afterSecond.list.length === 1, 'the account still has EXACTLY ONE host row', `n=${afterSecond.list.length}`)
step(afterSecond.list[0]?.id === hostRow?.id, 'and it is the same row, updated in place', afterSecond.list[0]?.id)
step(afterSecond.list[0]?.name === 'E2E Host One Renamed', 'the re-run updated the row instead of being ignored')

// Restore the name so the fixture reads sensibly on the next run.
await hostUpsert(host, 'E2E Host One')

step(/\.upsert\(/.test(hostSetupSrc ?? ''), 'host-setup writes with upsert, not insert')
step(/onConflict:\s*'auth_id'/.test(hostSetupSrc ?? ''), "and de-duplicates on 'auth_id'")
step(
  /const\s*\{\s*data,\s*error\s*\}\s*=\s*await\s+supabase[\s\S]{0,80}rentivo_hosts/.test(hostSetupSrc ?? ''),
  'host-setup destructures error from the write',
)
step(
  /if \(error\) throw error/.test(hostSetupSrc ?? ''),
  'and acts on it rather than discarding it',
)

// The second host exists to prove isolation later; create its record the same way.
const host2Setup = await hostUpsert(host2, 'E2E Host Two')
const host2Row = Array.isArray(host2Setup.body) ? host2Setup.body[0] : host2Setup.body
step(!!host2Row?.id, 'second host record created', host2Row?.id)

// Payout columns are server-owned. This is why the Connect account below has to
// be seeded with SQL rather than by the host's own session.
const payoutGrab = await patch(host.token, 'rentivo_hosts', `id=eq.${hostRow.id}`, {
  stripe_account_id: 'acct_e2e_should_never_land', stripe_onboarded: true,
})
step(payoutGrab.status >= 400, 'a host cannot write their own payout columns', `${payoutGrab.status} ${String(payoutGrab.body?.code ?? '')}`)
step(payoutGrab.body?.code === '42501', 'and it is the privileged-column guard that stops them', String(payoutGrab.body?.code))

section('2 — createListing() publishes a host listing (operator_id: "" and all)')

const listingsSrc = source(LISTINGS_API)
const newListingSrc = source(NEW_LISTING_SCREEN)
step(!!listingsSrc && !!newListingSrc, 'listings API and host wizard readable')

/** The payload app/(host)/listings/new.tsx hands to createListing, verbatim. */
const hostScreenListing = (title, images) => ({
  operator_id: '',
  host_id: hostRow.id,
  title,
  description: 'E2E host listing',
  category: 'villa',
  subcategory: null,
  price_per_day: PRICE_PER_DAY,
  price_per_week: null,
  deposit_amount: 0,
  currency: 'EUR',
  available: true,
  min_rental_days: 1,
  max_rental_days: null,
  capacity: null,
  year: null,
  make: null,
  model: null,
  color: null,
  license_plate: null,
  features: ['AC'],
  rules: null,
  images,
  cover_image_url: images[0] ?? null,
  cancellation_policy: 'moderate',
  pickup_address: 'Calle E2E 1',
  latitude: null,
  longitude: null,
  instant_book: true,
  owner_type: 'host',
})

const REMOTE_PHOTO = 'https://xeyfsacbozucxrwlefro.supabase.co/storage/v1/object/public/listing-photos/e2e/cover.jpg'

// The bug being guarded against, reproduced against the live database: the raw
// screen payload is uuid-invalid, so without normalisation nothing is written.
as(host)
const rawInsert = await insert(host.token, 'rentivo_listings', hostScreenListing('E2E raw payload probe', [REMOTE_PHOTO]))
step(rawInsert.status >= 400, "the raw screen payload (operator_id: '') is still rejected by Postgres", `${rawInsert.status} ${String(rawInsert.body?.code ?? '')}`)
step(rawInsert.body?.code === '22P02', 'and the error is exactly the uuid syntax error hosts used to hit', String(rawInsert.body?.message ?? '').slice(0, 90))

// Now the REAL createListing, with that same payload.
const probeTitle = `E2E Host Probe ${Date.now()}`
let probe = null
let probeError = null
try {
  probe = await listingsApi.createListing(hostScreenListing(probeTitle, [REMOTE_PHOTO]))
} catch (e) { probeError = e }
step(!probeError, 'createListing() accepted the host screen payload', probeError ? String(probeError?.message ?? probeError) : probe?.id)
step(probe?.operator_id === null, "createListing normalised operator_id '' to NULL", String(probe?.operator_id))
step(probe?.host_id === hostRow.id, 'the listing is owned by this host', probe?.host_id)
step(probe?.owner_type === 'host', "and is stamped owner_type 'host'", probe?.owner_type)
step(money(probe?.price_per_day) === PRICE_PER_DAY, 'price persisted', String(probe?.price_per_day))

// Every key the screen sends must be a real column, or the insert silently
// depends on PostgREST ignoring it.
const listingColumns = new Set(Object.keys(probe ?? {}))
const unknownKeys = Object.keys(hostScreenListing('x', [])).filter(k => !listingColumns.has(k))
step(unknownKeys.length === 0, 'every column the host wizard writes exists on rentivo_listings', unknownKeys.join(',') || 'none')

// Photos: local picker URIs resolve on one phone only.
step(
  Array.isArray(probe?.images) && probe.images.every(u => /^https:\/\//.test(u)),
  'listing photos are stored as remote URLs',
  JSON.stringify(probe?.images),
)
step(
  /const photoUrls = await uploadListingPhotos\(/.test(newListingSrc ?? ''),
  'the wizard uploads the picked photos before saving them',
)
step(
  /images: photoUrls/.test(newListingSrc ?? '') && !/images: photos/.test(newListingSrc ?? ''),
  'and saves the uploaded URLs, never the local file:// URIs',
)
step(
  /cover_image_url: photoUrls\[0\]/.test(newListingSrc ?? ''),
  'the cover image is an uploaded URL too',
)
step(
  /UUID_COLUMNS/.test(listingsSrc ?? '') && /row\[column\] === ''/.test(listingsSrc ?? ''),
  "createListing normalises empty-string uuids so no screen can reintroduce the '' bug",
)

section('3 — The host edits their own listing, and a paused one stays visible to them')

const NEW_PRICE = 540
const priceEdit = await patch(host.token, 'rentivo_listings', `id=eq.${probe.id}`, { price_per_day: NEW_PRICE })
step(priceEdit.status === 200 && priceEdit.body?.length === 1, 'host UPDATE on their own listing affects exactly one row', `${priceEdit.status} n=${priceEdit.body?.length ?? 0}`)
step(money(priceEdit.body?.[0]?.price_per_day) === NEW_PRICE, 'the new price persisted', String(priceEdit.body?.[0]?.price_per_day))

// The real availability API for hosts. `toggleListingAvailability` cannot serve
// them: it resolves an OPERATOR id and its UPDATE carries .eq('operator_id', …),
// which matches zero host rows however it is called.
as(host)
let pauseError = null
try { await hostsApi.setHostListingAvailability(probe.id, hostRow.id, false) } catch (e) { pauseError = e }
step(!pauseError, 'setHostListingAvailability() paused the listing', pauseError ? String(pauseError?.message ?? pauseError) : 'ok')

const pausedForOwner = await rows(host.token, `rentivo_listings?id=eq.${probe.id}&select=id,available`)
step(pausedForOwner.list.length === 1, 'a PAUSED listing is still visible to its owner', `n=${pausedForOwner.list.length}`)
step(pausedForOwner.list[0]?.available === false, 'and it really is paused', String(pausedForOwner.list[0]?.available))

const pausedForPublic = await rows(undefined, `rentivo_listings?id=eq.${probe.id}&select=id`)
step(pausedForPublic.list.length === 0, 'while the public marketplace no longer shows it', `n=${pausedForPublic.list.length}`)

let resumeError = null
try { await hostsApi.setHostListingAvailability(probe.id, hostRow.id, true) } catch (e) { resumeError = e }
step(!resumeError, 'and the host can un-pause it again', resumeError ? String(resumeError?.message ?? resumeError) : 'ok')

// Regression guard for the reason lib/api/hosts.ts exists at all.
let operatorPathError = null
try {
  await listingsApi.updateListing(probe.id, { price_per_day: 1 }, hostRow.id)
} catch (e) { operatorPathError = e }
step(
  !!operatorPathError && /not owned by this operator/.test(String(operatorPathError?.message ?? '')),
  'the operator-shaped updateListing() still refuses to touch a host listing (hence hosts.ts)',
  String(operatorPathError?.message ?? 'no error — it silently matched a host row'),
)
const untouched = await rows(host.token, `rentivo_listings?id=eq.${probe.id}&select=price_per_day`)
step(money(untouched.list[0]?.price_per_day) === NEW_PRICE, 'and it changed nothing when it refused', String(untouched.list[0]?.price_per_day))

section('4 — A different host is locked out of this listing')

// Everything below runs with a REAL, valid session. RLS, not obscurity, has to
// be what keeps the other host out.
const otherWrite = await patch(host2.token, 'rentivo_listings', `id=eq.${probe.id}`, { price_per_day: 1 })
step(
  otherWrite.status !== 200 || (otherWrite.body?.length ?? 0) === 0,
  'another host UPDATE on this listing changes nothing',
  `${otherWrite.status} n=${otherWrite.body?.length ?? 0}`,
)

as(host2)
let otherApiError = null
try { await hostsApi.setHostListingAvailability(probe.id, host2Row.id, false) } catch (e) { otherApiError = e }
step(
  !!otherApiError && /not owned by this host/.test(String(otherApiError?.message ?? '')),
  'setHostListingAvailability() refuses for a host who does not own the listing',
  String(otherApiError?.message ?? 'no error — it silently succeeded'),
)

// Claiming the row by rewriting host_id must not work either.
const hijack = await patch(host2.token, 'rentivo_listings', `id=eq.${probe.id}`, { host_id: host2Row.id })
step(
  hijack.status !== 200 || (hijack.body?.length ?? 0) === 0,
  'another host cannot re-point host_id at themselves',
  `${hijack.status} n=${hijack.body?.length ?? 0}`,
)

const otherDelete = await sb(`/rest/v1/rentivo_listings?id=eq.${probe.id}`, {
  method: 'DELETE', headers: { Prefer: 'return=representation' },
}, host2.token)
step(
  (Array.isArray(otherDelete.body) ? otherDelete.body.length : 0) === 0,
  'another host cannot delete this listing',
  `${otherDelete.status} n=${Array.isArray(otherDelete.body) ? otherDelete.body.length : '?'}`,
)

const stillMine = await rows(host.token, `rentivo_listings?id=eq.${probe.id}&select=id,host_id,price_per_day`)
step(stillMine.list[0]?.host_id === hostRow.id, 'the listing still belongs to the original host', stillMine.list[0]?.host_id)
step(money(stillMine.list[0]?.price_per_day) === NEW_PRICE, 'and its price is untouched', String(stillMine.list[0]?.price_per_day))

// Pause it and confirm the other host cannot see the row at all — with the
// listing off the public "available = true" policy, only an owner policy can
// return it, and the other host has none.
as(host)
await hostsApi.setHostListingAvailability(probe.id, hostRow.id, false)
const hiddenFromOther = await rows(host2.token, `rentivo_listings?id=eq.${probe.id}&select=id`)
step(hiddenFromOther.list.length === 0, 'a paused listing is invisible to another host', `n=${hiddenFromOther.list.length}`)
await hostsApi.setHostListingAvailability(probe.id, hostRow.id, true)

section('5 — A traveler books and pays a HOST listing, and the money routes to the host')

// Payout columns are server-only (proved in section 1), so the Connect account
// is seeded with SQL rather than by the host's own session:
//   update rentivo_hosts set stripe_account_id = '<acct>', stripe_onboarded = true
//   where auth_id = '<host auth id>';
const payoutRow = (await rows(host.token, `rentivo_hosts?id=eq.${hostRow.id}&select=stripe_account_id,stripe_onboarded`)).list[0]
if (!payoutRow?.stripe_onboarded || !payoutRow?.stripe_account_id) {
  step(false, 'host has a Connect account to be paid into', `seed it:  update rentivo_hosts set stripe_account_id = '${TEST_CONNECT_ACCOUNT}', stripe_onboarded = true where auth_id = '${host.uid}';`)
  finish()
}
step(true, 'host has an onboarded Connect account', payoutRow.stripe_account_id)

// A stable listing for the money sections, so re-runs do not breed listings.
as(host)
const existingMoney = await rows(host.token, `rentivo_listings?host_id=eq.${hostRow.id}&title=eq.${encodeURIComponent(MONEY_TITLE)}&select=*`)
let moneyListing = existingMoney.list[0] ?? null
if (!moneyListing) {
  moneyListing = await listingsApi.createListing(hostScreenListing(MONEY_TITLE, [REMOTE_PHOTO]))
}
step(!!moneyListing?.id, 'host-owned listing ready for the money path', `${moneyListing?.id} @ ${moneyListing?.price_per_day}/day`)
step(moneyListing?.owner_type === 'host' && moneyListing?.operator_id === null, 'it is host-owned with no operator', `${moneyListing?.owner_type}/${moneyListing?.operator_id}`)
if (money(moneyListing.price_per_day) !== PRICE_PER_DAY || moneyListing.available !== true) {
  await patch(host.token, 'rentivo_listings', `id=eq.${moneyListing.id}`, { price_per_day: PRICE_PER_DAY, available: true })
}

// The declared fixture, and the listing this suite actually found by title, have
// to be the same row. fixtures.mjs shipped pointing `host` at "Villa Sol", which
// belongs to the PROJECT OWNER's host record — a suite that took that at face
// value would have booked and refunded the owner's own property.
step(
  moneyListing.id === FX.listing,
  'the host money listing is the one fixtures.mjs declares',
  `found ${moneyListing.id}, declared ${FX.listing}`,
)
const fixture = await assertFixture(sb, 'host', host.token)
step(fixture.row.host_id === PRIVATE_HOSTS.host, 'and it is owned by the E2E host record, not anybody else', fixture.row.host_id)

// An interrupted earlier run can leave paid bookings holding these nights.
const preclean = await releaseWindow(traveler.token, moneyListing.id, WINDOW.from, WINDOW.to)
step(preclean.stuck.length === 0, 'window clear before the run', `released ${preclean.released.length} of ${preclean.found}${preclean.stuck.length ? ' stuck: ' + preclean.stuck.join(', ') : ''}`)

const booked = await bookAt(traveler.token, moneyListing.id, WINDOW.from + 4, 'host money path')
step(!!booked.id, 'traveler created a booking on the host listing', `${booked.id} @ +${booked.start}d`)

const expectedSubtotal = PRICE_PER_DAY * 2
const expectedFee = Math.round(expectedSubtotal * 0.10)
const expectedTotal = expectedSubtotal + expectedFee
step(money(booked.body?.subtotal) === expectedSubtotal, 'quoted subtotal is 2 nights at the listed price', String(booked.body?.subtotal))
step(money(booked.body?.platform_fee) === expectedFee, 'quoted platform fee is 10% of the subtotal', String(booked.body?.platform_fee))
step(money(booked.body?.total_amount) === expectedTotal, 'quoted total is subtotal + fee', String(booked.body?.total_amount))

const paid = await payBooking(traveler.token, booked.id)
step(paid.ok, 'booking paid with a real test card and the webhook landed', paid.ok ? paid.piId : `${paid.stage}: ${JSON.stringify(paid.detail)}`)
if (!paid.ok) finish()

// Ask STRIPE what happened, not our own columns.
const pi = (await stripe(`/payment_intents/${paid.piId}?expand[]=latest_charge`, null, 'GET')).body
step(pi?.status === 'succeeded', 'the PaymentIntent succeeded', pi?.status)
step(
  pi?.transfer_data?.destination === payoutRow.stripe_account_id,
  "the destination charge routes to the HOST's Connect account",
  `${pi?.transfer_data?.destination} (host: ${payoutRow.stripe_account_id})`,
)
step(pi?.amount === expectedTotal * 100, 'Stripe charged the traveler the quoted total', `${pi?.amount} cents`)
step(
  pi?.application_fee_amount === expectedFee * 100,
  'the platform application fee is 10% of the SUBTOTAL',
  `${pi?.application_fee_amount} cents vs expected ${expectedFee * 100}`,
)
step(
  pi?.amount - pi?.application_fee_amount === expectedSubtotal * 100,
  'so the host is transferred exactly the rental subtotal',
  `${(pi?.amount - pi?.application_fee_amount) / 100} EUR`,
)
step(pi?.currency === 'eur', 'charged in EUR', pi?.currency)

// The transfer object is the money actually arriving in the host's account.
const charge = pi?.latest_charge
step(
  charge?.transfer_data?.destination === payoutRow.stripe_account_id,
  'the charge itself carries the host as transfer destination',
  charge?.transfer_data?.destination,
)
const transferId = typeof charge?.transfer === 'string' ? charge.transfer : charge?.transfer?.id
const transfer = transferId ? (await stripe(`/transfers/${transferId}`, null, 'GET')).body : null
step(!!transfer?.id, 'a Stripe transfer to the host exists', transfer?.id ?? 'none')
step(transfer?.destination === payoutRow.stripe_account_id, 'and it is destined for the host account', transfer?.destination)

// The transfer is denominated in the CONNECTED account's own currency — this
// Connect account was opened as Hungarian, so Stripe settles it in HUF. The
// EUR-denominated split is therefore asserted on the platform side: the
// application fee is what Rentivo keeps, and everything else goes to the host.
step(transfer?.amount > 0, `the transfer is settled in the host account currency (${transfer?.currency})`, String(transfer?.amount))
const feeId = typeof charge?.application_fee === 'string' ? charge.application_fee : charge?.application_fee?.id
const appFee = feeId ? (await stripe(`/application_fees/${feeId}`, null, 'GET')).body : null
step(appFee?.currency === 'eur', 'the platform fee is booked in EUR', appFee?.currency)
step(
  appFee?.amount === expectedFee * 100,
  'and the platform keeps exactly 10% of the subtotal, nothing more',
  `${(appFee?.amount ?? 0) / 100} EUR of a ${expectedTotal} EUR charge`,
)
step(
  (charge?.amount ?? 0) - (appFee?.amount ?? 0) === expectedSubtotal * 100,
  'leaving the host the full rental subtotal',
  `${((charge?.amount ?? 0) - (appFee?.amount ?? 0)) / 100} EUR`,
)

const bookingAfterPay = (await rows(traveler.token, `rentivo_bookings?id=eq.${booked.id}&select=subtotal,platform_fee,total_amount,payment_status,owner_type,host_id,operator_id`)).list[0]
step(bookingAfterPay?.payment_status === 'paid', 'the booking row reads as paid', bookingAfterPay?.payment_status)
step(money(bookingAfterPay?.subtotal) === expectedSubtotal, 'and its persisted subtotal matches what the host received', String(bookingAfterPay?.subtotal))

section('6 — The host can READ and CONFIRM the booking on their own listing')

const hostSeesRaw = await rows(host.token, `rentivo_bookings?id=eq.${booked.id}&select=id,status,host_id,owner_type`)
step(
  hostSeesRaw.list.length === 1,
  'the host can read the booking on their own listing',
  `n=${hostSeesRaw.list.length}${hostSeesRaw.list.length ? '' : ' — RLS returned nothing'}`,
)

// Root cause when the read above comes back empty. The "Hosts see own listing
// bookings" policy matches on rentivo_bookings.host_id, and create-booking never
// writes it: its INSERT sets `operator_id: listing.operator_id ?? null` and
// nothing else, so a host booking is stored with host_id NULL and the
// owner_type default of 'operator'.
step(
  bookingAfterPay?.host_id === hostRow.id,
  'create-booking stamped the booking with the owning host_id',
  `host_id=${bookingAfterPay?.host_id} (listing host is ${hostRow.id})`,
)
step(
  bookingAfterPay?.owner_type === 'host',
  "create-booking stamped the booking owner_type 'host'",
  `owner_type=${bookingAfterPay?.owner_type}`,
)

const hostBookingList = await rows(host.token, `rentivo_bookings?select=id,listing_id&limit=50`)
step(
  hostBookingList.list.some(b => b.id === booked.id),
  'the paid booking shows up in the host bookings list the dashboard reads',
  `${booked.id} not among the ${hostBookingList.list.length} booking(s) this host can see`,
)

// The owner columns cannot be repaired after the fact: `authenticated` holds
// INSERT but not UPDATE on host_id / owner_type, so nobody outside service_role
// can stamp an existing booking. (Good — a renter must not be able to re-point
// who owns their booking. It also means the create-booking defect above cannot
// be worked around client-side.)
const repair = await patch(traveler.token, 'rentivo_bookings', `id=eq.${booked.id}`, { host_id: hostRow.id })
step(repair.status >= 400, 'and no client session can stamp host_id afterwards', `${repair.status} ${String(repair.body?.message ?? '').slice(0, 90)}`)
const hostRepair = await patch(host.token, 'rentivo_bookings', `id=eq.${booked.id}`, { host_id: hostRow.id })
step(hostRepair.status >= 400 || (hostRepair.body?.length ?? 0) === 0, 'not even the host themselves', `${hostRepair.status}`)

// So prove the POLICY on a booking that carries the stamp create-booking should
// have written. This row is inserted through the real "Travelers create pending
// bookings" RLS policy by the real traveler session — the only difference from
// the row above is the host_id / owner_type the edge function omits.
const stampedStart = WINDOW.to - 1
const stampedRow = {
  listing_id: moneyListing.id,
  user_id: traveler.uid,
  host_id: hostRow.id,
  owner_type: 'host',
  operator_id: null,
  start_date: day(stampedStart),
  end_date: day(stampedStart + 1),
  total_days: 1,
  price_per_day: PRICE_PER_DAY,
  subtotal: PRICE_PER_DAY,
  platform_fee: Math.round(PRICE_PER_DAY * 0.1),
  total_amount: PRICE_PER_DAY + Math.round(PRICE_PER_DAY * 0.1),
  deposit_amount: 0,
  currency: 'EUR',
  status: 'pending',
  payment_status: 'pending',
  guest_name: 'E2E Traveler',
}
// One per run is enough; reuse it so re-runs do not pile rows up.
// Scoped to this suite's window and to rows that are still live: section 9
// cancels it, and a cancelled row must not be resurrected and re-confirmed —
// that would test the cancelled-to-confirmed transition, which is not what this
// section is about.
const existingStamped = await rows(traveler.token, `rentivo_bookings?listing_id=eq.${moneyListing.id}&host_id=eq.${hostRow.id}&payment_status=eq.pending&status=neq.cancelled&start_date=gte.${day(WINDOW.from)}&start_date=lte.${day(WINDOW.to)}&order=created_at.desc&select=id&limit=1`)
let stampedId = existingStamped.list[0]?.id ?? null
if (!stampedId) {
  const ins = await insert(traveler.token, 'rentivo_bookings', stampedRow)
  stampedId = Array.isArray(ins.body) ? ins.body[0]?.id : ins.body?.id
  step(!!stampedId, 'a correctly-stamped booking can be created for the policy proof', `${ins.status} ${JSON.stringify(ins.body).slice(0, 120)}`)
} else {
  step(true, 'reusing the correctly-stamped booking from an earlier run', stampedId)
}

const hostSees = await rows(host.token, `rentivo_bookings?id=eq.${stampedId}&select=id,status,payment_status,total_amount,subtotal,guest_name`)
step(hostSees.list.length === 1, 'with host_id present, the host CAN read the booking', `n=${hostSees.list.length}`)
step(hostSees.list[0]?.guest_name === 'E2E Traveler', 'and sees the guest details they need to run the rental', hostSees.list[0]?.guest_name)
step(money(hostSees.list[0]?.subtotal) === PRICE_PER_DAY, 'and the subtotal that will be transferred to them', String(hostSees.list[0]?.subtotal))

const otherHostSees = await rows(host2.token, `rentivo_bookings?id=eq.${stampedId}&select=id`)
step(otherHostSees.list.length === 0, 'a different host still cannot read that booking', `n=${otherHostSees.list.length}`)
const otherHostAll = await rows(host2.token, 'rentivo_bookings?select=id&limit=5')
step(otherHostAll.list.length === 0, 'and cannot read bookings at all (unfiltered probe)', `n=${otherHostAll.list.length}`)

// Reset so the confirm below is a real state change on every run.
await patch(host.token, 'rentivo_bookings', `id=eq.${stampedId}`, { status: 'pending' })
const confirm = await patch(host.token, 'rentivo_bookings', `id=eq.${stampedId}`, { status: 'confirmed' })
step(confirm.status === 200 && confirm.body?.length === 1, 'the host can CONFIRM the booking', `${confirm.status} n=${confirm.body?.length ?? 0} ${String(confirm.body?.message ?? '').slice(0, 80)}`)
const afterConfirm = (await rows(traveler.token, `rentivo_bookings?id=eq.${stampedId}&select=status`)).list[0]
step(afterConfirm?.status === 'confirmed', 'and the confirmation actually persisted', afterConfirm?.status)

const otherHostConfirm = await patch(host2.token, 'rentivo_bookings', `id=eq.${stampedId}`, { status: 'active' })
step(
  otherHostConfirm.status !== 200 || (otherHostConfirm.body?.length ?? 0) === 0,
  'a different host cannot move that booking along',
  `${otherHostConfirm.status} n=${otherHostConfirm.body?.length ?? 0}`,
)
const travelerStatus = await patch(traveler.token, 'rentivo_bookings', `id=eq.${stampedId}`, { status: 'active' })
step(travelerStatus.status >= 400, 'and the traveler cannot drive the status themselves', `${travelerStatus.status} ${String(travelerStatus.body?.message ?? '').slice(0, 70)}`)

section('7 — The host declines a paid booking and a REAL Stripe refund is issued')

const declineBooking = await bookAt(traveler.token, moneyListing.id, WINDOW.from + 10, 'to be declined')
step(!!declineBooking.id, 'second booking created', `${declineBooking.id} @ +${declineBooking.start}d`)
const declinePaid = await payBooking(traveler.token, declineBooking.id)
step(declinePaid.ok, 'and paid', declinePaid.ok ? declinePaid.piId : `${declinePaid.stage}: ${JSON.stringify(declinePaid.detail)}`)
if (!declinePaid.ok) finish()

// cancel-booking authorises the owner through the LISTING (host.auth_id), which
// is why decline works for a host even though the booking carries no host_id.
const declined = await cancelBooking(host.token, declineBooking.id)
step(declined.status === 200, 'the host decline was accepted by cancel-booking', `${declined.status} ${JSON.stringify(declined.body).slice(0, 140)}`)
step(declined.body?.refund_percent === 100, 'an owner-initiated cancellation refunds the traveler in full', String(declined.body?.refund_percent))
step(money(declined.body?.refund_amount) === expectedTotal, 'for the whole amount the traveler paid', String(declined.body?.refund_amount))
step(!!declined.body?.refund_id, 'and a refund id came back', declined.body?.refund_id)

// Ask Stripe, not our columns.
const refund = declined.body?.refund_id
  ? (await stripe(`/refunds/${declined.body.refund_id}`, null, 'GET')).body
  : null
step(refund?.id === declined.body?.refund_id, 'the refund exists in Stripe', refund?.id)
step(refund?.status === 'succeeded' || refund?.status === 'pending', 'and it went through', refund?.status)
step(refund?.amount === expectedTotal * 100, 'for the full charge', `${(refund?.amount ?? 0) / 100} EUR`)
step(refund?.payment_intent === declinePaid.piId, 'against the right PaymentIntent', refund?.payment_intent)

const refundedPi = (await stripe(`/payment_intents/${declinePaid.piId}?expand[]=latest_charge`, null, 'GET')).body
step(refundedPi?.latest_charge?.refunded === true, 'the charge reads as fully refunded at Stripe', String(refundedPi?.latest_charge?.refunded))
step(
  refundedPi?.latest_charge?.amount_refunded === expectedTotal * 100,
  'and the refunded amount matches',
  `${(refundedPi?.latest_charge?.amount_refunded ?? 0) / 100} EUR`,
)

const declinedRow = (await rows(traveler.token, `rentivo_bookings?id=eq.${declineBooking.id}&select=status,payment_status,refund_amount,refund_id,cancelled_at`)).list[0]
step(declinedRow?.status === 'cancelled', 'the booking is cancelled in our data too', declinedRow?.status)
step(declinedRow?.payment_status === 'refunded', 'and reads as refunded', declinedRow?.payment_status)
step(declinedRow?.refund_id === declined.body?.refund_id, 'with the Stripe refund id recorded for support', declinedRow?.refund_id)
step(money(declinedRow?.refund_amount) === expectedTotal, 'and the refunded amount recorded', String(declinedRow?.refund_amount))

const strangerCancel = await cancelBooking(host2.token, booked.id)
step(strangerCancel.status === 403, 'a different host cannot cancel this booking', `${strangerCancel.status} ${JSON.stringify(strangerCancel.body).slice(0, 90)}`)

section('8 — create-payment-intent treats host-owned listings exactly like operator-owned ones')

const piSrc = source(PAYMENT_INTENT_FN)
const cbSrc = source(CREATE_BOOKING_FN)
step(!!piSrc && !!cbSrc, 'both edge functions readable')

step(
  /host:\s*rentivo_hosts\(stripe_account_id,\s*stripe_onboarded\)/.test(piSrc ?? ''),
  'it selects the HOST payout columns alongside the operator ones',
)
step(
  /listing\.owner_type === 'host'\s*\?\s*listing\.host\s*:\s*listing\.operator/.test(piSrc ?? ''),
  "the payout destination is resolved by owner_type, covering owner_type='host'",
  (piSrc ?? '').match(/const owner = [\s\S]{0,120}/)?.[0]?.replace(/\s+/g, ' ').slice(0, 120),
)
step(
  /if \(!owner\?\.stripe_onboarded \|\| !destination \|\| !destination\.startsWith\('acct_'\)\)/.test(piSrc ?? ''),
  'and an owner without an onboarded Connect account is refused, host or operator alike',
)
step(
  /transfer_data: \{ destination \}/.test(piSrc ?? ''),
  'the destination charge is built from that owner, not from the request body',
)
step(
  /const platformFeeCents = Math\.min\(amountCents, Math\.max\(0, amountCents - subtotalCents\)\)/.test(piSrc ?? ''),
  'and the platform fee is total − subtotal for both owner types',
)
// Proved live in section 5 on a host listing: destination = host account,
// application fee = 10% of subtotal, transfer = subtotal.
step(
  pi?.transfer_data?.destination === payoutRow.stripe_account_id && appFee?.amount === expectedFee * 100,
  'and the live host charge behaved identically to the operator case',
  `${pi?.transfer_data?.destination} fee=${(appFee?.amount ?? 0) / 100}`,
)

// What the HOST is told they will receive has to be the same number.
const hostBookingsSrc = source(HOST_BOOKINGS_SCREEN)
step(!!hostBookingsSrc, 'host bookings screen readable', HOST_BOOKINGS_SCREEN)
// Comments stripped: the fix documents the old expression in a comment, and a
// comment is not a payout calculation.
const hostBookingsCode = (hostBookingsSrc ?? '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/[^\n]*$/gm, '')
step(
  !/total_amount\s*\*\s*0\.\d+/.test(hostBookingsCode),
  'the host bookings screen no longer invents a payout percentage',
  hostBookingsCode.match(/total_amount\s*\*\s*0\.\d+/)?.[0] ?? 'none',
)
step(
  /ownerPayout\(booking\)/.test(hostBookingsSrc ?? ''),
  'it quotes ownerPayout(), the same subtotal Stripe transfers',
)
const quoted = payoutUtil.ownerPayout({ subtotal: expectedSubtotal, total_amount: expectedTotal })
step(
  quoted * 100 === (charge?.amount ?? 0) - (appFee?.amount ?? 0),
  'and that number equals what the host was actually paid on this booking',
  `screen says ${quoted} EUR, Stripe sent ${((charge?.amount ?? 0) - (appFee?.amount ?? 0)) / 100} EUR`,
)

// The counterpart that is NOT symmetric: create-booking stamps operator_id only.
step(
  /host_id:\s*listing\.host_id/.test(cbSrc ?? ''),
  'create-booking stamps host_id on the booking it inserts',
  (cbSrc ?? '').match(/operator_id: listing\.operator_id.*/)?.[0]?.trim() ?? 'no operator_id stamp found',
)
step(
  /owner_type:\s*listing\.owner_type/.test(cbSrc ?? '') || /owner_type:\s*listing\.host_id \?/.test(cbSrc ?? ''),
  'and stamps owner_type from the listing',
)

section('9 — Cleanup')

// Leave no live money behind: the paid booking from section 5 is refunded and
// cancelled, and the throwaway probe listing is deleted.
const closed = await cancelBooking(host.token, booked.id)
step(
  closed.status === 200,
  'the paid section-5 booking is cancelled and refunded',
  `${closed.status} refund=${closed.body?.refund_amount} ${closed.body?.refund_id ?? ''}`,
)
const closedRow = (await rows(traveler.token, `rentivo_bookings?id=eq.${booked.id}&select=status,payment_status`)).list[0]
step(closedRow?.status === 'cancelled', 'and reads as cancelled', `${closedRow?.status}/${closedRow?.payment_status}`)

// Sweep: an interrupted run can leave live money on this listing. Refund it.
const stale = await rows(
  traveler.token,
  `rentivo_bookings?listing_id=eq.${moneyListing.id}&payment_status=in.(paid,processing)&status=neq.cancelled&select=id`,
)
for (const row of stale.list) {
  const swept = await cancelBooking(host.token, row.id)
  step(swept.status === 200, 'swept a paid booking left over from an earlier run', `${row.id} -> ${swept.status} refund=${swept.body?.refund_amount}`)
}
const stillLive = await rows(
  traveler.token,
  `rentivo_bookings?listing_id=eq.${moneyListing.id}&payment_status=in.(paid,processing)&status=neq.cancelled&select=id`,
)
step(stillLive.list.length === 0, 'no live money is left on the fixture listing', `n=${stillLive.list.length}`)

// And release the nights, not just the money. The stamped booking from section 6
// is unpaid, so the sweep above leaves it — and an unreleased night is what makes
// the next run of this suite fail on availability instead of on the product.
const released = await releaseWindow(traveler.token, moneyListing.id, WINDOW.from, WINDOW.to)
step(released.stuck.length === 0, 'every night this run held was released', `${released.released.length} of ${released.found} released${released.stuck.length ? ', stuck: ' + released.stuck.join(', ') : ''}`)
const heldAfter = await rows(
  traveler.token,
  `rentivo_bookings?listing_id=eq.${moneyListing.id}&status=neq.cancelled`
  + `&start_date=gte.${day(WINDOW.from)}&start_date=lte.${day(WINDOW.to)}&select=id`,
)
step(heldAfter.list.length === 0, 'no booking of ours is still holding dates in the host window', `n=${heldAfter.list.length}`)

as(host)
let deleteError = null
try { await listingsApi.deleteListing(probe.id, hostRow.id) } catch (e) { deleteError = e }
// deleteListing carries .eq('operator_id', …), so it cannot serve a host either.
step(
  !!deleteError,
  'deleteListing() is operator-only too, so the probe listing is removed by its host policy instead',
  String(deleteError?.message ?? 'it unexpectedly deleted a host listing'),
)
const del = await sb(`/rest/v1/rentivo_listings?id=eq.${probe.id}`, {
  method: 'DELETE', headers: { Prefer: 'return=representation' },
}, host.token)
step(
  (Array.isArray(del.body) ? del.body.length : 0) === 1,
  'the host deleted their own probe listing',
  `${del.status} n=${Array.isArray(del.body) ? del.body.length : '?'}`,
)
const goneCheck = await rows(host.token, `rentivo_listings?id=eq.${probe.id}&select=id`)
step(goneCheck.list.length === 0, 'and it is gone', `n=${goneCheck.list.length}`)

await sleep(200)
finish()
