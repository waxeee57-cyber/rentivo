/**
 * End-to-end proof that the money path works, against the DEPLOYED functions.
 *
 * Everything fixed today was verified by reading code and querying the schema.
 * That is not the same as money moving. This drives the real loop with a real
 * Stripe test-mode card: book, pay, confirm via webhook, block the dates,
 * reject a double sale, cancel, refund.
 *
 * Stripe TEST keys only. The script refuses to run against a live key.
 *
 * Moved here from scripts/e2e-money-path.mjs. It was the only suite living
 * outside scripts/e2e, carrying its own copy of the .env parser, the HTTP
 * helpers and the pass/fail counter, and it took a listing id on argv with a
 * hardcoded default that belonged to the seeded "Test Operator" — the project
 * owner's own operator row. It now uses the shared harness and the money
 * fixture, like every other suite.
 *
 * Run: node scripts/e2e/money-path.mjs
 */
import {
  sb, signIn, createBooking, payBooking, cancelBooking, stripe,
  step, section, finish, day, releaseWindow, TEST_CONNECT_ACCOUNT,
} from './_lib.mjs'
import { FIXTURES, assertFixture } from './fixtures.mjs'

const EMAIL = 'e2e-traveler@rentivo.domrol.com'
const PASSWORD = 'e2e-Traveler-Pass-2026!'

const FX = FIXTURES.money
const LISTING_ID = FX.listing
/** Ten days into the window, so the cancellation policy still refunds 100%. */
const START_DAY = FX.from + 10
const END_DAY = START_DAY + 3

section('0. Auth')
const traveler = await signIn(EMAIL, PASSWORD)
if (!traveler.token) {
  console.log(`  SETUP  sign-in failed. ${traveler.needsConfirmation ? 'Confirm the address:' : ''}`)
  if (traveler.needsConfirmation) {
    console.log(`  update auth.users set email_confirmed_at = now() where email = '${EMAIL}' and email_confirmed_at is null;`)
  }
  console.log(`  detail: ${JSON.stringify(traveler.error)}`)
  process.exit(1)
}
const TOKEN = traveler.token
const UID = traveler.uid
step(!!TOKEN, 'traveler signed in', UID)

// Fail loudly on the wrong vehicle rather than quietly booking it.
const fixture = await assertFixture(sb, 'money', TOKEN)
step(true, 'money fixture is ours', `${fixture.row.title} @ EUR ${fixture.row.price_per_day}/day, +${FX.from}..+${FX.to}`)

const PRICE_PER_DAY = Number(fixture.row.price_per_day)
const START = day(START_DAY)
const END = day(END_DAY)
step(
  START_DAY >= FX.from && END_DAY <= FX.to,
  'the dates this run books are inside the money window',
  `+${START_DAY}..+${END_DAY} within +${FX.from}..+${FX.to}`,
)

// An interrupted earlier run can leave a paid booking holding these nights.
// Clearing first is what makes a second run of this suite behave like the first.
const preclean = await releaseWindow(TOKEN, LISTING_ID, FX.from, FX.to)
step(preclean.stuck.length === 0, 'window clear before the run', `released ${preclean.released.length} of ${preclean.found}${preclean.stuck.length ? ' stuck: ' + preclean.stuck.join(', ') : ''}`)

section('1. create-booking')
const booking = await createBooking(TOKEN, {
  listingId: LISTING_ID, start: START, end: END, extra: { guest_email: EMAIL },
})
step(booking.status === 200, 'booking created', JSON.stringify(booking.body).slice(0, 200))
const BOOKING_ID = booking.body?.booking_id
if (!BOOKING_ID) finish()

const expectedSubtotal = PRICE_PER_DAY * (END_DAY - START_DAY)
const expectedFee = Math.round(expectedSubtotal * 0.10)
step(
  booking.body.total_amount === expectedSubtotal + expectedFee,
  'server priced it itself',
  `got ${booking.body.total_amount}, expected ${expectedSubtotal + expectedFee}`,
)

section('2-4. Pay it, and wait for the real webhook')
// payBooking mints the PaymentIntent, confirms it with a real test card so the
// real webhook fires, and polls until payment_status flips rather than assuming.
const paid = await payBooking(TOKEN, BOOKING_ID)
step(paid.ok, 'charge succeeded and the webhook landed', paid.ok ? paid.piId : `${paid.stage}: ${JSON.stringify(paid.detail)}`)
if (!paid.ok) finish()

step(
  paid.pi?.transfer_data?.destination === TEST_CONNECT_ACCOUNT,
  'destination charge routed to the operator',
  paid.pi?.transfer_data?.destination ?? 'NO DESTINATION',
)
step(
  paid.pi?.application_fee_amount === expectedFee * 100,
  'platform fee applied',
  `${paid.pi?.application_fee_amount} minor units`,
)

