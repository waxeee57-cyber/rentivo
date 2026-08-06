/**
 * damage-deposit.mjs — the damage inspection + deposit charge flow, proven
 * against the REAL deployed system. Run from the repo root:
 *
 *   node scripts/e2e/damage-deposit.mjs
 *
 * Nothing here is mocked. Bookings are created through create-booking, paid
 * with a real Stripe test card, inspected through the SAME lib/api/damage.ts
 * the two consumer screens call, and charged through the deployed
 * charge-deposit edge function. Deposit model B: a paid damage waiver makes the
 * effective deposit EUR 0; otherwise the listing's deposit_amount applies. The
 * platform takes NO fee on a damage charge. Prices are DECIMAL euros.
 *
 * The operator side needs a session for the account that owns the listing.
 * Supply it as E2E_OPERATOR_PASSWORD (password grant) or E2E_OPERATOR_TOKEN
 * (an access token minted elsewhere). Without one the operator assertions FAIL
 * rather than silently skip — an unproven charge path is not a passing test.
 */
import { registerHooks } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  sb, stripe, signIn, createBooking, payBooking, readBooking, cancelBooking,
  step, section, finish, sleep, day, TEST_CONNECT_ACCOUNT, SUPABASE_URL, ANON,
} from './_lib.mjs'

// ── Fixture ─────────────────────────────────────────────────────────────────
// The fixture is an E2E-owned listing under an E2E-owned operator, NOT the seeded
// "Test Operator". That one belongs to the project owner's personal account, and
// charge-deposit authorises on the LISTING OWNER's auth id — so proving the charge
// path against it required the owner's own credentials. Reaching for those is
// never acceptable, and an earlier run of this suite did exactly that. Owning the
// fixture end to end removes the temptation and the dependency.
const LISTING_ID = 'e2e11111-0000-4e2e-9000-00000000da11'   // E2E Damage Fixture Car
const OPERATOR_ID = 'b1e2c3d4-0000-4e2e-9000-0000000000e2'  // rentivo_operators.id
const OPERATOR_AUTH_ID = 'e59ac702-a6aa-428d-a3b3-7f116a34cfdd'
const TRAVELER = { email: 'e2e-damage@rentivo.domrol.com', password: 'e2e-Damage-Pass-2026!' }
const STRANGER = { email: 'e2e-damage-stranger@rentivo.domrol.com', password: 'e2e-Stranger-Pass-2026!' }
const OPERATOR_EMAIL = process.env.E2E_OPERATOR_EMAIL ?? 'e2e-operator@rentivo.domrol.com'
const OPERATOR_PASSWORD = process.env.E2E_OPERATOR_PASSWORD ?? 'e2e-Operator-Pass-2026!'

/** Every booking below sits inside the +100..+140 window this test owns. */
const WINDOW = { from: day(100), to: day(140) }

/**
 * This run's four bookings start at BASE, BASE+4, BASE+8, BASE+12 (each two
 * days long), so the last one ends at BASE+14 and BASE may run to +126.
 *
 * The base has to move between runs. create-booking reuses an existing PENDING
 * booking for the same (user, listing, start, end), and its lookup does NOT
 * exclude status='cancelled' — so a re-run on the same dates is handed back the
 * booking the previous run cancelled, carrying its already-succeeded SetupIntent
 * and its stale deposit_status. `pickBase` below picks dates this traveler has
 * never used, which sidesteps that and keeps every run's state its own.
 */
const SLOTS = [0, 1, 2, 3]
const slotDates = (base, n) => ({ start: day(base + n * 4), end: day(base + n * 4 + 2) })

// ── Load the app's own modules under plain node ─────────────────────────────
// The inspection screens call lib/api/damage.ts, so this test must call it too
// — a hand-written insert would prove the table works, not that the product
// does. Two things stand in the way under node: the `@/` path alias, and two
// React Native packages that cannot load outside a device. A resolve hook
// handles the alias; the RN packages are replaced by the smallest stubs that
// satisfy their consumers (supabase-js only needs get/set/removeItem).
const ROOT = process.cwd()
const dataUrl = src => `data:text/javascript,${encodeURIComponent(src)}`
const STUBS = {
  '@react-native-async-storage/async-storage': dataUrl(
    'const m=new Map();export default{getItem:async k=>(m.has(k)?m.get(k):null),'
    + 'setItem:async(k,v)=>{m.set(k,String(v))},removeItem:async k=>{m.delete(k)}}',
  ),
  '@sentry/react-native': dataUrl('export function init(){}\nexport function captureException(){}'),
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const rel = specifier.slice(2)
      for (const candidate of [rel, `${rel}.ts`, `${rel}.tsx`, `${rel}/index.ts`]) {
        const p = join(ROOT, candidate)
        if (existsSync(p) && statSync(p).isFile()) {
          return { url: pathToFileURL(p).href, shortCircuit: true }
        }
      }
      throw new Error(`Cannot resolve "${specifier}" under ${ROOT} — run this from the repo root`)
    }
    return nextResolve(specifier, context)
  },
})

