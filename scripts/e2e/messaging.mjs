/**
 * End-to-end proof of the booking chat flow, against the REAL deployed project.
 *
 * Until recently `rentivo_conversations` had RLS enabled with no INSERT policy, so
 * no conversation row could ever be created and every message a user typed was
 * dropped. A `conv_participant_insert` policy, a UNIQUE index on `booking_id` and
 * an operator/host branch on the `rentivo_messages` policies were added. This
 * script proves the whole path works now, and — more importantly — proves the
 * isolation holds: a signed-in stranger must not be able to read or write a
 * conversation they are not a party to.
 *
 * Nothing here is mocked. Real accounts, real edge functions, real Stripe test
 * money, real RLS.
 *
 * Run from the repo root:  node scripts/e2e/messaging.mjs
 */
import { readFileSync } from 'node:fs'
import {
  sb, signIn, createBooking, payBooking, step, section, finish, day,
} from './_lib.mjs'

/**
 * An operator-owned COPY of the Porsche Cayenne fixture, pointed at an operator
 * row whose auth_id is the e2e-operator account below. The seeded operator's
 * auth_id belongs to the project owner, who must not be signed in as, so the
 * operator side of the chat needed an identity this script actually controls.
 * The original listing 401fd88c-… is left exactly as it was.
 */
const LISTING = 'e2ec0000-0000-4e2e-9000-00000000cafe'

const TRAVELER = ['e2e-chat@rentivo.domrol.com', 'e2e-Chat-Pass-2026!']
const OPERATOR = ['e2e-operator@rentivo.domrol.com', 'e2e-Operator-Pass-2026!']
const THIRD = ['e2e-third@rentivo.domrol.com', 'e2e-Third-Pass-2026!']

const CONSUMER_SCREEN = 'app/(consumer)/bookings/chat/[bookingId].tsx'
const OPERATOR_SCREEN = 'app/(operator)/bookings/chat/[bookingId].tsx'

// ── helpers ─────────────────────────────────────────────────────────────────

async function login(label, [email, password]) {
  const s = await signIn(email, password)
  if (!s.token) {
    console.error(`\nCould not sign in ${label} (${email}).`)
    if (s.needsConfirmation) {
      console.error('The account exists but its email is unconfirmed. Run:')
      console.error(`  update auth.users set email_confirmed_at = now() where email = '${email}' and email_confirmed_at is null;`)
      console.error('then re-run this script.')
    } else {
      console.error(JSON.stringify(s.error))
    }
    process.exit(1)
  }
  return s
}

/** REST read as `token`; returns the raw array so callers can assert on length. */
async function rows(token, path) {
  const r = await sb(`/rest/v1/${path}`, {}, token)
  return { status: r.status, body: r.body, list: Array.isArray(r.body) ? r.body : [] }
}

/** Insert returning the created row(s). Mirrors supabase-js `.insert().select()`. */
async function insert(token, table, payload) {
  return sb(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
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

/**
 * Book the fixture listing inside the +150..+190 day window this task owns.
 *
 * Re-runs would otherwise pile bookings onto the same nights and start failing on
 * availability, so pick a random window and retry a few times rather than
 * hard-coding dates that rot after the first green run.
 */
async function bookInWindow(token, label) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const start = 150 + Math.floor(Math.random() * 37) // 150..186, +2 days stays <= 188
    const res = await createBooking(token, {
      listingId: LISTING,
      start: day(start),
      end: day(start + 2),
    })
    const id = res.body?.booking?.id ?? res.body?.booking_id ?? res.body?.id
    if (res.status === 200 && id) return { id, start, res }
    // Anything other than a date clash is a real failure — surface it immediately.
    const msg = JSON.stringify(res.body ?? '')
    if (!/avail|overlap|conflict|already|booked/i.test(msg)) {
      step(false, `create booking (${label})`, `${res.status} ${msg}`)
      finish()
    }
  }
  step(false, `create booking (${label})`, 'no free window in +150..+188 after 10 tries')
  finish()
}

function source(relPath) {
  try { return readFileSync(relPath, 'utf8') } catch { return null }
}

// ── run ─────────────────────────────────────────────────────────────────────

const traveler = await login('traveler', TRAVELER)
const operator = await login('operator', OPERATOR)
const third = await login('third party', THIRD)

