/**
 * End-to-end proof of the rental contract + e-signature flow, against the REAL
 * deployed project.
 *
 * `uploadContractPDF` was changed to write under a path whose first segment is the
 * uploader's uid (the storage policy on the private `rentivo-contracts` bucket is
 * `(storage.foldername(name))[1] = auth.uid()::text`) and to hand back a SIGNED
 * url instead of a public one. This script proves the upload and the read-back
 * work, that both signatures can be captured in either order, that the database
 * refuses to let a recorded signature be overwritten, and that a zero-row UPDATE
 * cannot be mistaken for a successful signing.
 *
 * It also checks whether any of this is reachable from the app at all. It is not
 * — see the final section. An unreachable signature flow is a finding, so this
 * script exits non-zero by design until the sign screens are wired up.
 *
 * Run from the repo root:  node scripts/e2e/contract.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  sb, signIn, createBooking, payBooking, step, section, finish, day, SUPABASE_URL, ANON,
} from './_lib.mjs'

const LISTING = 'e2ec0000-0000-4e2e-9000-00000000cafe'
const TRAVELER = ['e2e-chat@rentivo.domrol.com', 'e2e-Chat-Pass-2026!']
const OPERATOR = ['e2e-operator@rentivo.domrol.com', 'e2e-Operator-Pass-2026!']
const THIRD = ['e2e-third@rentivo.domrol.com', 'e2e-Third-Pass-2026!']

const BUCKET = 'rentivo-contracts'
const CONSUMER_SIGN = 'app/(consumer)/booking/sign/[bookingId].tsx'
const OPERATOR_SIGN = 'app/(operator)/bookings/sign/[bookingId].tsx'

// ── helpers ─────────────────────────────────────────────────────────────────

async function login(label, [email, password]) {
  const s = await signIn(email, password)
  if (!s.token) {
    console.error(`\nCould not sign in ${label} (${email}).`)
    if (s.needsConfirmation) {
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

/** PATCH returning the affected rows, so a zero-row UPDATE is visible. */
async function patch(token, filter, payload) {
  return sb(`/rest/v1/rentivo_bookings?${filter}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  }, token)
}

/** PATCH the way supabase-js does when no `.select()` is chained. */
async function patchNoSelect(token, filter, payload) {
  return sb(`/rest/v1/rentivo_bookings?${filter}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token)
}

async function bookInWindow(token, label) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const start = 150 + Math.floor(Math.random() * 37)
    const res = await createBooking(token, {
      listingId: LISTING, start: day(start), end: day(start + 2),
    })
    const id = res.body?.booking_id ?? res.body?.booking?.id ?? res.body?.id
    if (res.status === 200 && id) return { id, start }
    const msg = JSON.stringify(res.body ?? '')
    if (!/avail|overlap|conflict|already|booked/i.test(msg)) {
      step(false, `create booking (${label})`, `${res.status} ${msg}`)
      finish()
    }
  }
  step(false, `create booking (${label})`, 'no free window in +150..+188 after 10 tries')
  finish()
}

/** Raw storage upload as `token`, mirroring supabase-js storage.upload(). */
async function storageUpload(token, path, bytes) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: bytes,
  })
  const text = await res.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: res.status, ok: res.ok, body }
}

