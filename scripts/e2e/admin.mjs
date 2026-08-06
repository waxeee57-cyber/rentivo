/**
 * Admin actions, end to end, against the REAL deployed database.
 *
 * The defect this exists to catch: before today there were no admin RLS
 * policies at all, so every admin write matched ZERO rows. PostgREST returns
 * 200 with an empty array for that, supabase-js reports `error: null`, and the
 * screens showed a success toast over a change that never happened. So a passing
 * assertion here is never "the call did not error" — it is always "read the row
 * back and it holds the new value".
 *
 * The mirror image matters just as much: a non-admin performing the same write
 * must be refused, and the refusal is likewise silent (zero rows, no error), so
 * it is proven by reading the row back UNCHANGED.
 *
 * Run:  node scripts/e2e/admin.mjs
 */
import { readFileSync } from 'node:fs'
import {
  sb, signIn, step, section, finish, day, createBooking,
} from './_lib.mjs'

const ADMIN_EMAIL = 'e2e-admin@rentivo.domrol.com'
const ADMIN_PASS = 'e2e-Admin-Pass-2026!'
const USER_EMAIL = 'e2e-gdpr@rentivo.domrol.com'
const USER_PASS = 'e2e-Gdpr-Pass-2026!'

const LISTING = '2ef4cd6e-e925-4509-8d0b-b681fe8f521b'
const OPERATOR = 'f7c4a6b1-d748-4e04-9afd-126f140201e3'
const PROMO_CODE = 'E2EADMIN90'

const confirmHint = email =>
  `run: update auth.users set email_confirmed_at = now() where email = '${email}' and email_confirmed_at is null;`

/** PATCH returning the rows the policy actually let through. */
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

/**
 * A refused write, in either of the two shapes this database produces.
 *
 * RLS refuses by matching zero rows: PostgREST answers 200 with `[]` and
 * supabase-js reports `error: null`, which is precisely why the admin screens
 * used to celebrate writes that never happened. The BEFORE UPDATE guard
 * triggers on rentivo_users / rentivo_operators / rentivo_hosts refuse the
 * louder way, raising insufficient_privilege (SQLSTATE 42501) which surfaces as
 * HTTP 403. Both are refusals; neither is permission to skip reading the row
 * back afterwards, which every caller below still does.
 */
const refused = res => {
  if (res.status === 403 || res.body?.code === '42501') return { ok: true, how: 'trigger 42501' }
  if (Array.isArray(res.body) && res.body.length === 0) return { ok: true, how: 'RLS zero rows' }
  return { ok: false, how: `status=${res.status} body=${JSON.stringify(res.body).slice(0, 160)}` }
}

/**
 * Pull the (table, select) pairs the admin screens actually issue straight out
 * of the shipped source, so this proof tracks the code instead of a copy of it.
 * `app/(admin)/users.tsx` was selecting `full_name`, a column that does not
 * exist; PostgREST answered 42703, the catch showed a generic toast, and the
 * admin user list has been empty for as long as it has existed.
 */
function screenQueries(file) {
  const src = readFileSync(file, 'utf8')
  const out = []
  const re = /\.from\(\s*'([a-z_]+)'\s*\)([\s\S]{0,400}?)\.select\(\s*'([^']*)'/g
  let m
  while ((m = re.exec(src)) !== null) out.push({ table: m[1], select: m[3], file })
  return out
}

