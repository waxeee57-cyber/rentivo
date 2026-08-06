/**
 * The booking KYC gate, end to end, against the REAL deployed system.
 *
 * Two separate questions, and they have different answers.
 *
 * (a) Can a renter write their own verification row? Until today INSERT and
 *     UPDATE on rentivo_identity_verifications were granted to `anon` and
 *     `authenticated`, and the RLS policy only checked that the row belonged to
 *     the caller — not what it said. So anyone could POST
 *     {user_id: me, status: 'approved'} and be verified. The grants have been
 *     revoked; section 1 proves it.
 *
 * (b) Is the gate enforced anywhere on the SERVER? app/(consumer)/booking/
 *     [listingId].tsx reads the newest verification row and renders a lock
 *     screen instead of the booking form. That is a rendering decision in a
 *     React Native bundle the renter is holding. Section 2 skips the screen
 *     entirely and calls create-booking the way any HTTP client can.
 *
 * The script adapts to the fixture it finds: with no approved verification it
 * proves the closed gate, and once an approved row exists (inserted by SQL,
 * standing in for the Didit webhook) it proves the open one. Run it twice.
 *
 * Run:  node scripts/e2e/identity-gate.mjs
 */
import { sb, signIn, step, section, finish, day, createBooking, releaseWindow } from './_lib.mjs'
import { FIXTURES, PRIVATE_OPERATORS, assertFixture } from './fixtures.mjs'

const ADMIN_EMAIL = 'e2e-admin@rentivo.domrol.com'
const ADMIN_PASS = 'e2e-Admin-Pass-2026!'

/**
 * Its own traveler, not the GDPR subject's account.
 *
 * This suite used to sign in as e2e-gdpr, which admin.mjs bans and un-bans
 * mid-run and gdpr.mjs deletes outright in its erase phase. Three suites
 * sharing one account is the same collision as three suites sharing one
 * listing, one level up.
 */
const USER_EMAIL = 'e2e-identity@rentivo.domrol.com'
const USER_PASS = 'e2e-Identity-Pass-2026!'

/**
 * Its own operator, too. Flipping requires_identity_verification is the whole
 * point of this suite, and it used to flip it on the seeded "Test Operator" —
 * whose auth_id is the PROJECT OWNER's account and whose listings four other
 * suites were booking. They then got a correct-but-unwanted 403 "Identity
 * verification required" from a gate working exactly as designed.
 */
const FX = FIXTURES.identity
const LISTING = FX.listing
const OPERATOR = PRIVATE_OPERATORS.identity