/** createSignedUrl(). Returns the path-relative signed url the API hands back. */
async function storageSign(token, path, expiresIn) {
  const r = await sb(`/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn }),
  }, token)
  return { status: r.status, signed: r.body?.signedURL ?? r.body?.signedUrl ?? null, body: r.body }
}

/** Walk the app source, skipping node_modules, and collect files matching a test. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.expo') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

function grepRepo(re, roots = ['app', 'lib', 'components', 'hooks']) {
  const hits = []
  for (const root of roots) {
    let files = []
    try { files = walk(root) } catch { continue }
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      src.split(/\r?\n/).forEach((line, i) => {
        if (re.test(line)) hits.push(`${f.replace(/\\/g, '/')}:${i + 1}: ${line.trim()}`)
      })
    }
  }
  return hits
}

function source(rel) {
  try { return readFileSync(rel, 'utf8') } catch { return null }
}

// ── run ─────────────────────────────────────────────────────────────────────

const traveler = await login('traveler', TRAVELER)
const operator = await login('operator', OPERATOR)
const third = await login('third party', THIRD)

section('Setup — a paid booking to hang a contract on')
step(!!traveler.token && !!operator.token && !!third.token, 'three identities signed in')

const A = await bookInWindow(traveler.token, 'contract A')
step(!!A.id, 'booking A created', `${A.id} @ +${A.start}d`)
const paidA = await payBooking(traveler.token, A.id)
step(paidA.ok, 'booking A paid and webhook landed', paidA.ok ? paidA.piId : `${paidA.stage}: ${JSON.stringify(paidA.detail)}`)

section('1 — The contract PDF is stored on the private bucket and reads back')

const pdf = Buffer.from(
  `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
  `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
  `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]>>endobj\n` +
  `% Rentivo E2E rental contract ${A.id}\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
  'utf8',
)

// The path uploadContractPDF used to build. Its first folder is the literal
// "contracts", which is not anyone's uid, so the storage policy rejects it —
// which is why no signed rental agreement ever reached the bucket.
const oldPath = `contracts/${A.id}.pdf`
const oldUpload = await storageUpload(traveler.token, oldPath, pdf)
step(oldUpload.status >= 400, 'the OLD contracts/<id>.pdf path is still rejected by the storage policy', `${oldUpload.status} ${JSON.stringify(oldUpload.body).slice(0, 120)}`)

// The path it builds now.
const goodPath = `${traveler.uid}/${A.id}.pdf`
const upload = await storageUpload(traveler.token, goodPath, pdf)
step(upload.ok, 'the uid-prefixed path uploads successfully', `${upload.status} ${JSON.stringify(upload.body).slice(0, 120)}`)

const TEN_YEARS = 60 * 60 * 24 * 365 * 10
const signed = await storageSign(traveler.token, goodPath, TEN_YEARS)
step(signed.status === 200 && !!signed.signed, 'a signed URL is issued for the stored contract', `${signed.status} ${String(signed.signed).slice(0, 70)}`)

const signedUrl = `${SUPABASE_URL}/storage/v1${signed.signed}`
// No apikey, no Authorization — a signed URL is a capability, and the contract is
// read back months later at pickup, at return and in a dispute.
const fetched = await fetch(signedUrl)
const fetchedBytes = Buffer.from(await fetched.arrayBuffer())
step(fetched.status === 200, 'the signed URL downloads without any auth header', String(fetched.status))
step(fetchedBytes.equals(pdf), 'the bytes read back are byte-for-byte the bytes uploaded', `${fetchedBytes.length}B`)

// getPublicUrl() on a private bucket returns a link that 400s for everyone — the
// reason the old code produced contracts nobody could open.
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${goodPath}`
const publicTry = await fetch(publicUrl)
step(publicTry.status >= 400, 'the /object/public/ URL is NOT readable (bucket really is private)', String(publicTry.status))

// A stranger must not be able to walk the bucket to someone else's contract.
const strangerDl = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${goodPath}`, {
  headers: { apikey: ANON, Authorization: `Bearer ${third.token}` },
})
step(strangerDl.status >= 400, 'a stranger cannot download the contract by path', String(strangerDl.status))

// The url is what the app persists and later opens from the booking screen.
const storeUrl = await patch(traveler.token, `id=eq.${A.id}`, {
  contract_url: signedUrl,
  contract_html: `<html><body>Rentivo E2E contract ${A.id}</body></html>`,
})
step(storeUrl.status === 200 && storeUrl.body?.length === 1, 'contract_url + contract_html stored on the booking', `${storeUrl.status} n=${storeUrl.body?.length}`)
const storedBack = (await rows(traveler.token, `rentivo_bookings?id=eq.${A.id}&select=contract_url,contract_html`)).list[0]
step(storedBack?.contract_url === signedUrl, 'contract_url reads back unchanged')
step(/Rentivo E2E contract/.test(storedBack?.contract_html ?? ''), 'contract_html reads back unchanged')

section('2a — Signatures in the documented order: guest, then operator')

