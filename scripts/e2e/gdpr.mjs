/**
 * GDPR erasure (Art. 17) and portability (Art. 20), end to end, against the
 * REAL deployed system, with real Stripe test-mode money.
 *
 * The defect this exists to catch is specific and nasty: delete-account
 * reported `{success: true}` while the auth.users row — email, phone, provider
 * identities — survived. rentivo_bookings.user_id references auth.users with
 * ON DELETE NO ACTION, so for anyone who had ever booked, the final
 * supabase.auth.admin.deleteUser() failed; deleteUser RESOLVES with {error}
 * rather than throwing, and its result was discarded. Nothing downstream ever
 * ran, including the cascade that was supposed to remove the identity
 * verification documents. So: "the call returned success" is never the
 * assertion here. The assertion is always "read it back and it is gone".
 *
 * Phases, because several steps need privileges no client token has:
 *
 *   node scripts/e2e/gdpr.mjs build
 *       Builds a user with real residue — paid booking, wishlist, consent,
 *       notification, conversation, messages — then prints the two rows a
 *       client cannot create (the Didit verification row, and walking the
 *       booking to `completed` so a review can be left).
 *
 *   node scripts/e2e/gdpr.mjs erase
 *       Proves the residue is there, calls delete-account, and proves
 *       everything provable over HTTP. Prints the residue-sweep SQL.
 *
 *   node scripts/e2e/gdpr.mjs residue '<residueJson>' '<bookingJson>' <uid>
 *       Turns the sweep's output into hard assertions. The sweep itself has to
 *       run as a privileged role: auth.users is not reachable through PostgREST
 *       at all, and after erasure the deleted user has no token left to read
 *       with — a check that runs as `anon` and finds nothing has proven only
 *       that RLS works.
 *
 *   node scripts/e2e/gdpr.mjs export
 *       Proves the Article 20 export, driven by the manifest in lib/api/gdpr.ts.
 */
import { readFileSync } from 'node:fs'
import {
  sb, signIn, step, section, finish, day, sleep, releaseWindow,
  createBooking, payBooking, readBooking,
} from './_lib.mjs'
import { FIXTURES, SHARED_OPERATOR, assertFixture } from './fixtures.mjs'

const USER_EMAIL = 'e2e-gdpr@rentivo.domrol.com'
const USER_PASS = 'e2e-Gdpr-Pass-2026!'

/**
 * This suite used to book the seeded "Sea Ray Sundancer", which belongs to the
 * PROJECT OWNER's operator row, in a +200..+240 window admin.mjs was also
 * booking into. It now owns E2E GDPR Car and +220..+260.
 */
const FX = FIXTURES.gdpr
const LISTING = FX.listing
const OPERATOR = SHARED_OPERATOR.id
/** Fixed slot inside the window, cleared at the start of every build. */
const BOOKING_DAY = FX.from + 4
const PLACEHOLDER = '00000000-0000-0000-0000-000000000001'

/** Distinctive enough that the residue sweep cannot match it by accident. */
const PII = {
  guest_name: 'E2E Erasure Subject',
  guest_email: 'e2e-erasure-subject@rentivo.domrol.com',
  guest_phone: '+34600111222',
  driver_license_no: 'E2E-DL-9988776',
}

const rows = async (token, path) => {
  const r = await sb(`/rest/v1/${path}`, {}, token)
  return Array.isArray(r.body) ? r.body : []
}

/**
 * The residue sweep, printed for the operator to run with a privileged role.
 *
 * Columns are enumerated from information_schema, not from a list someone
 * remembered to keep up to date — a residue check that only looks where you
 * thought to look proves nothing. Every uuid column of every rentivo_* base
 * table is compared against the deleted uid, and every text column against the
 * address, so a table added next month is swept without anyone editing this.
 */