section('Setup — accounts and a paid booking')
step(!!traveler.token, 'traveler signed in', traveler.uid)
step(!!operator.token, 'operator signed in', operator.uid)
step(!!third.token, 'third party signed in', third.uid)
step(
  new Set([traveler.uid, operator.uid, third.uid]).size === 3,
  'the three identities are distinct',
)

const booked = await bookInWindow(traveler.token, 'main')
const bookingId = booked.id
step(!!bookingId, 'booking created on the fixture listing', `${bookingId} @ +${booked.start}d`)

const paid = await payBooking(traveler.token, bookingId)
step(paid.ok, 'booking paid and webhook landed', paid.ok ? paid.piId : `${paid.stage}: ${JSON.stringify(paid.detail)}`)

const bk = await rows(traveler.token, `rentivo_bookings?id=eq.${bookingId}&select=listing_id,operator_id,host_id,user_id`)
const booking = bk.list[0] ?? null
step(!!booking, 'booking readable by the traveler', JSON.stringify(booking))
step(booking?.user_id === traveler.uid, 'booking belongs to the traveler')
step(!!booking?.operator_id && !booking?.host_id, 'booking is operator-owned (exactly one owner id)')

section('1 — Traveler opens the conversation and sends a message')

// Exactly the payload app/(consumer)/bookings/chat/[bookingId].tsx builds.
const convIns = await insert(traveler.token, 'rentivo_conversations', {
  booking_id: bookingId,
  listing_id: booking?.listing_id,
  operator_id: booking?.operator_id ?? null,
  host_id: booking?.host_id ?? null,
  user_id: traveler.uid,
})
step(convIns.status === 201, 'traveler INSERT on rentivo_conversations accepted', `${convIns.status} ${JSON.stringify(convIns.body).slice(0, 160)}`)
const conversation = Array.isArray(convIns.body) ? convIns.body[0] : convIns.body
const convId = conversation?.id
step(!!convId, 'conversation row exists and was returned', convId)

const convRead = await rows(traveler.token, `rentivo_conversations?booking_id=eq.${bookingId}&select=*`)
step(convRead.list.length === 1, 'traveler can read exactly one conversation for the booking', `n=${convRead.list.length}`)

const FIRST = `E2E traveler message ${Date.now()}`
const msgIns = await insert(traveler.token, 'rentivo_messages', {
  conversation_id: convId,
  sender_role: 'consumer',
  sender_id: traveler.uid,
  content: FIRST,
})
step(msgIns.status === 201, 'traveler INSERT on rentivo_messages accepted', `${msgIns.status} ${JSON.stringify(msgIns.body).slice(0, 160)}`)

const msgRead = await rows(traveler.token, `rentivo_messages?conversation_id=eq.${convId}&select=*`)
step(msgRead.list.some(m => m.content === FIRST), 'the message row is readable back by the traveler')

// The conversation-list preview the consumer screen writes after a successful send.
const sentAt = new Date().toISOString()
const preview = await patch(traveler.token, 'rentivo_conversations', `id=eq.${convId}`, {
  last_message: FIRST,
  last_message_at: sentAt,
  unread_operator: (conversation?.unread_operator ?? 0) + 1,
})
step(preview.status === 200 && preview.body?.length === 1, 'preview UPDATE affected exactly one row', `${preview.status} n=${preview.body?.length}`)

const afterSend = (await rows(traveler.token, `rentivo_conversations?id=eq.${convId}&select=*`)).list[0]
step(afterSend?.last_message === FIRST, 'last_message updated', afterSend?.last_message)
step(!!afterSend?.last_message_at, 'last_message_at updated', afterSend?.last_message_at)
step(afterSend?.unread_operator === 1, 'unread_operator incremented to 1', String(afterSend?.unread_operator))
step(afterSend?.unread_consumer === 0, 'unread_consumer untouched by the traveler send', String(afterSend?.unread_consumer))

section('2 — The operator reads the message and replies')

const opConv = await rows(operator.token, `rentivo_conversations?booking_id=eq.${bookingId}&select=*`)
step(opConv.list.length === 1, 'operator can read the conversation', `n=${opConv.list.length}`)
step(opConv.list[0]?.id === convId, 'and it is the same conversation row')

const opMsgs = await rows(operator.token, `rentivo_messages?conversation_id=eq.${convId}&select=*`)
step(opMsgs.list.some(m => m.content === FIRST), 'operator can read the traveler message')