const GUEST_SIG_A = 'M10,10 L60,40 L110,10'
const OP_SIG_A = 'M20,80 L70,50 L120,80'

// Exactly what app/(consumer)/booking/sign writes.
const guestSign = await patch(traveler.token, `id=eq.${A.id}`, {
  guest_signature: GUEST_SIG_A,
  guest_signed_at: new Date().toISOString(),
  contract_status: 'guest_signed',
})
step(guestSign.status === 200 && guestSign.body?.length === 1, 'guest signature UPDATE affected exactly one row', `${guestSign.status} n=${guestSign.body?.length}`)

let a = (await rows(traveler.token, `rentivo_bookings?id=eq.${A.id}&select=guest_signature,guest_signed_at,operator_signature_data,operator_signed_at,contract_status`)).list[0]
step(a?.guest_signature === GUEST_SIG_A, 'guest signature stored')
step(!!a?.guest_signed_at, 'guest_signed_at stamped', a?.guest_signed_at)
step(a?.contract_status === 'guest_signed', 'contract_status advanced to guest_signed', a?.contract_status)
step(a?.operator_signature_data === null, 'operator signature still empty at this point')

// Exactly what app/(operator)/bookings/sign writes.
const opSign = await patch(operator.token, `id=eq.${A.id}`, {
  operator_signature_data: OP_SIG_A,
  operator_signed_at: new Date().toISOString(),
  contract_status: 'fully_signed',
})
step(opSign.status === 200 && opSign.body?.length === 1, 'operator signature UPDATE affected exactly one row', `${opSign.status} n=${opSign.body?.length}`)

a = (await rows(traveler.token, `rentivo_bookings?id=eq.${A.id}&select=guest_signature,operator_signature_data,operator_signed_at,contract_status`)).list[0]
step(a?.operator_signature_data === OP_SIG_A, 'operator signature stored')
step(!!a?.operator_signed_at, 'operator_signed_at stamped', a?.operator_signed_at)
step(a?.contract_status === 'fully_signed', 'contract_status advanced to fully_signed', a?.contract_status)
step(!!a?.guest_signature && !!a?.operator_signature_data, 'both signatures are present when the contract claims to be fully signed')

section('2b — Signatures in the REVERSE order: operator, then guest')

/**
 * The signing step the screens perform, done correctly: write the signature, read
 * the post-write row back, then derive contract_status from what is actually
 * stored. Deriving it is the whole point — a screen that hardcodes 'fully_signed'
 * declares a two-party contract complete while the other party's column is still
 * NULL. Documented states are pending | guest_signed | fully_signed.
 */
async function signAs(token, bookingId, role, signature) {
  const cols = role === 'guest'
    ? { guest_signature: signature, guest_signed_at: new Date().toISOString() }
    : { operator_signature_data: signature, operator_signed_at: new Date().toISOString() }
  const wrote = await patch(token, `id=eq.${bookingId}`, cols)
  if (wrote.status !== 200 || (wrote.body?.length ?? 0) !== 1) {
    return { ok: false, stage: 'signature', detail: `${wrote.status} n=${wrote.body?.length ?? 0}`, row: null }
  }
  const row = wrote.body[0]
  const both = !!row.guest_signature && !!row.operator_signature_data
  const next = both ? 'fully_signed' : (role === 'guest' ? 'guest_signed' : 'pending')
  const statusWrote = await patch(token, `id=eq.${bookingId}`, { contract_status: next })
  if (statusWrote.status !== 200 || (statusWrote.body?.length ?? 0) !== 1) {
    return { ok: false, stage: 'status', detail: `${statusWrote.status} n=${statusWrote.body?.length ?? 0}`, row }
  }
  return { ok: true, row: statusWrote.body[0] }
}

const B = await bookInWindow(traveler.token, 'contract B')
step(!!B.id, 'booking B created for the reverse order', `${B.id} @ +${B.start}d`)