const sweepSql = (uid, email) => `
create temp table if not exists _gdpr_sweep(tbl text, col text, needle text, n bigint);
truncate _gdpr_sweep;
do $do$
declare r record; hits bigint;
begin
  for r in
    select col.table_name, col.column_name, col.data_type
    from information_schema.columns col
    join information_schema.tables tab
      on tab.table_schema = col.table_schema
     and tab.table_name = col.table_name
     and tab.table_type = 'BASE TABLE'
    where col.table_schema = 'public'
      and col.table_name like 'rentivo|_%' escape '|'
      and col.data_type in ('uuid', 'text', 'character varying')
  loop
    execute format('select count(*) from public.%I where %I::text = $1', r.table_name, r.column_name)
      into hits using '${uid}';
    if hits > 0 then insert into _gdpr_sweep values (r.table_name, r.column_name, 'uid', hits); end if;

    if r.data_type <> 'uuid' then
      execute format('select count(*) from public.%I where %I::text = $1', r.table_name, r.column_name)
        into hits using '${email}';
      if hits > 0 then insert into _gdpr_sweep values (r.table_name, r.column_name, 'email', hits); end if;
    end if;
  end loop;
end $do$;
select coalesce(jsonb_agg(jsonb_build_object('table', tbl, 'column', col, 'needle', needle, 'rows', n)), '[]'::jsonb) as residue
from _gdpr_sweep;
`.trim()

/** Build a subject with real residue in every table the erasure must touch. */
async function buildResidue(token, uid) {
  section('build: a user with something to erase')

  await sb('/rest/v1/rentivo_users', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: uid, auth_id: uid, email: USER_EMAIL, name: PII.guest_name,
      phone: PII.guest_phone, driver_license_no: PII.driver_license_no,
    }),
  }, token)
  const profile = await rows(token, `rentivo_users?id=eq.${uid}&select=id,email,phone,driver_license_no`)
  step(profile.length === 1, 'profile row', JSON.stringify(profile[0]))

  // A PAID booking. This is the row that used to make deleteUser fail:
  // rentivo_bookings.user_id -> auth.users is ON DELETE NO ACTION.
  //
  // A build leaves this booking behind on purpose — retaining it past erasure is
  // the whole point of Art. 17(3)(b), and the `erase` phase needs it. So the
  // cleanup for this suite runs at the START of a build rather than the end:
  // release whatever the previous build left in this window, then take one fixed
  // slot. That is what lets a second build find free dates, and it replaced a
  // "scan forward from +200 in steps of two until something is free" loop that
  // silently walked into whichever suite owned the next window along.
  const released = await releaseWindow(token, LISTING, FX.from, FX.to)
  step(
    released.stuck.length === 0,
    'the previous build\'s retained booking was released',
    `${released.released.length} of ${released.found} released${released.stuck.length ? ', stuck: ' + released.stuck.join(', ') : ''}`,
  )

  const created = await createBooking(token, {
    listingId: LISTING, start: day(BOOKING_DAY), end: day(BOOKING_DAY + 2), extra: PII,
  })
  if (created.status !== 200 || !created.body?.booking_id) {
    step(false, 'booking created',
      `status=${created.status} ${JSON.stringify(created.body).slice(0, 160)}`)
    return null
  }
  step(true, 'booking created', `+${BOOKING_DAY}..+${BOOKING_DAY + 2} days, id=${created.body.booking_id}`)
  const bookingId = created.body.booking_id

  const paid = await payBooking(token, bookingId)
  step(paid.ok, 'booking PAID through Stripe test mode + real webhook',
    paid.ok ? `pi=${paid.piId}` : `${paid.stage}: ${JSON.stringify(paid.detail).slice(0, 160)}`)

  const booked = await readBooking(token, bookingId,
    'id,user_id,guest_name,guest_email,guest_phone,driver_license_no,payment_status,total_amount')
  step(
    booked?.guest_email === PII.guest_email && booked?.driver_license_no === PII.driver_license_no,
    'the booking carries the guest name, email, phone and licence number',
    JSON.stringify(booked),
  )
  return { bookingId, booking: booked }
}