const row = paid.booking
step(row?.payment_status === 'paid', 'payment_status = paid', row?.payment_status ?? 'never arrived')
step(row?.status === 'confirmed', 'status = confirmed', row?.status ?? '-')
step(!!row?.paid_at, 'paid_at written', row?.paid_at ?? '-')
step(!!row?.stripe_charge_id, 'stripe_charge_id written', row?.stripe_charge_id ?? '-')

const avail = await sb(
  `/rest/v1/rentivo_availability?booking_id=eq.${BOOKING_ID}&select=blocked_date,end_date,reason`,
  {}, TOKEN,
)
step(
  Array.isArray(avail.body) && avail.body.length === 1,
  'dates blocked in rentivo_availability',
  JSON.stringify(avail.body).slice(0, 160),
)

section('5. Double-booking guard')
const clash = await createBooking(TOKEN, {
  listingId: LISTING_ID, start: START, end: END, extra: { guest_name: 'Second Renter' },
})
step(clash.status === 409, 'second booking rejected', `${clash.status} ${JSON.stringify(clash.body).slice(0, 120)}`)

section('6. Client write guards')
const patch = body => sb(`/rest/v1/rentivo_bookings?id=eq.${BOOKING_ID}`, {
  method: 'PATCH',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify(body),
}, TOKEN)

const selfConfirm = await patch({ status: 'active' })
step(selfConfirm.status >= 400, 'traveler cannot change status', `${selfConfirm.status} ${JSON.stringify(selfConfirm.body).slice(0, 140)}`)

const selfPay = await patch({ total_amount: 1 })
step(selfPay.status >= 400, 'traveler cannot rewrite the price', `${selfPay.status} ${JSON.stringify(selfPay.body).slice(0, 140)}`)

const selfKyc = await sb('/rest/v1/rentivo_identity_verifications', {
  method: 'POST',
  body: JSON.stringify({ user_id: UID, status: 'approved', liveness_passed: true }),
}, TOKEN)
step(selfKyc.status >= 400, 'traveler cannot self-approve KYC', `${selfKyc.status} ${JSON.stringify(selfKyc.body).slice(0, 140)}`)

section('7. cancel-booking')
const cancelled = await cancelBooking(TOKEN, BOOKING_ID)
step(cancelled.status === 200, 'cancel accepted', JSON.stringify(cancelled.body).slice(0, 200))
step(
  cancelled.body?.refund_amount === expectedSubtotal + expectedFee,
  'full refund computed',
  `${cancelled.body?.refund_amount} (policy ${cancelled.body?.policy}, ${cancelled.body?.refund_percent}%)`,
)
step(!!cancelled.body?.refund_id, 'stripe refund id returned', cancelled.body?.refund_id ?? 'NONE')

if (cancelled.body?.refund_id) {
  const refund = await stripe(`/refunds/${cancelled.body.refund_id}`, null, 'GET')
  step(
    refund.body?.status === 'succeeded' || refund.body?.status === 'pending',
    'refund exists in Stripe',
    `${refund.body?.status} ${refund.body?.amount} ${refund.body?.currency}`,
  )
}

const availAfter = await sb(
  `/rest/v1/rentivo_availability?booking_id=eq.${BOOKING_ID}&select=id`, {}, TOKEN,
)
step(
  Array.isArray(availAfter.body) && availAfter.body.length === 0,
  'dates released after cancellation',
  JSON.stringify(availAfter.body).slice(0, 120),
)

const rebook = await createBooking(TOKEN, {
  listingId: LISTING_ID, start: START, end: END, extra: { guest_name: 'Third Renter' },
})
step(rebook.status === 200, 'vehicle is sellable again', `${rebook.status}`)

section('8. Cleanup')
// The re-sale above is the last assertion, and it leaves a live booking on the
// fixture. Releasing it is what lets the next run of this suite book the same
// nights and see the same numbers.
const cleaned = await releaseWindow(TOKEN, LISTING_ID, FX.from, FX.to)
step(cleaned.stuck.length === 0, 'every booking this run created was released', `${cleaned.released.length} released${cleaned.stuck.length ? ', stuck: ' + cleaned.stuck.join(', ') : ''}`)
const leftLive = await sb(
  `/rest/v1/rentivo_bookings?listing_id=eq.${LISTING_ID}&status=neq.cancelled`
  + `&start_date=gte.${day(FX.from)}&start_date=lte.${day(FX.to)}&select=id`, {}, TOKEN,
)
step((leftLive.body?.length ?? -1) === 0, 'no booking of ours is still holding dates in the money window', `n=${leftLive.body?.length}`)

finish()