const opFirst = await signAs(operator.token, B.id, 'operator', 'M5,5 L55,35')
step(opFirst.ok, 'operator can sign first', opFirst.ok ? '' : `${opFirst.stage} ${opFirst.detail}`)
step(opFirst.row?.operator_signature_data === 'M5,5 L55,35', 'operator signature stored on B')
step(opFirst.row?.guest_signature === null, 'guest has not signed B yet')
step(
  opFirst.row?.contract_status !== 'fully_signed',
  'contract_status does NOT claim fully_signed with only one signature',
  opFirst.row?.contract_status,
)

const guestSecond = await signAs(traveler.token, B.id, 'guest', 'M8,8 L58,38')
step(guestSecond.ok, 'guest can sign after the operator', guestSecond.ok ? '' : `${guestSecond.stage} ${guestSecond.detail}`)
step(guestSecond.row?.guest_signature === 'M8,8 L58,38', 'guest signature stored on B')
step(
  guestSecond.row?.contract_status === 'fully_signed',
  'reverse order still converges on fully_signed',
  guestSecond.row?.contract_status,
)
step(
  !!guestSecond.row?.guest_signature && !!guestSecond.row?.operator_signature_data,
  'both signatures present when B is declared fully signed',
)

section('3 — A recorded signature cannot be overwritten by either party')

// rentivo_bookings_write_guard raises insufficient_privilege (42501) when a
// non-null signature column is changed to a different value.
const overwrites = [
  ['traveler', traveler.token, { guest_signature: 'M0,0 L1,1 FORGED' }, 'guest signature'],
  ['operator', operator.token, { guest_signature: 'M0,0 L1,1 FORGED' }, 'guest signature'],
  ['traveler', traveler.token, { operator_signature_data: 'M0,0 L1,1 FORGED' }, 'operator signature'],
  ['operator', operator.token, { operator_signature_data: 'M0,0 L1,1 FORGED' }, 'operator signature'],
]
for (const [who, token, payload, what] of overwrites) {
  const attempt = await patch(token, `id=eq.${A.id}`, payload)
  step(attempt.status >= 400, `${who} cannot overwrite the ${what}`, `${attempt.status} ${String(attempt.body?.message ?? '').slice(0, 70)}`)
  step(attempt.body?.code === '42501', `and the trigger is what stopped them (${who} / ${what})`, String(attempt.body?.code))
}

const stillIntact = (await rows(traveler.token, `rentivo_bookings?id=eq.${A.id}&select=guest_signature,operator_signature_data,contract_status`)).list[0]
step(stillIntact?.guest_signature === GUEST_SIG_A, 'the guest signature survived every overwrite attempt')
step(stillIntact?.operator_signature_data === OP_SIG_A, 'the operator signature survived every overwrite attempt')
step(stillIntact?.contract_status === 'fully_signed', 'and the contract is still fully signed')

// Re-writing the IDENTICAL value is a no-op, not a forgery: the guard compares
// with `is distinct from`, so a double-tap on Confirm must not error at the user.
const idempotent = await patch(traveler.token, `id=eq.${A.id}`, { guest_signature: GUEST_SIG_A })
step(idempotent.status === 200, 're-submitting the SAME signature is accepted as a no-op', `${idempotent.status}`)

section('4 — A zero-row UPDATE must never be reported as success')

// A stranger's UPDATE matches nothing under RLS. PostgREST answers 200/204 with no
// error — which is exactly what supabase-js hands the caller. Without checking the
// affected rows, the sign screen shows "Contract signed successfully!" over a
// signature column that is still NULL.
const zeroRepr = await patch(third.token, `id=eq.${A.id}`, { contract_status: 'fully_signed' })
step(zeroRepr.status === 200, 'a stranger UPDATE returns an HTTP SUCCESS status', String(zeroRepr.status))
step((zeroRepr.body?.length ?? 0) === 0, 'but affects zero rows — only visible with .select()', `n=${zeroRepr.body?.length ?? 0}`)

const zeroBare = await patchNoSelect(third.token, `id=eq.${A.id}`, { contract_status: 'fully_signed' })
step(zeroBare.status === 204, 'without .select() the same write looks like a clean 204', String(zeroBare.status))
step(zeroBare.body === null, 'and carries no error for the client to notice', JSON.stringify(zeroBare.body))