const REPLY = `E2E operator reply ${Date.now()}`
const opIns = await insert(operator.token, 'rentivo_messages', {
  conversation_id: convId,
  sender_role: 'operator',
  sender_id: operator.uid,
  content: REPLY,
})
step(opIns.status === 201, 'operator INSERT on rentivo_messages accepted', `${opIns.status} ${JSON.stringify(opIns.body).slice(0, 160)}`)

const opPreview = await patch(operator.token, 'rentivo_conversations', `id=eq.${convId}`, {
  last_message: REPLY,
  last_message_at: new Date().toISOString(),
  unread_consumer: (opConv.list[0]?.unread_consumer ?? 0) + 1,
})
step(opPreview.status === 200 && opPreview.body?.length === 1, 'operator preview UPDATE affected exactly one row', `${opPreview.status} n=${opPreview.body?.length}`)

const travelerSees = await rows(traveler.token, `rentivo_messages?conversation_id=eq.${convId}&select=*`)
step(travelerSees.list.some(m => m.content === REPLY), 'the reply is readable by the traveler')
step(travelerSees.list.length >= 2, 'both sides of the thread are visible to the traveler', `n=${travelerSees.list.length}`)

section('3 — Unread counters move for the right side')

const afterReply = (await rows(traveler.token, `rentivo_conversations?id=eq.${convId}&select=*`)).list[0]
step(afterReply?.unread_consumer === 1, 'operator reply incremented unread_consumer', String(afterReply?.unread_consumer))
step(afterReply?.unread_operator === 1, 'unread_operator NOT incremented by the operator reply', String(afterReply?.unread_operator))
step(afterReply?.last_message === REPLY, 'last_message is now the operator reply')

// Opening the thread clears only your own side of the badge.
const clear = await patch(traveler.token, 'rentivo_conversations', `id=eq.${convId}`, { unread_consumer: 0 })
step(clear.status === 200 && clear.body?.length === 1, 'traveler can clear their own unread counter')
const afterClear = (await rows(traveler.token, `rentivo_conversations?id=eq.${convId}&select=*`)).list[0]
step(afterClear?.unread_consumer === 0, 'unread_consumer cleared', String(afterClear?.unread_consumer))
step(afterClear?.unread_operator === 1, 'the operator badge survives the traveler clearing theirs', String(afterClear?.unread_operator))

section('4 — A signed-in stranger is locked out of the thread')

// This is the assertion that matters most: RLS, not obscurity, has to be what
// keeps a third party out. Everything below runs with a REAL, valid session.
const strangerBooking = await rows(third.token, `rentivo_bookings?id=eq.${bookingId}&select=id`)
step(strangerBooking.list.length === 0, 'stranger cannot read the booking', `n=${strangerBooking.list.length}`)

const strangerByBooking = await rows(third.token, `rentivo_conversations?booking_id=eq.${bookingId}&select=*`)
step(strangerByBooking.list.length === 0, 'stranger cannot read the conversation by booking_id', `n=${strangerByBooking.list.length}`)

const strangerById = await rows(third.token, `rentivo_conversations?id=eq.${convId}&select=*`)
step(strangerById.list.length === 0, 'stranger cannot read the conversation by its own id', `n=${strangerById.list.length}`)

const strangerMsgs = await rows(third.token, `rentivo_messages?conversation_id=eq.${convId}&select=*`)
step(strangerMsgs.list.length === 0, 'stranger cannot read any message in the thread', `n=${strangerMsgs.list.length}`)

const strangerAll = await rows(third.token, `rentivo_messages?select=id&limit=5`)
step(strangerAll.list.length === 0, 'stranger cannot read messages at all (unfiltered probe)', `n=${strangerAll.list.length}`)

const strangerWrite = await insert(third.token, 'rentivo_messages', {
  conversation_id: convId,
  sender_role: 'consumer',
  sender_id: third.uid,
  content: 'E2E intruder message — must never be stored',
})
step(strangerWrite.status >= 400, 'stranger INSERT into the thread is REJECTED', `${strangerWrite.status} ${JSON.stringify(strangerWrite.body).slice(0, 140)}`)
step(strangerWrite.body?.code === '42501', 'and it is rejected by RLS specifically', String(strangerWrite.body?.code))

// A rejected insert is only half the proof — verify nothing landed.
const afterIntrusion = (await rows(operator.token, `rentivo_messages?conversation_id=eq.${convId}&select=id,content`)).list
step(
  !afterIntrusion.some(m => String(m.content).includes('intruder')),
  'no intruder row reached the thread',
  `n=${afterIntrusion.length}`,
)