/** Everything else the erasure has to reach. */
async function buildSatellites(token, uid, bookingId) {
  // on_conflict has to NAME the constraint. `resolution=merge-duplicates` alone
  // targets the PRIMARY KEY, and on both of these tables the primary key is a
  // generated `id` while the real identity is a separate UNIQUE — so the second
  // run of this build inserted a fresh id, tripped the unique index, and got a
  // 409 that had nothing to do with GDPR. Same shape as supabase-js
  // `.upsert(row, { onConflict: 'user_id' })`.
  const wish = await sb('/rest/v1/rentivo_wishlist?on_conflict=user_id,listing_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: uid, listing_id: LISTING }),
  }, token)
  step(wish.status < 300, 'wishlist item', `status=${wish.status}`)

  const consent = await sb('/rest/v1/rentivo_consent?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: uid, marketing_email: true, marketing_email_at: new Date().toISOString(),
      analytics: true, ip_address: '203.0.113.7', user_agent: 'e2e/gdpr',
    }),
  }, token)
  step(consent.status < 300, 'consent row', `status=${consent.status}`)

  const notif = await sb('/rest/v1/rentivo_notifications', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: uid, type: 'booking', title: 'E2E erasure fixture notification',
      body: PII.guest_email,
    }),
  }, token)
  step(notif.status < 300, 'notification', `status=${notif.status} ${JSON.stringify(notif.body).slice(0, 140)}`)

  const conv = await sb('/rest/v1/rentivo_conversations', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      booking_id: bookingId, listing_id: LISTING, operator_id: OPERATOR,
      user_id: uid, guest_name: PII.guest_name, guest_phone: PII.guest_phone,
    }),
  }, token)
  const convId = Array.isArray(conv.body) ? conv.body[0]?.id ?? null : null
  step(!!convId, 'conversation', `status=${conv.status} ${JSON.stringify(conv.body).slice(0, 140)}`)

  let messageCount = 0
  if (convId) {
    for (const content of ['E2E fixture message one.', `Reach me on ${PII.guest_phone}.`]) {
      const msg = await sb('/rest/v1/rentivo_messages', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          conversation_id: convId, sender_role: 'consumer', sender_id: uid, content,
        }),
      }, token)
      if (msg.status < 300) messageCount++
    }
  }
  step(messageCount === 2, 'messages', `${messageCount} of 2 inserted`)
  return { convId }
}

/**
 * The two fixture rows a client token cannot produce, and why.
 *
 * The identity verification row is written by the Didit webhook with
 * service_role; the traveler has no INSERT grant at all, which is precisely
 * what identity-gate.mjs proves. And a BEFORE UPDATE trigger refuses "A
 * traveler cannot change booking status directly", so the rental cannot be
 * walked to `completed` from here — and rentivo_reviews has its own trigger
 * refusing "Can only review completed bookings". Both are correct guards; the
 * fixture works with them rather than around them.
 */
function printSetupSql(uid, bookingId) {
  console.log('\n  SETUP  run these as a privileged role, then: node scripts/e2e/gdpr.mjs erase\n')
  console.log(`insert into public.rentivo_identity_verifications (user_id, didit_session_id, status, document_type, document_country, document_number, full_name, date_of_birth, face_match_score, liveness_passed, verified_at)`)
  console.log(`values ('${uid}', 'e2e-didit-${Date.now()}', 'approved', 'passport', 'ES', 'E2E-DOC-001', 'E2E Traveler', '1990-01-01', 98.5, true, now())`)
  console.log(`on conflict do nothing;`)
  console.log(`update public.rentivo_bookings set status = 'completed' where id = '${bookingId}';\n`)
}