// constants/config.ts reads these at module load, so they must exist BEFORE the
// dynamic imports below. useMock is forced off: a mocked createDamageReport
// returns a fake row and writes nothing, which would prove nothing at all.
process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE_URL
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = ANON
process.env.EXPO_PUBLIC_USE_MOCK = 'false'
globalThis.__DEV__ = false

const app = async rel => import(new URL(rel, import.meta.url).href)
const { Config } = await app('../../constants/config.ts')
const { supabase } = await app('../../lib/supabase.ts')
const {
  createDamageReport, fetchDamageReport, DamageReportExistsError,
} = await app('../../lib/api/damage.ts')
const {
  fetchDepositState, depositBlockReason, depositChargeFailed, chargeDeposit, DepositChargeError,
} = await app('../../lib/api/deposits.ts')

// ── Small helpers ───────────────────────────────────────────────────────────
const eur = v => Math.round(Number(v) * 100) / 100
const errText = e => (e instanceof Error ? e.message : String(e))

/** REST read as a given token. Returns the rows array (never null). */
async function rows(path, token) {
  const r = await sb(`/rest/v1/${path}`, {}, token)
  if (!Array.isArray(r.body)) {
    throw new Error(`REST read failed (${r.status}): ${JSON.stringify(r.body)}`)
  }
  return r.body
}

/** charge-deposit exactly as lib/api/deposits.ts calls it, as an arbitrary token. */
const callCharge = (token, bookingId, assessedAmount) =>
  sb('/functions/v1/charge-deposit', {
    method: 'POST',
    body: JSON.stringify({ booking_id: bookingId, assessed_amount: assessedAmount }),
  }, token)

/** Every deposit PaymentIntent Stripe holds for a booking, newest first. */
async function depositIntents(customerId, bookingId) {
  const q = customerId ? `?customer=${customerId}&limit=100` : '?limit=100'
  const r = await stripe(`/payment_intents${q}`, null, 'GET')
  const all = Array.isArray(r.body?.data) ? r.body.data : []
  return all.filter(pi => pi.metadata?.booking_id === bookingId
    && pi.metadata?.kind === 'deposit_charge')
}

/** Poll until the setup_intent.succeeded webhook has vaulted the card. */
async function waitForVault(token, bookingId) {
  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    const b = await readBooking(token, bookingId, 'deposit_status,deposit_payment_method_id')
    if (b?.deposit_status === 'authorized' && b.deposit_payment_method_id) return b
  }
  return null
}

/**
 * Vault a card the way the app does: create-deposit-setup mints the SetupIntent,
 * Stripe confirms it, and the setup_intent.succeeded webhook writes
 * deposit_payment_method_id + deposit_status='authorized'.
 *
 * `cards` is tried in order — a card that declines at charge time may also be
 * refused at setup time, and the fallback keeps the decline test honest instead
 * of quietly turning it into a success test.
 */
async function vaultCard(token, bookingId, cards) {
  const setup = await sb('/functions/v1/create-deposit-setup', {
    method: 'POST',
    body: JSON.stringify({ booking_id: bookingId }),
  }, token)
  if (setup.status !== 200) return { ok: false, stage: 'create-deposit-setup', detail: setup.body }

  const siId = setup.body?.setup_intent_id
  if (!siId) return { ok: false, stage: 'setup_intent_id', detail: setup.body }

  let confirmed = null
  let used = null
  const refusals = []
  for (const card of cards) {
    const r = await stripe(`/setup_intents/${siId}/confirm`, {
      payment_method: card,
      return_url: 'https://rentivo.domrol.com/return',
    })
    if (r.body?.status === 'succeeded') { confirmed = r.body; used = card; break }
    // Keep Stripe's own reason. Reporting only "could not vault" is how a
    // reused SetupIntent looks identical to a declined card.
    refusals.push(`${card}: ${r.body?.error?.message ?? r.body?.status ?? r.status}`)
  }
  if (!confirmed) return { ok: false, stage: 'confirm', detail: refusals.join(' | ') }

  const vaulted = await waitForVault(token, bookingId)
  if (!vaulted) return { ok: false, stage: 'webhook', detail: 'deposit_status never became authorized' }
  return { ok: true, card: used, paymentMethodId: vaulted.deposit_payment_method_id, setupIntentId: siId }
}