const strangerPatch = await patch(third.token, 'rentivo_conversations', `id=eq.${convId}`, { last_message: 'hijacked' })
step(
  strangerPatch.status !== 200 || (strangerPatch.body?.length ?? 0) === 0,
  'stranger UPDATE on the conversation changes nothing',
  `${strangerPatch.status} n=${strangerPatch.body?.length ?? 0}`,
)
const notHijacked = (await rows(traveler.token, `rentivo_conversations?id=eq.${convId}&select=last_message`)).list[0]
step(notHijacked?.last_message === REPLY, 'conversation preview is unchanged after the stranger UPDATE', notHijacked?.last_message)

const strangerConv = await insert(third.token, 'rentivo_conversations', {
  booking_id: bookingId,
  listing_id: booking?.listing_id,
  operator_id: booking?.operator_id ?? null,
  host_id: null,
  user_id: third.uid,
})
step(strangerConv.status >= 400, 'stranger cannot open a conversation on someone else booking', `${strangerConv.status} ${String(strangerConv.body?.code ?? '')}`)

section('5 — Two clients opening the thread at once create ONE conversation')

const raceBooking = await bookInWindow(traveler.token, 'race')
step(!!raceBooking.id, 'second booking created for the race', `${raceBooking.id} @ +${raceBooking.start}d`)

const raceRow = (await rows(traveler.token, `rentivo_bookings?id=eq.${raceBooking.id}&select=listing_id,operator_id,host_id`)).list[0]
const openPayload = {
  booking_id: raceBooking.id,
  listing_id: raceRow?.listing_id,
  operator_id: raceRow?.operator_id ?? null,
  host_id: raceRow?.host_id ?? null,
  user_id: traveler.uid,
}

// Two tabs / two devices hitting "open chat" in the same instant.
const [a, b] = await Promise.all([
  insert(traveler.token, 'rentivo_conversations', openPayload),
  insert(traveler.token, 'rentivo_conversations', openPayload),
])
const created = [a, b].filter(r => r.status === 201)
const rejected = [a, b].filter(r => r.status !== 201)
step(created.length === 1, 'exactly one of the two inserts succeeded', `created=${created.length} rejected=${rejected.length}`)
step(
  rejected.length === 1 && rejected[0].body?.code === '23505',
  'the loser was stopped by the UNIQUE index on booking_id',
  `${rejected[0]?.status} ${rejected[0]?.body?.code} ${String(rejected[0]?.body?.message ?? '').slice(0, 90)}`,
)

const raceConvs = await rows(traveler.token, `rentivo_conversations?booking_id=eq.${raceBooking.id}&select=id`)
step(raceConvs.list.length === 1, 'the booking still has exactly ONE conversation', `n=${raceConvs.list.length}`)

// Losing the race must not surface as "Message not sent". The recovery the chat
// screens perform is: on 23505, re-select the conversation the winner created and
// carry on with it. Prove that recovery actually yields a usable thread.
const loser = rejected[0]
let recoveredId = null
if (loser?.body?.code === '23505') {
  const again = await rows(traveler.token, `rentivo_conversations?booking_id=eq.${raceBooking.id}&select=*`)
  recoveredId = again.list[0]?.id ?? null
}
step(!!recoveredId, 'the loser can re-read the winning conversation', recoveredId)
step(recoveredId === raceConvs.list[0]?.id, 'and it is the same row the winner created')

const recoveredSend = await insert(traveler.token, 'rentivo_messages', {
  conversation_id: recoveredId,
  sender_role: 'consumer',
  sender_id: traveler.uid,
  content: `E2E post-race message ${Date.now()}`,
})
step(recoveredSend.status === 201, 'the recovered conversation accepts a message', `${recoveredSend.status}`)

section('6 — The two chat screens agree on the schema they read and write')

const consumerSrc = source(CONSUMER_SCREEN)
const operatorSrc = source(OPERATOR_SCREEN)
step(!!consumerSrc, 'consumer chat screen readable', CONSUMER_SCREEN)
step(!!operatorSrc, 'operator chat screen readable', OPERATOR_SCREEN)