async function signInSubject() {
  const user = await signIn(USER_EMAIL, USER_PASS)
  if (!user.token) {
    console.log(`  SETUP  sign-in failed. The erase phase deletes this account, so re-create it, then:`)
    console.log(`  update auth.users set email_confirmed_at = now() where email = '${USER_EMAIL}' and email_confirmed_at is null;`)
    console.log(`  detail: ${JSON.stringify(user.error)}`)
    process.exit(1)
  }
  step(true, 'signed in as the erasure subject', user.uid)
  return user
}

async function build() {
  const user = await signInSubject()
  // Fail loudly on the wrong vehicle rather than quietly parking PII on it.
  const fixture = await assertFixture(sb, 'gdpr', user.token)
  step(true, 'gdpr fixture is ours', `${fixture.row.title}, +${FX.from}..+${FX.to}`)
  const built = await buildResidue(user.token, user.uid)
  if (!built) return
  await buildSatellites(user.token, user.uid, built.bookingId)

  // Exactly one booking is left holding dates, in this suite's own window, and
  // the next build releases it. Assert that rather than trusting it.
  const held = await rows(user.token,
    `rentivo_bookings?listing_id=eq.${LISTING}&status=neq.cancelled`
    + `&start_date=gte.${day(FX.from)}&start_date=lte.${day(FX.to)}&select=id`)
  step(
    held.length === 1 && held[0].id === built.bookingId,
    'exactly one retained booking is left in the gdpr window, and it is this run\'s',
    `${held.length} row(s)`,
  )
  printSetupSql(user.uid, built.bookingId)
}