const patch = (token, path, body) =>
  sb(`/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  }, token)

const rows = async (token, path) => {
  const r = await sb(`/rest/v1/${path}`, {}, token)
  return Array.isArray(r.body) ? r.body : []
}

/** A table-level grant refusal: PostgREST maps 42501 to 401/403. */
const grantRefused = res =>
  res.status === 401 || res.status === 403 || res.body?.code === '42501'

async function main() {
  section('accounts')
  const admin = await signIn(ADMIN_EMAIL, ADMIN_PASS)
  const user = await signIn(USER_EMAIL, USER_PASS)
  if (!admin.token || !user.token) {
    console.log('  SETUP  sign-in failed. Confirm the address, then re-run:')
    console.log(`  update auth.users set email_confirmed_at = now() where email in ('${ADMIN_EMAIL}','${USER_EMAIL}') and email_confirmed_at is null;`)
    console.log(`  detail admin=${JSON.stringify(admin.error)} user=${JSON.stringify(user.error)}`)
    process.exit(1)
  }
  step(true, 'signed in as admin', admin.uid)
  step(true, 'signed in as traveler', user.uid)

  // Fail loudly on the wrong operator rather than quietly gating somebody else's.
  const fixture = await assertFixture(sb, 'identity', user.token)
  step(true, 'identity fixture is ours', `${fixture.row.title}, +${FX.from}..+${FX.to}`)

  // A previous run that got past the gate would have left a booking holding
  // these nights. Clearing first is what makes a second run behave like the first.
  const preclean = await releaseWindow(user.token, LISTING, FX.from, FX.to)
  step(preclean.stuck.length === 0, 'window clear before the run', `released ${preclean.released.length} of ${preclean.found}${preclean.stuck.length ? ' stuck: ' + preclean.stuck.join(', ') : ''}`)

  // ── 1. A traveler may not write their own KYC verdict ─────────────────────
  section('1. the traveler cannot write rentivo_identity_verifications')

  const forgedInsert = await sb('/rest/v1/rentivo_identity_verifications', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: user.uid, didit_session_id: `e2e-forged-${Date.now()}`,
      status: 'approved', full_name: 'E2E Forger', liveness_passed: true,
      face_match_score: 99, verified_at: new Date().toISOString(),
    }),
  }, user.token)
  step(
    grantRefused(forgedInsert),
    'INSERT of a self-declared "approved" verification is refused',
    `status=${forgedInsert.status} ${JSON.stringify(forgedInsert.body).slice(0, 180)}`,
  )

  const forgedUpdate = await patch(user.token,
    `rentivo_identity_verifications?user_id=eq.${user.uid}`,
    { status: 'approved', verified_at: new Date().toISOString() })
  step(
    grantRefused(forgedUpdate),
    'UPDATE of an existing verification to "approved" is refused',
    `status=${forgedUpdate.status} ${JSON.stringify(forgedUpdate.body).slice(0, 180)}`,
  )

  const forgedDelete = await sb(
    `/rest/v1/rentivo_identity_verifications?user_id=eq.${user.uid}`, { method: 'DELETE' }, user.token)
  step(
    grantRefused(forgedDelete),
    'DELETE of a declined verification (to retry from clean) is refused',
    `status=${forgedDelete.status} ${JSON.stringify(forgedDelete.body).slice(0, 180)}`,
  )

  const anonInsert = await sb('/rest/v1/rentivo_identity_verifications', {
    method: 'POST',
    body: JSON.stringify({ user_id: user.uid, didit_session_id: `e2e-anon-${Date.now()}`, status: 'approved' }),
  })
  step(
    grantRefused(anonInsert),
    'an anonymous caller cannot insert a verification either',
    `status=${anonInsert.status} ${JSON.stringify(anonInsert.body).slice(0, 180)}`,
  )

  // The traveler must still be able to READ their own status, or the screen has
  // nothing to render.
  const ownRead = await sb(
    `/rest/v1/rentivo_identity_verifications?user_id=eq.${user.uid}&select=status,created_at&order=created_at.desc`,
    {}, user.token)
  step(ownRead.status === 200, 'the traveler can still READ their own verification rows', `status=${ownRead.status}`)
  const newest = Array.isArray(ownRead.body) ? ownRead.body[0] ?? null : null
  const approved = newest?.status === 'approved'
  step(true, 'newest verification row for this traveler', JSON.stringify(newest))

  // ── 2. Turn the operator's requirement on ─────────────────────────────────
  section('2. operator requires identity verification')
  const before = (await rows(admin.token,
    `rentivo_operators?id=eq.${OPERATOR}&select=requires_identity_verification`))[0]
  restoreFlag = before?.requires_identity_verification ?? false
  const flagOn = await patch(admin.token, `rentivo_operators?id=eq.${OPERATOR}`,
    { requires_identity_verification: true })
  step(
    Array.isArray(flagOn.body) && flagOn.body[0]?.requires_identity_verification === true,
    'admin switched requires_identity_verification on',
    `status=${flagOn.status} was=${restoreFlag}`,
  )

  // Exactly what app/(consumer)/booking/[listingId].tsx reads to decide whether
  // to render the lock screen. If this said false the rest would prove nothing.
  const asSeenByClient = await rows(user.token,
    `rentivo_listings?id=eq.${LISTING}&select=id,operator:rentivo_operators(requires_identity_verification,stripe_onboarded,stripe_account_id)`)
  step(
    asSeenByClient[0]?.operator?.requires_identity_verification === true,
    'the booking screen would read requires_identity_verification = true',
    JSON.stringify(asSeenByClient[0]?.operator),
  )

  if (!approved) {
    section('2b. UNVERIFIED traveler — is the gate enforced on the server?')
    step(true, 'precondition: traveler has no approved verification', JSON.stringify(newest))

    const blocked = await createBooking(user.token, {
      listingId: LISTING, start: day(FX.from + 4), end: day(FX.from + 6),
    })
    // The client renders a lock screen; this call never went near the client.
    step(
      blocked.status >= 400,
      'create-booking REFUSES an unverified renter when the operator requires KYC',
      `status=${blocked.status} ${JSON.stringify(blocked.body).slice(0, 200)}`,
    )
    if (blocked.status === 200) {
      const created = await rows(user.token,
        `rentivo_bookings?id=eq.${blocked.body?.booking_id}&select=id,status,payment_status,requires_identity_verification,identity_verified`)
      step(
        false,
        'CRITICAL: the gate is client-side only — an unverified renter booked by calling create-booking directly',
        JSON.stringify(created[0]),
      )
    }

    console.log('\n  NEXT  insert an approved verification (stands in for the Didit webhook) and re-run:')
    console.log(`  insert into public.rentivo_identity_verifications (user_id, didit_session_id, status, document_type, document_country, document_number, full_name, date_of_birth, face_match_score, liveness_passed, verified_at) values ('${user.uid}', 'e2e-didit-${Date.now()}', 'approved', 'passport', 'ES', 'E2E-DOC-001', 'E2E Traveler', '1990-01-01', 98.5, true, now());`)
    return
  }

  // ── 3. Approved verification — the gate opens ─────────────────────────────
  section('3. APPROVED traveler — booking proceeds')
  step(true, 'precondition: traveler has an approved verification', JSON.stringify(newest))
  step(
    newest?.status === 'approved',
    'the booking screen would compute isIdentityApproved = true and render the form',
  )

  const allowed = await createBooking(user.token, {
    listingId: LISTING, start: day(FX.from + 10), end: day(FX.from + 12),
  })
  step(
    allowed.status === 200 && !!allowed.body?.booking_id,
    'create-booking accepts the verified renter',
    `status=${allowed.status} ${JSON.stringify(allowed.body).slice(0, 200)}`,
  )
  if (allowed.body?.booking_id) {
    const row = (await rows(user.token,
      `rentivo_bookings?id=eq.${allowed.body.booking_id}&select=id,status,payment_status,total_amount`))[0]
    step(!!row, 'the booking is readable back by the renter', JSON.stringify(row))
  }
}

// Fixture state main() mutates and cleanup() must put back.
let restoreFlag = null

async function cleanup() {
  section('cleanup')

  // Whatever the gate did, this suite must not leave nights held on its own
  // listing: the open-gate branch books one, and an interrupted run can leave one
  // behind either way. Cancelling is scoped to this suite's listing and window.
  const user = await signIn(USER_EMAIL, USER_PASS)
  if (user.token) {
    const released = await releaseWindow(user.token, LISTING, FX.from, FX.to)
    step(
      released.stuck.length === 0,
      'the identity window holds no booking of ours',
      `${released.released.length} of ${released.found} released${released.stuck.length ? ', stuck: ' + released.stuck.join(', ') : ''}`,
    )
  } else {
    step(false, 'could not sign in to release the identity window', 'bookings may be left holding dates')
  }

  if (restoreFlag === null) return
  const admin = await signIn(ADMIN_EMAIL, ADMIN_PASS)
  if (!admin.token) {
    console.log(`  WARN  could not restore requires_identity_verification=${restoreFlag} on ${OPERATOR}`)
    return
  }
  const r = await patch(admin.token, `rentivo_operators?id=eq.${OPERATOR}`,
    { requires_identity_verification: restoreFlag })
  step(
    Array.isArray(r.body) && r.body[0]?.requires_identity_verification === restoreFlag,
    'operator requires_identity_verification restored',
    `back to ${restoreFlag}`,
  )
}

try {
  await main()
} catch (e) {
  step(false, 'identity-gate.mjs threw', e instanceof Error ? e.stack : String(e))
} finally {
  await cleanup()
}
finish()