/** Keys of the object literal passed to `.from(table).insert({...})`. */
function insertedColumns(src, table) {
  const needle = `.from('${table}')`
  // A table is read as well as written, so take the occurrence that is actually
  // followed by `.insert({` rather than the first one in the file.
  let ins = -1
  for (let at = src.indexOf(needle); at >= 0; at = src.indexOf(needle, at + 1)) {
    const rest = src.slice(at + needle.length)
    const m = rest.match(/^\s*\.insert\(\{/)
    if (m) { ins = at + needle.length + m[0].length - 9; break }
  }
  if (ins < 0) return null
  let depth = 0
  let end = -1
  for (let i = ins + 8; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end < 0) return null
  const body = src.slice(ins + 9, end)
  return [...body.matchAll(/^\s{2,}([a-z_]+)\s*:/gm)].map(m => m[1]).sort()
}

const cMsgCols = insertedColumns(consumerSrc ?? '', 'rentivo_messages')
const oMsgCols = insertedColumns(operatorSrc ?? '', 'rentivo_messages')
step(
  cMsgCols !== null && JSON.stringify(cMsgCols) === JSON.stringify(oMsgCols),
  'both screens insert the SAME columns into rentivo_messages',
  `consumer=${JSON.stringify(cMsgCols)} operator=${JSON.stringify(oMsgCols)}`,
)
step(
  JSON.stringify(cMsgCols) === JSON.stringify(['content', 'conversation_id', 'sender_id', 'sender_role']),
  'and those columns are the ones the table actually has',
  JSON.stringify(cMsgCols),
)

const cConvCols = insertedColumns(consumerSrc ?? '', 'rentivo_conversations')
const oConvCols = insertedColumns(operatorSrc ?? '', 'rentivo_conversations')
step(
  cConvCols !== null && JSON.stringify(cConvCols) === JSON.stringify(oConvCols),
  'both screens insert the SAME columns into rentivo_conversations',
  `consumer=${JSON.stringify(cConvCols)} operator=${JSON.stringify(oConvCols)}`,
)
step(
  JSON.stringify(cConvCols) === JSON.stringify(['booking_id', 'host_id', 'listing_id', 'operator_id', 'user_id']),
  'and they include host_id, without which host stock trips the one-owner CHECK',
  JSON.stringify(cConvCols),
)

// `'' ` is not a uuid. Postgres answers 22P02 and the row is never written.
for (const [label, src] of [['consumer', consumerSrc], ['operator', operatorSrc]]) {
  step(
    !/(operator_id|host_id|listing_id|user_id|booking_id)\s*:\s*[^,\n]*\?\?\s*''/.test(src ?? ''),
    `${label} screen never coerces a uuid column to the empty string`,
  )
}

// The conversation's user_id is the TRAVELER. If the operator screen writes its own
// session id there, the traveler stops matching `auth.uid() = user_id` and is
// locked out of their own thread.
step(
  /user_id:\s*booking\?\.user_id/.test(operatorSrc ?? ''),
  'operator screen writes the TRAVELER id into rentivo_conversations.user_id',
  (operatorSrc ?? '').match(/user_id:.*/)?.[0]?.trim(),
)

step(/unread_operator/.test(consumerSrc ?? '') && !/unread_consumer:/.test(consumerSrc ?? ''), 'consumer screen bumps unread_operator only')
step(/unread_consumer/.test(operatorSrc ?? '') && !/unread_operator:/.test(operatorSrc ?? ''), 'operator screen bumps unread_consumer only')

// supabase-js resolves (it does not reject) on an RLS denial, so a call whose
// `error` is never destructured fails silently and the user is told nothing.
for (const [label, src] of [['consumer', consumerSrc], ['operator', operatorSrc]]) {
  const awaits = [...(src ?? '').matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+supabase\s*\n?\s*\.from\(/g)]
  const bare = [...(src ?? '').matchAll(/^\s*await\s+supabase\s*\n?\s*\.from\(/gm)]
  step(bare.length === 0, `${label} screen has no supabase .from() call with a discarded result`, `bare=${bare.length}`)
  step(
    awaits.length > 0 && awaits.every(m => /error/.test(m[1])),
    `${label} screen destructures error from every supabase .from() call`,
    `checked=${awaits.length}`,
  )
}

// Losing the open-conversation race must be recovered from, not shown as a
// failed send. 23505 is the unique_violation the index above raises.
for (const [label, src] of [['consumer', consumerSrc], ['operator', operatorSrc]]) {
  step(
    /23505/.test(src ?? ''),
    `${label} screen recovers from the 23505 conversation race instead of erroring at the user`,
  )
}

finish()