async function erase() {
  const user = await signInSubject()
  const uid = user.uid

  section('erase: the fixture is complete before anything is deleted')
  const paidBookings = await rows(user.token,
    'rentivo_bookings?payment_status=eq.paid&select=id,status,guest_name,guest_email,guest_phone,driver_license_no&order=created_at.desc')
  const built = { bookingId: paidBookings[0]?.id ?? null }
  if (!step(!!built.bookingId, 'a paid booking exists to retain',
    `${paidBookings.length} paid bookings — run "node scripts/e2e/gdpr.mjs build" first`)) return
  step(
    paidBookings[0]?.guest_email === PII.guest_email
      && paidBookings[0]?.driver_license_no === PII.driver_license_no,
    'it carries the guest name, email, phone and licence number',
    JSON.stringify(paidBookings[0]),
  )

  const idv = await rows(user.token,
    `rentivo_identity_verifications?user_id=eq.${uid}&select=id,status,document_number,full_name,date_of_birth,face_match_score`)
  if (!step(idv.length > 0,
    'identity verification row present — the most sensitive data in the system',
    JSON.stringify(idv[0]))) {
    printSetupSql(uid, built.bookingId)
    return
  }

  // The review has to be left through the real API, past both guards.
  //
  // This leg is currently unbuildable, and not because of anything GDPR.
  // handle_booking_completed() INSERTs into rentivo_loyalty (user_id,
  // booking_id, points, total_earned, reason, created_at) and that table has
  // neither `reason` nor `created_at`, so every attempt to move a booking to
  // `completed` aborts with 42703 — no booking in this database has ever
  // reached completed, rentivo_reviews is empty, rentivo_loyalty is empty, and
  // check_review_eligibility refuses every review as a direct consequence.
  // Deliberately non-fatal: the rest of the erasure proof is unaffected, and
  // silently skipping this would hide a defect rather than surface it.
  const review = await sb('/rest/v1/rentivo_reviews', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      booking_id: built.bookingId, listing_id: LISTING, operator_id: OPERATOR,
      user_id: uid, rating: 5, comment: 'E2E erasure fixture review.',
    }),
  }, user.token)
  const sat = { reviewId: Array.isArray(review.body) ? review.body[0]?.id ?? null : null }
  step(!!sat.reviewId, 'review left on the completed booking',
    `status=${review.status} ${JSON.stringify(review.body).slice(0, 160)}`)
  if (!sat.reviewId) {
    console.log('  CAUSE  bookings cannot reach `completed`: handle_booking_completed() writes')
    console.log('         rentivo_loyalty.reason / .created_at, and neither column exists (42703).')
    console.log('         Review anonymisation in delete-account step 5 is therefore UNPROVEN here.')
  }

  for (const [label, path] of [
    ['wishlist', `rentivo_wishlist?user_id=eq.${uid}&select=id`],
    ['consent', `rentivo_consent?user_id=eq.${uid}&select=id`],
    ['notification', `rentivo_notifications?user_id=eq.${uid}&select=id`],
    ['conversation', `rentivo_conversations?user_id=eq.${uid}&select=id`],
    ['messages', `rentivo_messages?sender_id=eq.${uid}&select=id`],
  ]) {
    const present = await rows(user.token, path)
    step(present.length > 0, `${label} present before erasure`, `${present.length} rows`)
  }

  // ── The erasure request ───────────────────────────────────────────────────
  section('erase: POST /functions/v1/delete-account')
  const res = await sb('/functions/v1/delete-account', { method: 'POST' }, user.token)
  step(res.status === 200 && res.body?.success === true,
    'delete-account reports success',
    `status=${res.status} ${JSON.stringify(res.body).slice(0, 200)}`)

  await sleep(1500)

  // ── The combination that was the bug ──────────────────────────────────────
  // Success was reported while the auth row survived. Reported success is only
  // half an assertion; the other half is that the credentials are gone.
  section('erase: the auth.users row is actually gone')
  const grant = await sb('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: USER_EMAIL, password: USER_PASS }),
  })
  step(
    grant.status !== 200,
    'the erased account can no longer obtain a token with its own password',
    `status=${grant.status} ${JSON.stringify(grant.body).slice(0, 160)}`,
  )

  const whoami = await sb('/auth/v1/user', {}, user.token)
  step(
    whoami.status >= 400,
    'the access token issued before erasure is now rejected',
    `status=${whoami.status} ${JSON.stringify(whoami.body).slice(0, 160)}`,
  )

  // ── What SHOULD survive ───────────────────────────────────────────────────
  // rentivo_reviews is world-readable ("Anyone can view reviews"), so the
  // anonymised review can be checked without any privilege at all.
  section('erase: reviews survive, anonymised')
  if (sat.reviewId) {
    const review = (await rows(undefined, `rentivo_reviews?id=eq.${sat.reviewId}&select=id,user_id,rating,comment`))[0]
    step(!!review, 'the review row still exists', JSON.stringify(review))
    step(
      review?.user_id === PLACEHOLDER,
      'the review is repointed to the placeholder user, not to the erased uid',
      `user_id=${review?.user_id}`,
    )
  }

  section('erase: nothing the subject owned is readable any more')
  for (const [label, path] of [
    ['wishlist', `rentivo_wishlist?user_id=eq.${uid}&select=id`],
    ['consent', `rentivo_consent?user_id=eq.${uid}&select=id`],
    ['notifications', `rentivo_notifications?user_id=eq.${uid}&select=id`],
    ['identity verifications', `rentivo_identity_verifications?user_id=eq.${uid}&select=id`],
    ['conversations', `rentivo_conversations?user_id=eq.${uid}&select=id`],
    ['profile', `rentivo_users?id=eq.${uid}&select=id`],
  ]) {
    const anon = await rows(undefined, path)
    step(anon.length === 0, `${label}: nothing visible to an anonymous caller`, `${anon.length} rows`)
  }
  console.log('\n  NOTE  the checks above are necessary but NOT sufficient: an anonymous')
  console.log('        caller sees nothing whether the row was deleted or merely hidden by')
  console.log('        RLS. Run the privileged sweep next and feed it back:')
  console.log(`\n${sweepSql(uid, USER_EMAIL)}\n`)
  console.log('  and the retained booking, which must have survived anonymised:')
  console.log(`  select id, user_id, guest_name, guest_email, guest_phone, driver_license_no, payment_status, total_amount from public.rentivo_bookings where id = '${built.bookingId}';\n`)
  console.log(`  then: node scripts/e2e/gdpr.mjs residue "<residue json>" "<booking row json>" ${uid}`)
}