async function main() {
  section('accounts')
  const admin = await signIn(ADMIN_EMAIL, ADMIN_PASS)
  if (!admin.token) {
    console.log(`  SETUP  admin sign-in failed. ${confirmHint(ADMIN_EMAIL)}`)
    console.log(`  SETUP  then: update rentivo_users set is_admin = true where email = '${ADMIN_EMAIL}';`)
    console.log(`  detail: ${JSON.stringify(admin.error)}`)
    process.exit(1)
  }
  const user = await signIn(USER_EMAIL, USER_PASS)
  if (!user.token) {
    console.log(`  SETUP  non-admin sign-in failed. ${confirmHint(USER_EMAIL)}`)
    console.log(`  detail: ${JSON.stringify(user.error)}`)
    process.exit(1)
  }
  step(true, 'signed in as admin', admin.uid)
  step(true, 'signed in as non-admin', user.uid)

  // Both accounts need a rentivo_users row: the admin because rentivo_is_admin()
  // reads is_admin off it, the non-admin because it is the ban target.
  for (const who of [{ s: admin, e: ADMIN_EMAIL }, { s: user, e: USER_EMAIL }]) {
    await sb('/rest/v1/rentivo_users', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: who.s.uid, auth_id: who.s.uid, email: who.e, name: 'E2E' }),
    }, who.s.token)
  }

  const adminSelf = await rows(admin.token, `rentivo_users?id=eq.${admin.uid}&select=is_admin`)
  if (!step(adminSelf[0]?.is_admin === true, 'admin account carries is_admin', JSON.stringify(adminSelf))) {
    console.log(`  SETUP  run: update rentivo_users set is_admin = true where email = '${ADMIN_EMAIL}';`)
    finish()
  }

  // ── 1. Ban a user ─────────────────────────────────────────────────────────
  section('1. banning a user persists')
  await patch(admin.token, `rentivo_users?id=eq.${user.uid}`, { is_banned: false })

  const banRes = await patch(admin.token, `rentivo_users?id=eq.${user.uid}`, { is_banned: true })
  step(banRes.status < 300, 'admin ban call returns 2xx', banRes.status)
  step(
    Array.isArray(banRes.body) && banRes.body.length === 1,
    'admin ban touched exactly one row (zero rows is the silent-failure signature)',
    JSON.stringify(banRes.body),
  )
  let after = await rows(admin.token, `rentivo_users?id=eq.${user.uid}&select=is_banned`)
  step(after[0]?.is_banned === true, 'ban is readable back from the database', JSON.stringify(after))

  // ── 2. Non-admin cannot ban ───────────────────────────────────────────────
  section('2. non-admin ban is refused')
  const selfBan = refused(await patch(user.token, `rentivo_users?id=eq.${user.uid}`, { is_banned: false }))
  step(selfBan.ok, 'non-admin unbanning THEMSELVES is refused', selfBan.how)
  after = await rows(admin.token, `rentivo_users?id=eq.${user.uid}&select=is_banned`)
  step(after[0]?.is_banned === true, 'still banned after the non-admin attempt', JSON.stringify(after))

  const banAdmin = refused(await patch(user.token, `rentivo_users?id=eq.${admin.uid}`, { is_banned: true }))
  step(banAdmin.ok, 'non-admin banning ANOTHER user is refused', banAdmin.how)
  const adminRow = await rows(admin.token, `rentivo_users?id=eq.${admin.uid}&select=is_banned`)
  step(adminRow[0]?.is_banned !== true, 'admin account was not banned by the non-admin', JSON.stringify(adminRow))

  // leave the fixture account usable for the other scripts
  await patch(admin.token, `rentivo_users?id=eq.${user.uid}`, { is_banned: false })

  // ── 3. Operator approve + suspend ─────────────────────────────────────────
  // Mutates the shared Test Operator, so the original state is captured first
  // and restored in the finally block at the bottom of main().
  section('3. operator approve + suspend persists')
  const before = (await rows(admin.token, `rentivo_operators?id=eq.${OPERATOR}&select=approved,suspended`))[0]
  step(!!before, 'admin can read the operator row', JSON.stringify(before))
  restoreOperator = before ?? null

  await patch(admin.token, `rentivo_operators?id=eq.${OPERATOR}`, { approved: false, suspended: false })
  const appr = await patch(admin.token, `rentivo_operators?id=eq.${OPERATOR}`, { approved: true })
  step(
    Array.isArray(appr.body) && appr.body.length === 1,
    'admin approve touched exactly one row',
    `status=${appr.status} rows=${JSON.stringify(appr.body)}`,
  )
  let op = (await rows(admin.token, `rentivo_operators?id=eq.${OPERATOR}&select=approved,suspended`))[0]
  step(op?.approved === true, 'approval is readable back', JSON.stringify(op))

  const susp = await patch(admin.token, `rentivo_operators?id=eq.${OPERATOR}`, { suspended: true })
  step(
    Array.isArray(susp.body) && susp.body.length === 1,
    'admin suspend touched exactly one row',
    `status=${susp.status} rows=${JSON.stringify(susp.body)}`,
  )
  op = (await rows(admin.token, `rentivo_operators?id=eq.${OPERATOR}&select=approved,suspended`))[0]
  step(op?.suspended === true, 'suspension is readable back', JSON.stringify(op))

  section('4. non-admin operator writes are refused')
  const opApprove = refused(await patch(user.token, `rentivo_operators?id=eq.${OPERATOR}`, { approved: false }))
  step(opApprove.ok, 'non-admin un-approving an operator is refused', opApprove.how)
  const opUnsusp = refused(await patch(user.token, `rentivo_operators?id=eq.${OPERATOR}`, { suspended: false }))
  step(opUnsusp.ok, 'non-admin un-suspending an operator is refused', opUnsusp.how)
  op = (await rows(admin.token, `rentivo_operators?id=eq.${OPERATOR}&select=approved,suspended`))[0]
  step(
    op?.approved === true && op?.suspended === true,
    'operator still approved+suspended after both non-admin attempts',
    JSON.stringify(op),
  )

  // ── 5. Can a suspended operator simply un-suspend itself? ─────────────────
  // The RLS policy "Operators manage own profile" is cmd=ALL over the operator's
  // own row, so on its own it would let a suspended operator lift its own
  // suspension and walk straight back onto the platform. Proven against a
  // throwaway operator owned by the non-admin account, so the shared fixture is
  // never touched. It owns no listings and is deleted again in cleanup().
  section('5. an operator cannot overturn an admin sanction on itself')
  const own = await sb('/rest/v1/rentivo_operators', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      // active:true on purpose. `Prefer: return=representation` only returns a
      // row the caller may SELECT, and rentivo_operators has no admin SELECT
      // policy — with active:false the admin's own suspension came back as an
      // empty array and looked like a refusal it was not.
      auth_id: user.uid, name: 'E2E Throwaway Operator', slug: `e2e-throwaway-${user.uid.slice(0, 8)}`,
      city: 'Nowhere', active: true,
    }),
  }, user.token)
  ownOperatorId = Array.isArray(own.body) ? own.body[0]?.id ?? null : null
  if (step(!!ownOperatorId, 'created a throwaway operator owned by the non-admin', `status=${own.status}`)) {
    // The sanction must come from the admin — inserting it pre-suspended proves
    // nothing, because the INSERT branch of the guard trigger overwrites
    // approved/suspended for non-admin callers anyway.
    const sanction = await patch(admin.token, `rentivo_operators?id=eq.${ownOperatorId}`, {
      approved: false, suspended: true,
    })
    const sanctioned = Array.isArray(sanction.body) ? sanction.body[0] : null
    step(
      sanctioned?.suspended === true && sanctioned?.approved === false,
      'admin suspended and un-approved the throwaway operator',
      `status=${sanction.status} approved=${sanctioned?.approved} suspended=${sanctioned?.suspended}`,
    )

    const selfLift = refused(await patch(user.token, `rentivo_operators?id=eq.${ownOperatorId}`, {
      approved: true, suspended: false,
    }))
    step(selfLift.ok, 'the operator is refused when it tries to lift its own suspension', selfLift.how)
    const stillSanctioned = (await rows(admin.token,
      `rentivo_operators?id=eq.${ownOperatorId}&select=approved,suspended`))[0]
    step(
      stillSanctioned?.suspended === true && stillSanctioned?.approved === false,
      'the admin sanction survives the operator self-service attempt',
      JSON.stringify(stillSanctioned),
    )
  }

  // ── 6. Promo deactivation actually stops discounting ──────────────────────
  section('6. promo deactivation persists and stops discounting')
  await sb(`/rest/v1/rentivo_promo_codes?code=eq.${PROMO_CODE}`, { method: 'DELETE' }, admin.token)
  const created = await sb('/rest/v1/rentivo_promo_codes', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      code: PROMO_CODE, discount_type: 'percent', discount_value: 90,
      max_uses: 1000, current_uses: 0, min_booking_value: 0, is_active: true,
    }),
  }, admin.token)
  promoCreated = created.status < 300
  step(promoCreated, 'admin can create a promo code', `status=${created.status} ${JSON.stringify(created.body).slice(0, 160)}`)

  // Active code: create-booking must apply the 90% discount. Establishes the
  // baseline, so "no discount" later cannot be mistaken for "the code never
  // worked in the first place".
  // Asserted on total_amount, not promo_discount: create-booking's "reused an
  // existing pending booking" branch returns a shorter payload with no
  // promo_discount field, so a second run of this script read `undefined` and
  // failed on a booking that had in fact been discounted correctly.
  // 2 days x EUR 400 + 10% platform fee = EUR 880 undiscounted.
  const FULL_PRICE = 880
  const active = await createBooking(user.token, {
    listingId: LISTING, start: day(212), end: day(214),
    extra: { promo_code: PROMO_CODE },
  })
  step(
    active.status === 200 && Number(active.body?.total_amount) < FULL_PRICE,
    'while ACTIVE the code discounts a new booking',
    `status=${active.status} total=${active.body?.total_amount} (undiscounted ${FULL_PRICE})`,
  )

  const deact = await patch(admin.token, `rentivo_promo_codes?code=eq.${PROMO_CODE}`, { is_active: false })
  step(
    Array.isArray(deact.body) && deact.body.length === 1,
    'admin deactivate touched exactly one row',
    `status=${deact.status} rows=${JSON.stringify(deact.body).slice(0, 160)}`,
  )
  const promoRow = (await rows(admin.token, `rentivo_promo_codes?code=eq.${PROMO_CODE}&select=is_active`))[0]
  step(promoRow?.is_active === false, 'deactivation is readable back', JSON.stringify(promoRow))

  // Different dates, so create-booking cannot reuse the pending row above.
  const dead = await createBooking(user.token, {
    listingId: LISTING, start: day(216), end: day(218),
    extra: { promo_code: PROMO_CODE },
  })
  step(
    dead.status === 200 && Number(dead.body?.total_amount) === FULL_PRICE,
    'the DEACTIVATED code no longer discounts a new booking',
    `status=${dead.status} total=${dead.body?.total_amount} (undiscounted ${FULL_PRICE})`,
  )

  section('7. non-admin promo writes are refused')
  const promoWrite = refused(await patch(user.token, `rentivo_promo_codes?code=eq.${PROMO_CODE}`, { is_active: true }))
  step(promoWrite.ok, 'non-admin reactivating a promo code is refused', promoWrite.how)
  const stillDead = (await rows(admin.token, `rentivo_promo_codes?code=eq.${PROMO_CODE}&select=is_active`))[0]
  step(stillDead?.is_active === false, 'promo still inactive after the non-admin attempt', JSON.stringify(stillDead))

  // ── 8. Every column each admin screen selects must exist ──────────────────
  // Replayed against the live PostgREST rather than read out of
  // information_schema: a column that is not there answers 400 / 42703, which is
  // exactly the failure that emptied the user list. This checks the shipped
  // source, so a future edit that reintroduces a phantom column fails here.
  section('8. admin screen queries resolve against the real schema')
  const screens = [
    'app/(admin)/users.tsx',
    'app/(admin)/operators.tsx',
    'app/(admin)/promo-codes.tsx',
    'app/(admin)/index.tsx',
  ]
  for (const file of screens) {
    for (const q of screenQueries(file)) {
      const sel = q.select.trim() === '' ? '*' : q.select
      const res = await sb(
        `/rest/v1/${q.table}?select=${encodeURIComponent(sel)}&limit=1`, {}, admin.token,
      )
      step(
        res.status === 200,
        `${file} → ${q.table}.select(${sel.slice(0, 60)}) resolves`,
        `status=${res.status} ${JSON.stringify(res.body).slice(0, 140)}`,
      )
    }
  }

  section('9. admin list screens return rows for an admin, and only for an admin')
  const userList = await rows(admin.token,
    'rentivo_users?select=id,name,email,is_banned,created_at&order=created_at.desc&limit=100')
  step(userList.length > 0, 'admin user list returns rows', `${userList.length} rows`)
  step(
    userList.some(u => u.id === user.uid),
    'admin user list contains an account other than the admin',
    `looking for ${user.uid}`,
  )
  const userListAsUser = await rows(user.token,
    'rentivo_users?select=id,name,email,is_banned,created_at&limit=100')
  step(
    !userListAsUser.some(u => u.id === admin.uid),
    'non-admin cannot read another account from rentivo_users',
    `${userListAsUser.length} rows visible`,
  )

  const opList = await rows(admin.token,
    'rentivo_operators?select=id,name,city,approved,suspended,tier&order=created_at.desc&limit=100')
  step(opList.length > 0, 'admin operator list returns rows', `${opList.length} rows`)
  step(
    opList.some(o => o.id === OPERATOR),
    'admin operator list contains the suspended fixture operator',
    `suspended rows visible: ${opList.filter(o => o.suspended).length}`,
  )

  const promoList = await rows(admin.token,
    'rentivo_promo_codes?select=id,code,discount_value,is_active,current_uses,max_uses')
  step(promoList.length > 0, 'admin promo list returns rows', `${promoList.length} rows`)
  step(
    promoList.some(p => p.code === PROMO_CODE),
    'admin promo list includes the DEACTIVATED code (an admin must see what it switched off)',
  )
  const promoAsUser = await rows(user.token,
    'rentivo_promo_codes?select=id,code,is_active')
  step(
    !promoAsUser.some(p => p.code === PROMO_CODE),
    'non-admin cannot see the deactivated promo code',
    `${promoAsUser.length} rows visible`,
  )

  // ── 10. DSA abuse reports ─────────────────────────────────────────────────
  section('10. rentivo_reports is admin-only and actionable')
  const filed = await sb('/rest/v1/rentivo_reports', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      reporter_id: admin.uid, listing_id: LISTING,
      reason: 'other', description: 'E2E admin proof — safe to delete.',
    }),
  }, admin.token)
  reportId = Array.isArray(filed.body) ? filed.body[0]?.id ?? null : null
  step(!!reportId, 'a report can be filed', `status=${filed.status} ${JSON.stringify(filed.body).slice(0, 160)}`)

  if (reportId) {
    const asAdmin = await rows(admin.token, `rentivo_reports?id=eq.${reportId}&select=id,status,description`)
    step(asAdmin.length === 1, 'admin can READ the report', JSON.stringify(asAdmin).slice(0, 160))

    const acted = await patch(admin.token, `rentivo_reports?id=eq.${reportId}`, {
      status: 'resolved', resolution_notes: 'E2E', resolved_at: new Date().toISOString(),
    })
    step(
      Array.isArray(acted.body) && acted.body.length === 1,
      'admin can ACT on the report (exactly one row changed)',
      `status=${acted.status} rows=${JSON.stringify(acted.body).slice(0, 160)}`,
    )
    const readBack = (await rows(admin.token, `rentivo_reports?id=eq.${reportId}&select=status`))[0]
    step(readBack?.status === 'resolved', 'the resolution is readable back', JSON.stringify(readBack))

    const asUser = await rows(user.token, `rentivo_reports?id=eq.${reportId}&select=id`)
    step(asUser.length === 0, 'a non-admin, non-reporter cannot read the report', `${asUser.length} rows`)

    const asAnon = await rows(undefined, `rentivo_reports?id=eq.${reportId}&select=id`)
    step(asAnon.length === 0, 'an anonymous caller cannot read the report', `${asAnon.length} rows`)

    const userAct = refused(await patch(user.token, `rentivo_reports?id=eq.${reportId}`, { status: 'dismissed' }))
    step(userAct.ok, 'a non-admin cannot act on the report', userAct.how)
  }

  // ── 11. The dashboard's own numbers ───────────────────────────────────────
  // app/(admin)/index.tsx counts bookings and sums paid revenue. Those queries
  // resolve (section 8) but there is no admin SELECT policy on rentivo_bookings,
  // so RLS returns an empty set and the dashboard renders 0 / €0 with no error
  // to show — indistinguishable, from the screen's side, from a platform that
  // has never taken a booking.
  section('11. admin dashboard statistics reflect real data')
  const anyBooking = await rows(admin.token, 'rentivo_bookings?select=id&limit=1')
  step(anyBooking.length > 0, 'an admin can see that bookings exist at all', `${anyBooking.length} rows`)
  const paidRows = await rows(admin.token, 'rentivo_bookings?select=total_amount&payment_status=eq.paid')
  step(paidRows.length > 0, 'an admin can see paid bookings for the revenue tile', `${paidRows.length} rows`)
}