const notForged = (await rows(traveler.token, `rentivo_bookings?id=eq.${A.id}&select=contract_status`)).list[0]
step(notForged?.contract_status === 'fully_signed', 'the stranger changed nothing', notForged?.contract_status)

// A booking id that does not exist is the other way a signature silently vanishes.
const ghost = await patch(traveler.token, `id=eq.00000000-0000-4000-8000-000000000000`, { contract_status: 'guest_signed' })
step(ghost.status === 200 && (ghost.body?.length ?? 0) === 0, 'a non-existent booking id also returns success with zero rows', `${ghost.status} n=${ghost.body?.length ?? 0}`)

section('4b — Both sign screens must check the affected rows')

const consumerSign = source(CONSUMER_SIGN)
const operatorSign = source(OPERATOR_SIGN)
step(!!consumerSign, 'consumer sign screen readable', CONSUMER_SIGN)
step(!!operatorSign, 'operator sign screen readable', OPERATOR_SIGN)

for (const [label, src] of [['consumer', consumerSign], ['operator', operatorSign]]) {
  const s = src ?? ''
  step(
    /\.update\(/.test(s) && /\.select\(/.test(s),
    `${label} sign screen chains .select() onto the signature UPDATE`,
  )
  step(
    /data\s*(\.length\s*===\s*0|\?\.length)|!data|length\s*===\s*0/.test(s),
    `${label} sign screen treats a zero-row UPDATE as a failure`,
  )
  step(
    !/contract_status:\s*'(fully_signed|guest_signed)'\s*,/.test(s),
    `${label} sign screen does not hardcode contract_status`,
    (s.match(/contract_status:.*/) ?? [])[0]?.trim(),
  )
  // Either party may sign first, so the status has to be derived from BOTH
  // signature columns rather than from which screen the signer happens to be on.
  step(
    /guest_signature/.test(s) && /operator_signature_data/.test(s) && /contract_status:\s*\w+\s*\?/.test(s),
    `${label} sign screen derives contract_status from both signature columns`,
  )
  step(
    /guest_signature|operator_signature_data/.test(s) && /contract_status/.test(s),
    `${label} sign screen writes the live contract columns`,
  )
}

section('5 — Is any of this reachable from the app?')

// A signature flow that works perfectly but cannot be opened is not a working
// signature flow. These assertions look for a real entry point, not for the route
// registration in _layout.tsx (which only tells expo-router the file exists).
const navToSign = grepRepo(/(router\.(push|replace|navigate)|href\s*=|<Link)[^\n]*(booking|bookings)\/sign\//)
step(navToSign.length > 0, 'something in the app NAVIGATES to a sign screen', navToSign[0] ?? 'no navigation found')

const routeDecls = grepRepo(/Tabs\.Screen\s+name="(booking|bookings)\/sign\//)
console.log(`       route registrations only: ${routeDecls.length}`)
for (const h of routeDecls) console.log(`         ${h}`)

const uploadCallers = grepRepo(/uploadContractPDF\s*\(/).filter(h => !/lib\/storage\.ts/.test(h))
step(uploadCallers.length > 0, 'uploadContractPDF has a caller', uploadCallers[0] ?? 'declared in lib/storage.ts, called by nothing')

const buildCallers = grepRepo(/buildContractPDF\s*\(/).filter(h => !/lib\/utils\/generateContract\.ts/.test(h))
step(buildCallers.length > 0, 'buildContractPDF has a caller', buildCallers[0] ?? 'declared in lib/utils/generateContract.ts, called by nothing')

const saveSigCallers = grepRepo(/saveContractSignature\s*\(/).filter(h => !/lib\/api\/contracts\.ts/.test(h))
step(saveSigCallers.length > 0, 'saveContractSignature has a caller', saveSigCallers[0] ?? 'declared in lib/api/contracts.ts, called by nothing')

// The booking screen offers "View contract" and opens booking.contract_url — but
// nothing in the app or in any edge function ever writes that column.
const urlWriters = grepRepo(/contract_url\s*:/).filter(h => !/mockData\.ts|types\//.test(h))
step(urlWriters.length > 0, 'something writes booking.contract_url', urlWriters[0] ?? 'nothing writes contract_url; the View contract button can never fire')

finish()