/**
 * Turn the privileged sweep into hard assertions.
 *
 * Exactly one reference to the erased uid is lawful: none. The bookings row is
 * kept for the financial retention obligation (Art. 17(3)(b)) but is repointed
 * to the placeholder user, so it must not carry the uid either. Anything else
 * the sweep returns is residue.
 */
/**
 * Accept the sweep output as raw JSON or base64. PowerShell mangles embedded
 * double quotes badly enough to turn a valid payload into a parse error that
 * looks like a failing assertion, so base64 is the reliable route on Windows.
 */
function decodeArg(v) {
  if (!v) return v
  const s = String(v).trim()
  if (s.startsWith('[') || s.startsWith('{')) return s
  try { return Buffer.from(s, 'base64').toString('utf8') } catch { return s }
}

function residue(argv) {
  const raw = decodeArg(argv[0])
  const bookingRaw = decodeArg(argv[1])
  const uid = argv[2]
  section('residue: the privileged, information_schema-driven sweep')
  let hits
  try {
    hits = JSON.parse(raw)
  } catch {
    step(false, 'residue argument is valid JSON', String(raw).slice(0, 200))
    return
  }
  step(Array.isArray(hits), 'sweep returned a list', JSON.stringify(hits).slice(0, 200))
  if (!Array.isArray(hits)) return

  step(
    hits.length === 0,
    `no rentivo_* column anywhere still references the erased uid or its email`,
    hits.length === 0 ? `uid=${uid}` : JSON.stringify(hits),
  )
  for (const h of hits) {
    step(false, `RESIDUE: ${h.table}.${h.column} still holds the ${h.needle}`, `${h.rows} row(s)`)
  }

  // ── What must SURVIVE, and in what shape ──────────────────────────────────
  // Art. 17(3)(b): the booking is kept for the financial retention obligation.
  // Kept is not the same as untouched — it must no longer identify anyone.
  section('residue: the retained booking is anonymised, not merely retained')
  if (!bookingRaw) {
    step(false, 'booking row was passed in',
      'run: select id, user_id, guest_name, guest_email, guest_phone, driver_license_no, payment_status, total_amount from public.rentivo_bookings where id = ...')
    return
  }
  let booking
  try {
    booking = JSON.parse(bookingRaw)
    if (Array.isArray(booking)) booking = booking[0]
  } catch {
    step(false, 'booking argument is valid JSON', String(bookingRaw).slice(0, 200))
    return
  }

  step(!!booking?.id, 'the paid booking still exists', JSON.stringify(booking))
  step(booking?.payment_status === 'paid', 'it is still marked paid, so finance keeps its record',
    `payment_status=${booking?.payment_status} total=${booking?.total_amount}`)
  step(booking?.user_id === PLACEHOLDER,
    'user_id is repointed to the placeholder, not left pointing at the erased account',
    `user_id=${booking?.user_id}`)
  step(booking?.user_id !== uid, 'user_id is not the erased uid', `user_id=${booking?.user_id}`)

  for (const [field, was] of Object.entries(PII)) {
    const now = booking?.[field]
    step(now !== was, `booking.${field} no longer carries the guest value`, `now=${JSON.stringify(now)}`)
  }
  step(booking?.guest_phone === null, 'booking.guest_phone is null', `now=${JSON.stringify(booking?.guest_phone)}`)
  step(booking?.driver_license_no === null, 'booking.driver_license_no is null',
    `now=${JSON.stringify(booking?.driver_license_no)}`)
}