// Fixture state that main() mutates and cleanup() must put back.
let restoreOperator = null
let ownOperatorId = null
let promoCreated = false
let reportId = null

/**
 * The shared Test Operator and the promo table are not ours to leave dirty.
 * Runs whether main() passed, failed or threw.
 */
async function cleanup() {
  const admin = await signIn(ADMIN_EMAIL, ADMIN_PASS)
  if (!admin.token) {
    console.log('  WARN  cleanup could not sign in as admin; fixture left dirty')
    return
  }
  section('cleanup')
  if (restoreOperator) {
    const r = await patch(admin.token, `rentivo_operators?id=eq.${OPERATOR}`, {
      approved: restoreOperator.approved, suspended: restoreOperator.suspended,
    })
    step(
      Array.isArray(r.body) && r.body.length === 1,
      'shared Test Operator restored',
      JSON.stringify(restoreOperator),
    )
  }
  if (ownOperatorId) {
    const user = await signIn(USER_EMAIL, USER_PASS)
    if (user.token) {
      const r = await sb(`/rest/v1/rentivo_operators?id=eq.${ownOperatorId}`, { method: 'DELETE' }, user.token)
      step(r.status < 300, 'throwaway operator deleted', `status=${r.status}`)
    }
  }
  if (promoCreated) {
    const r = await sb(`/rest/v1/rentivo_promo_codes?code=eq.${PROMO_CODE}`, { method: 'DELETE' }, admin.token)
    step(r.status < 300, 'throwaway promo code deleted', `status=${r.status}`)
  }
  if (reportId) {
    const r = await sb(`/rest/v1/rentivo_reports?id=eq.${reportId}`, { method: 'DELETE' }, admin.token)
    step(r.status < 300, 'throwaway report deleted', `status=${r.status}`)
  }
}

try {
  await main()
} catch (e) {
  step(false, 'admin.mjs threw', e instanceof Error ? e.stack : String(e))
} finally {
  await cleanup()
}
finish()