/** Password grant that also returns the refresh token, for supabase.auth.setSession. */
async function passwordGrant(email, password) {
  const r = await sb('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (r.status !== 200) return { token: null, refresh: null, uid: null, error: r.body }
  return {
    token: r.body.access_token,
    refresh: r.body.refresh_token,
    uid: r.body.user?.id ?? null,
    error: null,
  }
}

/** An inspection payload shaped exactly like the two consumer screens build one.
 *  listing_id / operator_id are deliberately ABSENT: the screens do not supply
 *  them and neither does this test — createDamageReport must derive both. */
const inspection = (bookingId, type, over = {}) => ({
  booking_id: bookingId,
  type,
  photo_front: `https://example.invalid/${type}-front.jpg`,
  photo_back: `https://example.invalid/${type}-back.jpg`,
  photo_left: `https://example.invalid/${type}-left.jpg`,
  photo_right: `https://example.invalid/${type}-right.jpg`,
  photo_interior: `https://example.invalid/${type}-interior.jpg`,
  photo_extra: `https://example.invalid/${type}-extra.jpg`,
  mileage: type === 'pickup' ? 41000 : 41350,
  fuel_level: type === 'pickup' ? 'full' : 'half',
  notes: `e2e ${type} inspection`,
  damage_found: type === 'return',
  damage_notes: type === 'return' ? 'Scratch on the rear bumper, approx 20cm.' : null,
  operator_signed: true,
  consumer_signed: true,
  operator_signature: 'data:image/png;base64,iVBORw0KGgo=',
  consumer_signature: 'data:image/png;base64,iVBORw0KGgo=',
  signed_at: new Date().toISOString(),
  ...over,
})

/** Cancel anything this traveler left behind in the window, so a re-run starts
 *  clean and the listing's dates outside +100..+140 are never touched. */
async function resetFixture(token) {
  const leftovers = await rows(
    `rentivo_bookings?listing_id=eq.${LISTING_ID}&status=neq.cancelled`
    + `&start_date=gte.${WINDOW.from}&start_date=lte.${WINDOW.to}&select=id,start_date,status`,
    token,
  )
  for (const b of leftovers) {
    const r = await cancelBooking(token, b.id)
    if (r.status !== 200) console.log(`  note  could not clear ${b.id} (${r.status})`)
  }
  return leftovers.length
}

/** The first base whose four slots this traveler has never booked. */
async function pickBase(token) {
  const used = new Set((await rows(
    `rentivo_bookings?listing_id=eq.${LISTING_ID}&select=start_date`
    + `&start_date=gte.${WINDOW.from}&start_date=lte.${WINDOW.to}`,
    token,
  )).map(b => b.start_date))
  for (let base = 100; base <= 126; base++) {
    if (SLOTS.every(n => !used.has(slotDates(base, n).start))) return base
  }
  return null
}

async function main() {
  section('Setup')
  step(Config.useMock === false, 'app modules loaded with mock mode OFF', `useMock=${Config.useMock}`)

  const traveler = await signIn(TRAVELER.email, TRAVELER.password)
  if (!traveler.token) {
    step(false, 'traveler sign-in', JSON.stringify(traveler.error))
    if (traveler.needsConfirmation) {
      console.log(`\n  Run this once, then re-run:\n  update auth.users set email_confirmed_at = now()`
        + ` where email = '${TRAVELER.email}' and email_confirmed_at is null;\n`)
    }
    return finish()
  }
  step(true, 'traveler signed in', traveler.uid)

  const stranger = await signIn(STRANGER.email, STRANGER.password)
  if (!stranger.token) {
    step(false, 'stranger sign-in', JSON.stringify(stranger.error))
    if (stranger.needsConfirmation) {
      console.log(`\n  Run this once, then re-run:\n  update auth.users set email_confirmed_at = now()`
        + ` where email = '${STRANGER.email}' and email_confirmed_at is null;\n`)
    }
    return finish()
  }
  step(true, 'stranger signed in', stranger.uid)

  // The operator session. charge-deposit authorises on the LISTING OWNER's
  // auth id, so nothing else can stand in for it.
  let operatorToken = process.env.E2E_OPERATOR_TOKEN ?? null
  let operatorUid = null
  if (!operatorToken && OPERATOR_PASSWORD) {
    const grant = await passwordGrant(OPERATOR_EMAIL, OPERATOR_PASSWORD)
    operatorToken = grant.token
    operatorUid = grant.uid
    if (!operatorToken) step(false, 'operator sign-in', JSON.stringify(grant.error))
  }
  if (!operatorToken) {
    step(false, 'operator session available',
      'set E2E_OPERATOR_PASSWORD or E2E_OPERATOR_TOKEN — the charge path cannot be proven without one')
    return finish()
  }
  if (!operatorUid) {
    const who = await sb('/auth/v1/user', {}, operatorToken)
    operatorUid = who.body?.id ?? null
  }
  step(operatorUid === OPERATOR_AUTH_ID, 'operator session belongs to the listing owner', operatorUid)

  // The same client the screens use, signed in as the traveler. lib/api/damage.ts
  // reads its session from here, so RLS applies exactly as it does in the app.
  const { error: clientAuthError } = await supabase.auth.signInWithPassword({
    email: TRAVELER.email, password: TRAVELER.password,
  })
  step(!clientAuthError, 'supabase client signed in as the traveler', errText(clientAuthError ?? ''))
  if (clientAuthError) return finish()

  const cleared = await resetFixture(traveler.token)
  step(true, 'fixture window cleared', `${cleared} leftover booking(s) cancelled`)

  const base = await pickBase(traveler.token)
  if (base === null) {
    step(false, 'free dates inside +100..+140',
      'every slot has been used by an earlier run — clear the old rows with:'
      + ` delete from rentivo_bookings where listing_id = '${LISTING_ID}'`
      + ` and status = 'cancelled' and start_date >= '${WINDOW.from}';`)
    return finish()
  }
  const slot = n => slotDates(base, n)
  step(true, 'this run owns fresh dates', `+${base}..+${base + 14}`)

  const me = await rows(`rentivo_users?id=eq.${traveler.uid}&select=stripe_customer_id`, traveler.token)
  // Narrows the Stripe PaymentIntent lookups below. Created lazily by
  // create-deposit-setup, so it is re-read after the first vault.
  let customerId = me[0]?.stripe_customer_id ?? null

  // ── 1. Pickup inspection stores evidence ─────────────────────────────────
  section('1. Pickup inspection stores evidence')

  const created = await createBooking(traveler.token, {
    listingId: LISTING_ID, ...slot(0), extra: { insurance_id: 'basic' },
  })
  step(created.status === 200, 'booking created', JSON.stringify(created.body).slice(0, 160))
  if (created.status !== 200) return finish()
  step(created.body.reused !== true,
    'the booking is new, not a cancelled one handed back by create-booking')
  const bookingA = created.body.booking_id
  step(eur(created.body.deposit_amount) > 0,
    'no waiver bought, so the listing deposit applies', `EUR ${created.body.deposit_amount}`)
  const cap = eur(created.body.deposit_amount)

  const paid = await payBooking(traveler.token, bookingA)
  step(paid.ok, 'booking paid through the real webhook', paid.ok ? paid.piId : JSON.stringify(paid))
  if (!paid.ok) return finish()

  const pickup = await createDamageReport(inspection(bookingA, 'pickup'))
  step(!!pickup?.id, 'createDamageReport stored the pickup inspection', pickup?.id)
  step(pickup?.listing_id === LISTING_ID,
    'listing_id was derived server-side, not supplied by the caller', pickup?.listing_id)
  step(pickup?.operator_id === OPERATOR_ID,
    'operator_id was derived server-side, not supplied by the caller', pickup?.operator_id)

  const storedPickup = await rows(
    `rentivo_damage_reports?booking_id=eq.${bookingA}&type=eq.pickup`
    + '&select=id,listing_id,operator_id,mileage,damage_found,created_at&order=created_at.asc',
    traveler.token,
  )
  step(storedPickup.length === 1, 'exactly one pickup row exists in rentivo_damage_reports',
    `${storedPickup.length} row(s)`)
  step(storedPickup[0]?.listing_id === LISTING_ID && storedPickup[0]?.operator_id === OPERATOR_ID,
    'the stored row carries both foreign keys')

  const flagged = await readBooking(traveler.token, bookingA, 'pickup_damage_done,return_damage_done')
  step(flagged?.pickup_damage_done === true, 'rentivo_bookings.pickup_damage_done became true')
  step(flagged?.return_damage_done === false, 'return_damage_done is still false')

  // ── 2. The same inspection cannot be filed twice ─────────────────────────
  // A second pickup row is not a harmless duplicate: fetchDamageReport reads the
  // baseline with .single(), which errors on two rows and reports "no report".
  // The booking flag says the inspection happened while the evidence behind a
  // deposit charge reads as missing — the two must not be able to diverge.
  section('2. The same inspection cannot be filed twice')

  let dupError = null
  let dupResult = null
  try { dupResult = await createDamageReport(inspection(bookingA, 'pickup')) }
  catch (e) { dupError = e }

  const afterDup = await rows(
    `rentivo_damage_reports?booking_id=eq.${bookingA}&type=eq.pickup&select=id&order=created_at.asc`,
    traveler.token,
  )
  step(afterDup.length === 1, 'a second pickup inspection did not create a second row',
    `${afterDup.length} row(s)${dupResult ? `, insert returned ${dupResult.id}` : ''}`)
  step(dupError instanceof DamageReportExistsError,
    'the duplicate attempt was refused with a reason the screen can act on',
    errText(dupError ?? 'no error'))

  const baseline = await fetchDamageReport(bookingA, 'pickup')
  step(baseline?.id === pickup?.id,
    'the pickup baseline is still readable after the duplicate attempt', baseline?.id ?? 'null')

  const stillFlagged = await readBooking(traveler.token, bookingA, 'pickup_damage_done')
  step(stillFlagged?.pickup_damage_done === true,
    'pickup_damage_done and the stored evidence still agree')

  // ── 3. Return inspection ─────────────────────────────────────────────────
  section('3. Return inspection files and reads back against the baseline')

  const returned = await createDamageReport(inspection(bookingA, 'return'))
  step(!!returned?.id, 'createDamageReport stored the return inspection', returned?.id)
  step(returned?.listing_id === LISTING_ID && returned?.operator_id === OPERATOR_ID,
    'the return row carries both derived foreign keys')

  const bothFlags = await readBooking(traveler.token, bookingA, 'pickup_damage_done,return_damage_done')
  step(bothFlags?.return_damage_done === true, 'rentivo_bookings.return_damage_done became true')
  step(bothFlags?.pickup_damage_done === true, 'the pickup flag was not disturbed')

  const [p2, r2] = await Promise.all([
    fetchDamageReport(bookingA, 'pickup'),
    fetchDamageReport(bookingA, 'return'),
  ])
  step(!!p2 && !!r2 && p2.id !== r2.id,
    'both inspections read back side by side', `${p2?.id} / ${r2?.id}`)
  step(r2?.mileage - p2?.mileage === 350,
    'the return reads against the pickup baseline', `${p2?.mileage} -> ${r2?.mileage}`)
  step(r2?.damage_found === true && (r2?.damage_notes ?? '').length > 0,
    'the return carries the damage the charge will be justified by')
  step(p2?.photo_front != null && r2?.photo_front != null,
    'both inspections kept their photo evidence')

  // ── 4a. Vault a card the way the app does ────────────────────────────────
  section('4. Deposit charge — vaulting the renter\'s card')

  const vaultA = await vaultCard(traveler.token, bookingA, ['pm_card_visa'])
  step(vaultA.ok, 'card vaulted through create-deposit-setup + setup_intent.succeeded',
    vaultA.ok ? `${vaultA.card} -> ${vaultA.paymentMethodId}` : `${vaultA.stage}: ${JSON.stringify(vaultA.detail)}`)
  if (!vaultA.ok) return finish()

  if (!customerId) {
    const meAgain = await rows(`rentivo_users?id=eq.${traveler.uid}&select=stripe_customer_id`, traveler.token)
    customerId = meAgain[0]?.stripe_customer_id ?? null
  }
  step(!!customerId, 'the renter has a platform Stripe customer holding the card', customerId)

  const stateBefore = await fetchDepositState(bookingA)
  step(stateBefore?.depositStatus === 'authorized' && stateBefore.hasVaultedCard,
    'lib/api/deposits.ts sees the booking as chargeable',
    `${stateBefore?.depositStatus}, cap EUR ${stateBefore?.depositAmount}`)
  step(depositBlockReason(stateBefore) === null,
    'depositBlockReason lets the operator charge', String(depositBlockReason(stateBefore)))

  // ── 5. Authorization ─────────────────────────────────────────────────────
  section('5. Authorization — only the owner may charge a saved card')

  const byTraveler = await callCharge(traveler.token, bookingA, 50)
  step(byTraveler.status === 403, 'the traveler charging their own booking gets 403',
    `${byTraveler.status} ${JSON.stringify(byTraveler.body)}`)

  const byStranger = await callCharge(stranger.token, bookingA, 50)
  step(byStranger.status === 403, 'a stranger gets 403',
    `${byStranger.status} ${JSON.stringify(byStranger.body)}`)

  const anonymous = await sb('/functions/v1/charge-deposit', {
    method: 'POST', body: JSON.stringify({ booking_id: bookingA, assessed_amount: 50 }),
  })
  step(anonymous.status === 401 || anonymous.status === 403,
    'an unauthenticated call is refused', `${anonymous.status} ${JSON.stringify(anonymous.body)}`)

  const afterDenials = await readBooking(traveler.token, bookingA,
    'deposit_status,deposit_charged_amount,deposit_charge_attempts')
  step(afterDenials?.deposit_status === 'authorized'
    && eur(afterDenials.deposit_charged_amount) === 0
    && Number(afterDenials.deposit_charge_attempts) === 0,
    'a refused call moved no money and left no failure state',
    JSON.stringify(afterDenials))

  // ── 8. Over-cap, refused server-side ─────────────────────────────────────
  section('8. A charge above deposit_amount is refused server-side')

  const overCap = await callCharge(operatorToken, bookingA, cap + 1)
  step(overCap.status === 400, 'the server refuses more than deposit_amount even when asked',
    `${overCap.status} ${JSON.stringify(overCap.body)}`)
  step(String(overCap.body?.error ?? '').includes('deposit cap'),
    'and says why', String(overCap.body?.error))

  const zeroAmount = await callCharge(operatorToken, bookingA, 0)
  step(zeroAmount.status === 400, 'a zero charge is refused', `${zeroAmount.status}`)
  const negative = await callCharge(operatorToken, bookingA, -25)
  step(negative.status === 400, 'a negative charge is refused', `${negative.status}`)

  let clientCapError = null
  try {
    await chargeDeposit({ bookingId: bookingA, assessedAmount: cap + 1, depositCap: cap })
  } catch (e) { clientCapError = e }
  step(clientCapError instanceof DepositChargeError && clientCapError.httpStatus === 400,
    'lib/api/deposits.ts stops an over-cap amount before it reaches the network',
    errText(clientCapError ?? 'no error'))

  const afterRefusals = await readBooking(traveler.token, bookingA,
    'deposit_status,deposit_charged_amount,deposit_charge_attempts')
  step(afterRefusals?.deposit_status === 'authorized'
    && Number(afterRefusals.deposit_charge_attempts) === 0,
    'a refused amount is not recorded as a failed charge attempt', JSON.stringify(afterRefusals))
  const noIntentsYet = await depositIntents(customerId, bookingA)
  step(noIntentsYet.length === 0, 'nothing was sent to Stripe for a refused amount',
    `${noIntentsYet.length} PaymentIntent(s)`)

  // ── 4b. The charge itself ────────────────────────────────────────────────
  section('4. Deposit charge — the operator charges assessed damage')

  const ASSESSED = 120
  const charge = await callCharge(operatorToken, bookingA, ASSESSED)
  step(charge.status === 200, 'the operator can charge the deposit',
    `${charge.status} ${JSON.stringify(charge.body)}`)
  step(charge.body?.deposit_status === 'charged', 'the response reports charged')
  step(eur(charge.body?.charged_amount) === ASSESSED,
    'the amount charged is the amount assessed', String(charge.body?.charged_amount))

  const piId = charge.body?.payment_intent_id
  const pi = piId ? (await stripe(`/payment_intents/${piId}`, null, 'GET')).body : null
  step(pi?.status === 'succeeded', 'Stripe confirmed the off-session charge', pi?.status)
  step(pi?.amount === ASSESSED * 100,
    'euros were converted to cents exactly once', `${pi?.amount} cents for EUR ${ASSESSED}`)
  step(pi?.currency === 'eur', 'charged in the booking currency', pi?.currency)
  step(pi?.transfer_data?.destination === TEST_CONNECT_ACCOUNT,
    'the money is routed to the operator\'s Connect account', pi?.transfer_data?.destination)
  step(pi?.application_fee_amount == null,
    'NO platform fee is taken from a damage charge', String(pi?.application_fee_amount))
  step(pi?.metadata?.kind === 'deposit_charge' && pi?.metadata?.booking_id === bookingA,
    'the charge is tagged as a deposit charge for this booking')
  step(pi?.payment_method === vaultA.paymentMethodId,
    'the vaulted card was the one charged', pi?.payment_method)

  const chargedRow = await readBooking(traveler.token, bookingA,
    'deposit_status,deposit_charged_amount,deposit_amount')
  step(chargedRow?.deposit_status === 'charged', 'the booking records deposit_status=charged')
  step(eur(chargedRow?.deposit_charged_amount) === ASSESSED,
    'the booking records deposit_charged_amount', String(chargedRow?.deposit_charged_amount))
  step(eur(chargedRow?.deposit_charged_amount) <= eur(chargedRow?.deposit_amount),
    'the charge never exceeds the cap it was capped against')

  const secondCharge = await callCharge(operatorToken, bookingA, 30)
  step(secondCharge.status === 409, 'a charged booking cannot be charged again',
    `${secondCharge.status} ${JSON.stringify(secondCharge.body)}`)
  const intentsA = await depositIntents(customerId, bookingA)
  step(intentsA.length === 1, 'exactly one deposit PaymentIntent exists for the booking',
    `${intentsA.length}`)

  // ── 6. Retry after a soft decline ────────────────────────────────────────
  // Two bugs made this path terminal: a FIXED Stripe idempotency key (the retry
  // replayed the first decline out of Stripe's 24h cache) and a status guard
  // that accepted only 'authorized' (so the decline's own state was rejected
  // 409). Booking B proves the mechanics against a real card decline; booking D
  // proves a retry can actually end in a successful charge.
  section('6. Retry after a soft decline')

  const madeB = await createBooking(traveler.token, {
    listingId: LISTING_ID, ...slot(1), extra: { insurance_id: 'basic' },
  })
  step(madeB.status === 200 && madeB.body.reused !== true,
    'decline-path booking created', JSON.stringify(madeB.body).slice(0, 140))
  if (madeB.status !== 200) return finish()
  const bookingB = madeB.body.booking_id

  const vaultB = await vaultCard(traveler.token, bookingB,
    ['pm_card_chargeDeclined', 'pm_card_chargeCustomerFail'])
  step(vaultB.ok, 'a card that declines at charge time was vaulted',
    vaultB.ok ? vaultB.card : `${vaultB.stage}: ${JSON.stringify(vaultB.detail)}`)
  if (!vaultB.ok) return finish()

  const decline1 = await callCharge(operatorToken, bookingB, 90)
  step(decline1.status === 402, 'the declined charge surfaces as 402, not a silent failure',
    `${decline1.status} ${JSON.stringify(decline1.body).slice(0, 160)}`)
  step(decline1.body?.deposit_status === 'charge_failed', 'the response reports charge_failed')
  step(!!decline1.body?.code, 'the Stripe decline code is passed through', String(decline1.body?.code))

  const afterDecline1 = await readBooking(traveler.token, bookingB,
    'deposit_status,deposit_charge_attempts,deposit_charged_amount')
  step(afterDecline1?.deposit_status === 'charge_failed', 'the booking records charge_failed')
  step(Number(afterDecline1?.deposit_charge_attempts) === 1,
    'deposit_charge_attempts incremented', String(afterDecline1?.deposit_charge_attempts))
  step(eur(afterDecline1?.deposit_charged_amount) === 0, 'nothing was recorded as charged')

  const failedState = await fetchDepositState(bookingB)
  step(depositBlockReason(failedState) === null,
    'the client still offers a retry after a decline (the server allows one)',
    String(depositBlockReason(failedState)))
  step(depositChargeFailed(failedState) === true,
    'and still tells the operator the last attempt was declined')

  const decline2 = await callCharge(operatorToken, bookingB, 90)
  step(decline2.status !== 409,
    'a charge_failed booking is still chargeable — the status guard does not exclude its own failure state',
    `${decline2.status} ${JSON.stringify(decline2.body).slice(0, 140)}`)

  const afterDecline2 = await readBooking(traveler.token, bookingB, 'deposit_charge_attempts')
  step(Number(afterDecline2?.deposit_charge_attempts) === 2,
    'the retry reached Stripe and recorded a second attempt',
    String(afterDecline2?.deposit_charge_attempts))

  const intentsB = await depositIntents(customerId, bookingB)
  const distinctB = new Set(intentsB.map(p => p.id))
  step(distinctB.size === 2,
    'the retry created a NEW PaymentIntent instead of replaying the cached decline',
    `${distinctB.size} PaymentIntent(s): ${[...distinctB].join(', ')}`)
  step(intentsB.every(p => p.status !== 'succeeded'),
    'neither declined attempt took money', intentsB.map(p => p.status).join(', '))

  // A retry that ends in money. The first attempt fails inside Stripe (below the
  // EUR 0.50 minimum), leaving exactly the charge_failed state a decline leaves,
  // and the second attempt on the same booking succeeds.
  const madeD = await createBooking(traveler.token, {
    listingId: LISTING_ID, ...slot(2), extra: { insurance_id: 'basic' },
  })
  step(madeD.status === 200 && madeD.body.reused !== true,
    'retry-to-success booking created', JSON.stringify(madeD.body).slice(0, 140))
  if (madeD.status !== 200) return finish()
  const bookingD = madeD.body.booking_id

  const vaultD = await vaultCard(traveler.token, bookingD, ['pm_card_visa'])
  step(vaultD.ok, 'a good card was vaulted on the retry booking',
    vaultD.ok ? vaultD.card : `${vaultD.stage}: ${JSON.stringify(vaultD.detail)}`)
  if (!vaultD.ok) return finish()

  const failD = await callCharge(operatorToken, bookingD, 0.4)
  step(failD.status === 402, 'the first attempt fails at Stripe', `${failD.status} ${JSON.stringify(failD.body).slice(0, 140)}`)
  const afterFailD = await readBooking(traveler.token, bookingD, 'deposit_status,deposit_charge_attempts')
  step(afterFailD?.deposit_status === 'charge_failed' && Number(afterFailD.deposit_charge_attempts) === 1,
    'the booking is left in charge_failed with one attempt recorded', JSON.stringify(afterFailD))

  const retryD = await callCharge(operatorToken, bookingD, 120)
  step(retryD.status === 200, 'the retry after a failure SUCCEEDS',
    `${retryD.status} ${JSON.stringify(retryD.body).slice(0, 160)}`)
  step(retryD.body?.deposit_status === 'charged', 'the retry reports charged')

  const chargedD = await readBooking(traveler.token, bookingD,
    'deposit_status,deposit_charged_amount,deposit_charge_attempts')
  step(chargedD?.deposit_status === 'charged' && eur(chargedD.deposit_charged_amount) === 120,
    'the booking records the recovered amount', JSON.stringify(chargedD))
  const retryPi = retryD.body?.payment_intent_id
    ? (await stripe(`/payment_intents/${retryD.body.payment_intent_id}`, null, 'GET')).body
    : null
  step(retryPi?.status === 'succeeded' && retryPi?.amount === 12000,
    'the recovered charge really settled at Stripe', `${retryPi?.status} ${retryPi?.amount}`)
  step(retryPi?.application_fee_amount == null && retryPi?.transfer_data?.destination === TEST_CONNECT_ACCOUNT,
    'the recovered charge is also fee-free and routed to the operator')

  // ── 7. Waiver case ───────────────────────────────────────────────────────
  // Deposit model B: the renter paid for damage cover, so the effective deposit
  // is EUR 0 and there is nothing to charge. That must read as a product
  // decision, never as a broken screen — and never as a EUR 0 Stripe call.
  section('7. A paid waiver makes the deposit EUR 0 and charging impossible')

  const madeC = await createBooking(traveler.token, {
    listingId: LISTING_ID, ...slot(3), extra: { insurance_id: 'premium' },
  })
  step(madeC.status === 200 && madeC.body.reused !== true,
    'waiver booking created', JSON.stringify(madeC.body).slice(0, 140))
  if (madeC.status !== 200) return finish()
  const bookingC = madeC.body.booking_id
  step(eur(madeC.body.deposit_amount) === 0,
    'a paid waiver zeroes the deposit even though the listing has one',
    `EUR ${madeC.body.deposit_amount} vs listing EUR ${cap}`)

  const setupC = await sb('/functions/v1/create-deposit-setup', {
    method: 'POST', body: JSON.stringify({ booking_id: bookingC }),
  }, traveler.token)
  step(setupC.status === 400, 'no card is vaulted for a waived deposit',
    `${setupC.status} ${JSON.stringify(setupC.body)}`)

  const chargeC = await callCharge(operatorToken, bookingC, 100)
  step(chargeC.status >= 400 && chargeC.status < 500,
    'the server refuses to charge a waived deposit',
    `${chargeC.status} ${JSON.stringify(chargeC.body)}`)
  step(typeof chargeC.body?.error === 'string' && chargeC.body.error.length > 0,
    'and returns an explanation rather than an empty failure', String(chargeC.body?.error))

  const intentsC = await depositIntents(customerId, bookingC)
  step(intentsC.length === 0, 'no EUR 0 PaymentIntent was created', `${intentsC.length}`)

  const stateC = await fetchDepositState(bookingC)
  step(depositBlockReason(stateC) === 'waived',
    'the client explains it as a waiver, not as "not set up yet"', String(depositBlockReason(stateC)))
  let clientWaiverError = null
  try { await chargeDeposit({ bookingId: bookingC, assessedAmount: 100, depositCap: 0 }) }
  catch (e) { clientWaiverError = e }
  step(clientWaiverError instanceof DepositChargeError,
    'lib/api/deposits.ts refuses a waived booking before any network call',
    errText(clientWaiverError ?? 'no error'))
  const rowC = await readBooking(traveler.token, bookingC, 'deposit_status,deposit_charged_amount')
  step(rowC?.deposit_status === 'none' && eur(rowC.deposit_charged_amount) === 0,
    'the waiver booking was left untouched', JSON.stringify(rowC))

  // ── Cleanup ──────────────────────────────────────────────────────────────
  // The bookings stay inside +100..+140, but a paid one holds those dates, so
  // cancel everything this run created. A deposit already charged is NOT
  // reversed by cancelling — the damage was still done.
  section('Cleanup')
  for (const [label, id] of [['A', bookingA], ['B', bookingB], ['C', bookingC], ['D', bookingD]]) {
    const r = await cancelBooking(traveler.token, id)
    step(r.status === 200, `booking ${label} released its dates`,
      `${r.status} ${JSON.stringify(r.body).slice(0, 120)}`)
  }
  const leftInWindow = await rows(
    `rentivo_bookings?listing_id=eq.${LISTING_ID}&status=neq.cancelled`
    + `&start_date=gte.${WINDOW.from}&start_date=lte.${WINDOW.to}&select=id`,
    traveler.token,
  )
  step(leftInWindow.length === 0, 'no test booking is still holding dates', `${leftInWindow.length} left`)

  const chargedAfterCancel = await readBooking(traveler.token, bookingA,
    'deposit_status,deposit_charged_amount')
  step(chargedAfterCancel?.deposit_status === 'charged',
    'cancelling the booking did not undo the damage charge', JSON.stringify(chargedAfterCancel))

  finish()
}

await main().catch(async e => {
  step(false, 'the run threw', errText(e))
  console.error(e)
  finish()
})
