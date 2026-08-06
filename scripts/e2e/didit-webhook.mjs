/**
 * The Didit KYC webhook, against the REAL deployed function.
 *
 * identity-gate.mjs proves the booking gate REFUSES an unverified renter and
 * ACCEPTS an approved one. But it inserts the "approved" row with service-role
 * SQL, standing in for Didit. That leaves the actual question this file exists
 * to answer untested: does the thing that WRITES that row do its job, and can a
 * stranger forge it?
 *
 * didit-webhook is verify_jwt:false — publicly reachable, by design, because
 * Didit's servers call it with no Supabase session. The HMAC-SHA256 signature
 * over the raw body is therefore the ONLY thing between a stranger and a forged
 * "Approved" KYC verdict. If that check is not live in the deployed version,
 * the entire identity gate is bypassable in one POST, and no amount of RLS
 * downstream matters.
 *
 * Two halves:
 *
 *   Always (unattended): forge callbacks with no / wrong / prefixed-garbage
 *   signatures and prove every one is rejected. A 500 "secret not configured"
 *   is surfaced distinctly, because that means the guard is closed but the REAL
 *   Didit flow is also dead — nobody could ever complete KYC.
 *
 *   --prove-success (needs DIDIT_WEBHOOK_SECRET in env + one privileged SQL
 *   step): sign a real Approved payload the way Didit does, POST it, and prove
 *   the verification row flips to approved with the document/face fields mapped
 *   and the user's identity_status set to verified. This is the success path
 *   the guard-half cannot reach without the secret.
 *
 * What NEITHER half can prove, and no test run from here can: that Didit's
 * ACTUAL production signing (header name, hex vs base64, body encoding) matches
 * what this handler assumes. The handler's own comment flags it. That last mile
 * needs a real Didit session and is a go-live checklist item, not a bug.
 *
 * Run:  node scripts/e2e/didit-webhook.mjs
 *       node scripts/e2e/didit-webhook.mjs --prove-success
 */
import { createHmac } from 'node:crypto'
import { sb, signIn, step, section, finish, sleep, SUPABASE_URL } from './_lib.mjs'
import { FIXTURES } from './fixtures.mjs'

const PROVE_SUCCESS = process.argv.includes('--prove-success')
const WAIT_TIMEOUT_MS = Number(process.env.E2E_DIDIT_TIMEOUT_MS ?? 900000)
const SECRET = process.env.DIDIT_WEBHOOK_SECRET ?? ''

// The identity suite's traveler — the one account whose verification state this
// project already treats as fixture, so nothing else collides on it.
const USER_EMAIL = 'e2e-identity@rentivo.domrol.com'
const USER_PASS = 'e2e-Identity-Pass-2026!'

const FN = `${SUPABASE_URL}/functions/v1/didit-webhook`

const rows = async (token, path) => {
  const r = await sb(`/rest/v1/${path}`, {}, token)
  return Array.isArray(r.body) ? r.body : []
}

/** POST a raw body with an arbitrary (or absent) signature header. */
async function postRaw(rawBody, signature) {
  const headers = { 'Content-Type': 'application/json' }
  if (signature !== null) headers['x-signature'] = signature
  const r = await fetch(FN, { method: 'POST', headers, body: rawBody })
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  return { status: r.status, body }
}

const forgedApproved = JSON.stringify({
  session_id: 'e2e-forged-session',
  status: 'Approved',
  vendor_data: '00000000-0000-0000-0000-000000000000',
  document: { type: 'passport', country: 'ES', number: 'FORGED-001', name: 'Mallory Forger' },
  face: { similarity_score: 99, liveness: 'live' },
})