/**
 * Article 20 — data portability.
 *
 * privacy-settings.tsx's handleExport used to raise an Alert saying the data
 * would arrive by email within 30 days, and produce nothing: no job, no mail,
 * no file. lib/api/gdpr.ts now gathers the subject's rows and writes a file.
 *
 * The manifest is read out of the shipped module and replayed against the real
 * API, so this proves the list the app actually ships rather than a copy of it
 * that could drift.
 */
async function exportProof() {
  const user = await signIn(USER_EMAIL, USER_PASS)
  if (!user.token) {
    console.log(`  SETUP  sign-in failed (the erase phase deletes this account; rebuild it first).`)
    console.log(`  detail: ${JSON.stringify(user.error)}`)
    process.exit(1)
  }
  section('export: the manifest in lib/api/gdpr.ts')
  const src = readFileSync('lib/api/gdpr.ts', 'utf8')
  const block = src.match(/GDPR_EXPORT_SOURCES[\s\S]*?=\s*\[([\s\S]*?)\n\]/)
  step(!!block, 'GDPR_EXPORT_SOURCES manifest found in lib/api/gdpr.ts')
  if (!block) return

  const sources = [...block[1].matchAll(/table:\s*'([a-z_]+)'\s*,\s*column:\s*'([a-z_]+)'/g)]
    .map(m => ({ table: m[1], column: m[2] }))
  step(sources.length > 0, 'manifest parses', `${sources.length} sources`)

  // Every source must resolve. A 400 here is a table or column that does not
  // exist, which in the app would be a silent hole in the export.
  const payload = {}
  for (const s of sources) {
    const res = await sb(
      `/rest/v1/${s.table}?select=*&${s.column}=eq.${user.uid}`, {}, user.token)
    step(res.status === 200, `${s.table}.${s.column} resolves`,
      `status=${res.status} ${JSON.stringify(res.body).slice(0, 120)}`)
    if (res.status === 200) payload[`${s.table}.${s.column}`] = res.body
  }

  // The export is worthless if it is empty where the subject has data.
  section('export: the subject\'s actual rows are in it')
  for (const key of [
    'rentivo_users.id',
    'rentivo_bookings.user_id',
    'rentivo_identity_verifications.user_id',
  ]) {
    step((payload[key] ?? []).length > 0, `${key} contributes rows`, `${(payload[key] ?? []).length} rows`)
  }

  const json = JSON.stringify(payload)
  step(json.includes(user.uid), 'the export contains the subject uid')
  step(json.includes(USER_EMAIL), 'the export contains the subject email address')

  // Every table the erasure touches must also be exportable, or the subject can
  // be erased from data they were never able to obtain a copy of.
  section('export: covers every table the erasure reaches')
  const erasureTables = [
    'rentivo_users', 'rentivo_bookings', 'rentivo_reviews', 'rentivo_wishlist',
    'rentivo_notifications', 'rentivo_loyalty', 'rentivo_consent',
    'rentivo_identity_verifications', 'rentivo_disputes', 'rentivo_conversations',
    'rentivo_messages', 'rentivo_operators', 'rentivo_hosts',
  ]
  const covered = new Set(sources.map(s => s.table))
  for (const t of erasureTables) {
    step(covered.has(t), `${t} is in the export manifest`)
  }
}

const phase = process.argv[2] ?? 'build'
try {
  if (phase === 'build') await build()
  else if (phase === 'erase') await erase()
  else if (phase === 'residue') residue(process.argv.slice(3))
  else if (phase === 'export') await exportProof()
  else {
    console.log('usage: node scripts/e2e/gdpr.mjs [build | erase | residue <residueJson> <bookingJson> <uid> | export]')
    process.exit(1)
  }
} catch (e) {
  step(false, `gdpr.mjs (${phase}) threw`, e instanceof Error ? e.stack : String(e))
}
finish()