async function main() {
  // ── 1. The guard, always ──────────────────────────────────────────────────
  section('1. a forged callback cannot write an approved KYC verdict')

  const noSig = await postRaw(forgedApproved, null)
  const secretMissing = noSig.status === 500 && String(noSig.body?.error ?? '').includes('not configured')
  if (secretMissing) {
    step(false, 'DIDIT_WEBHOOK_SECRET is set on the deployed function',
      'the webhook returned 500 "not configured" — the guard is closed but the REAL Didit flow is dead: no one can complete KYC')
  } else {
    step(true, 'DIDIT_WEBHOOK_SECRET is set on the deployed function',
      'a forged callback did not get the "not configured" 500, so the secret is present')
  }

  const noSigRejected = noSig.status === 401 || (secretMissing && noSig.status === 500)
  step(noSigRejected, 'a callback with NO signature is rejected',
    `status=${noSig.status} ${JSON.stringify(noSig.body).slice(0, 120)}`)

  const wrong = await postRaw(forgedApproved, 'deadbeef'.repeat(8))
  step(wrong.status === 401 || wrong.status === 500,
    'a callback with a WRONG signature is rejected',
    `status=${wrong.status} ${JSON.stringify(wrong.body).slice(0, 120)}`)

  const prefixed = await postRaw(forgedApproved, 'sha256=' + '00'.repeat(32))
  step(prefixed.status === 401 || prefixed.status === 500,
    'a callback with sha256=<garbage> is rejected',
    `status=${prefixed.status} ${JSON.stringify(prefixed.body).slice(0, 120)}`)

  // Even a signature computed with the WRONG secret must fail. This is the check
  // that would catch a deployed version that verifies against a hard-coded or
  // empty key rather than the configured one.
  const wrongKeySig = createHmac('sha256', 'not-the-real-secret').update(forgedApproved).digest('hex')
  const wrongKey = await postRaw(forgedApproved, wrongKeySig)
  step(wrongKey.status === 401 || wrongKey.status === 500,
    'a callback signed with the WRONG secret is rejected',
    `status=${wrongKey.status} ${JSON.stringify(wrongKey.body).slice(0, 120)}`)

  // And the forgery must not have landed: no verification row for the forged
  // session id exists. Read as the traveler; RLS lets them see only their own,
  // and the forged vendor_data is the zero uuid, so this is belt-and-braces.
  const user = await signIn(USER_EMAIL, USER_PASS)
  if (user.token) {
    const forgedRow = await rows(user.token,
      `rentivo_identity_verifications?didit_session_id=eq.e2e-forged-session&select=id,status`)
    step(forgedRow.length === 0, 'no verification row was written by any forged callback',
      `${forgedRow.length} row(s)`)
  }

  if (!PROVE_SUCCESS) {
    console.log('\n  NOTE  the SUCCESS path (a correctly-signed callback approves a renter) was')
    console.log('        not exercised. It needs DIDIT_WEBHOOK_SECRET and one privileged SQL step:')
    console.log('        node scripts/e2e/didit-webhook.mjs --prove-success')
    return
  }

  // ── 2. The success path ───────────────────────────────────────────────────
  section('2. a correctly-signed Approved callback verifies the renter')

  if (!SECRET) {
    step(false, 'DIDIT_WEBHOOK_SECRET is available to sign a real callback',
      'set it in the environment and re-run: DIDIT_WEBHOOK_SECRET=... node scripts/e2e/didit-webhook.mjs --prove-success')
    return
  }
  if (!user.token) {
    step(false, 'signed in as the identity fixture traveler', JSON.stringify(user.error))
    return
  }

  // A pending row keyed by a session id only this run uses. The traveler cannot
  // INSERT it (that is exactly what identity-gate proves), so it is the one
  // privileged step — same contract as the cancellation-matrix shift.
  const sessionId = `e2e-didit-live-${user.uid.slice(0, 8)}`
  const insertSql = `insert into public.rentivo_identity_verifications (user_id, didit_session_id, status)\nvalues ('${user.uid}', '${sessionId}', 'pending')\non conflict (didit_session_id) do update set status = 'pending', verified_at = null;`

  const pending = await waitFor(
    'a pending verification row exists to be approved',
    insertSql,
    async () => {
      const r = await rows(user.token,
        `rentivo_identity_verifications?didit_session_id=eq.${sessionId}&select=status`)
      return r.length ? r[0] : null
    },
  )
  if (!pending) return

  // Sign the exact bytes, the way the handler recomputes them.
  const payload = JSON.stringify({
    session_id: sessionId,
    status: 'Approved',
    vendor_data: user.uid,
    document: { type: 'Passport', country: 'ES', number: 'E2E-REAL-001', name: 'E2E Identity Traveler', date_of_birth: '1990-01-01', expiry_date: '2032-01-01' },
    face: { similarity_score: 97.5, liveness: 'live' },
  })
  const signature = createHmac('sha256', SECRET).update(payload).digest('hex')

  const accepted = await postRaw(payload, signature)
  step(accepted.status === 200 && accepted.body?.status === 'approved',
    'the signed Approved callback is accepted and reports approved',
    `status=${accepted.status} ${JSON.stringify(accepted.body).slice(0, 140)}`)

  // Read the row back and check the field mapping the handler is responsible for.
  const after = (await rows(user.token,
    `rentivo_identity_verifications?didit_session_id=eq.${sessionId}&select=status,document_type,document_country,full_name,liveness_passed,face_match_score,verified_at`))[0]
  step(after?.status === 'approved', 'the verification row is now approved', JSON.stringify(after))
  step(after?.document_type === 'passport', 'document_type was lowercased on write', `document_type=${after?.document_type}`)
  step(after?.liveness_passed === true, 'liveness "live" mapped to liveness_passed = true', `liveness_passed=${after?.liveness_passed}`)
  step(!!after?.verified_at, 'verified_at was stamped', `verified_at=${after?.verified_at}`)

  // And the user's own status flipped — the flag the booking gate reads.
  const profile = (await rows(user.token,
    `rentivo_users?auth_id=eq.${user.uid}&select=identity_status`))[0]
  step(profile?.identity_status === 'verified',
    'the renter\'s identity_status is now verified — the booking gate would open',
    `identity_status=${profile?.identity_status}`)

  // Put it back, so the next unattended run starts from a clean unverified state
  // (identity-gate.mjs asserts the traveler starts unverified).
  console.log('\n  Run this with the service role to reset the fixture:')
  console.log(`    delete from public.rentivo_identity_verifications where didit_session_id = '${sessionId}';`)
  console.log(`    update public.rentivo_users set identity_status = 'unverified' where auth_id = '${user.uid}';`)
}

/**
 * Print a statement only a privileged role can run, then poll until it lands.
 * Same contract as the start_date shift in cancellation-matrix.
 */
async function waitFor(label, sql, probe) {
  console.log('\n  Run this with the service role (Supabase MCP execute_sql):\n')
  console.log(sql.split('\n').map(l => '    ' + l).join('\n'))
  console.log('')
  const deadline = Date.now() + WAIT_TIMEOUT_MS
  while (Date.now() < deadline) {
    const hit = await probe()
    if (hit) { step(true, label, JSON.stringify(hit)); return hit }
    await sleep(5000)
  }
  step(false, label, `timed out after ${WAIT_TIMEOUT_MS}ms`)
  return null
}

try {
  await main()
} catch (e) {
  step(false, 'didit-webhook.mjs threw', e instanceof Error ? e.stack : String(e))
}
finish()
