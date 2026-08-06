import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { createDepositSetup } from '@/lib/api/payments'
import type { DepositStatus } from '@/types'

/**
 * Deposit Model B. The renter's card is vaulted at booking time by
 * `create-deposit-setup` (SetupIntent, usage off_session) and charged ONCE,
 * off_session, only when the operator assesses damage.
 *
 * `supabase/functions/charge-deposit` owns that charge. Until now NOTHING in
 * the app called it, so a documented damage claim had no route to money at
 * all. This module is the single client-side caller; its request shape is
 * copied from that function verbatim:
 *
 *   POST {supabaseUrl}/functions/v1/charge-deposit
 *   Authorization: Bearer <supabase access token>   (401 without it)
 *   apikey: <publishable/anon key>
 *   body: { booking_id: string, assessed_amount: number }   // whole EUR, NOT cents
 *
 *   200 -> { deposit_status: 'charged', payment_intent_id, charged_amount }
 *   4xx -> { error: string, code?: string | null, deposit_status?: string }
 *
 * Amounts are whole euros everywhere in this database (DECIMAL(10,2)); the
 * edge function is what multiplies by 100 for Stripe. Never send cents.
 */

/**
 * Values written to `rentivo_bookings.deposit_status` by create-deposit-setup,
 * charge-deposit and stripe-webhook.
 *
 * This used to be declared here as its own union with the note "the column is
 * plain text, so this is a documentation type rather than a constraint". Both
 * halves were wrong. The database enforces
 *   rentivo_bookings_deposit_status_check
 *   CHECK (deposit_status = ANY (ARRAY['none','authorized','charged',
 *                                      'charge_failed','released']))
 * and the old union additionally listed 'pending', which that constraint
 * REJECTS — so the type advertised a state no row can ever hold. It is now one
 * alias of the single definition in types/index.ts.
 */
export type KnownDepositStatus = DepositStatus

export interface DepositState {
  bookingId: string
  /** The hard cap on any charge. Whole euros. 0 means "nothing is chargeable". */
  depositAmount: number
  depositStatus: string
  depositChargedAmount: number
  /** True once the setup_intent.succeeded webhook stored a vaulted card. */
  hasVaultedCard: boolean
  currency: string
  /** `deposit_setup_intent_id`. Needed to tell a FRESH SetupIntent from the
   *  stale one create-deposit-setup replays — see startDepositRevault. */
  setupIntentId: string | null
}

/**
 * Reads the deposit_* workflow columns for one booking.
 *
 * These are now declared on `Booking` (types/index.ts) too, but they are
 * OPTIONAL there because most select() lists omit them — `fetchBooking` is one
 * of those, so a screen still cannot learn the deposit state from it. Read them
 * explicitly.
 */
export async function fetchDepositState(bookingId: string): Promise<DepositState | null> {
  if (!bookingId) return null

  // Mock mode must never touch production rows — same rule as lib/api/damage.ts.
  if (Config.useMock) {
    return {
      bookingId,
      depositAmount: 2000,
      depositStatus: 'authorized',
      depositChargedAmount: 0,
      hasVaultedCard: true,
      currency: 'EUR',
      setupIntentId: 'seti_mock',
    }
  }

  const { data, error } = await supabase
    .from('rentivo_bookings')
    // One literal, NOT a concatenation: supabase-js parses the select string as
    // a literal type to infer the row shape, and `'a' + 'b'` widens to `string`,
    // which collapses the inference to GenericStringError.
    .select('id, deposit_amount, deposit_status, deposit_charged_amount, deposit_payment_method_id, deposit_setup_intent_id, currency')
    .eq('id', bookingId)
    .single()

  // PGRST116 = "no rows returned" — the genuine not-found case. Anything else
  // (RLS denial, network drop) must surface rather than render as "no deposit",
  // which would look identical to a paid-waiver booking on screen.
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  const row = data as {
    id: string
    deposit_amount: number | string | null
    deposit_status: string | null
    deposit_charged_amount: number | string | null
    deposit_payment_method_id: string | null
    deposit_setup_intent_id: string | null
    currency: string | null
  }

  return {
    bookingId: row.id,
    depositAmount: toEuros(row.deposit_amount),
    depositStatus: row.deposit_status ?? 'none',
    depositChargedAmount: toEuros(row.deposit_charged_amount),
    hasVaultedCard: !!row.deposit_payment_method_id,
    currency: row.currency ?? 'EUR',
    setupIntentId: row.deposit_setup_intent_id,
  }
}

/** Postgres numeric arrives as a string over PostgREST often enough to matter. */
function toEuros(value: number | string | null): number {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return Number.isFinite(n as number) ? (n as number) : 0
}

/**
 * Why a charge is impossible, or null when it is possible. Mirrors every guard
 * inside charge-deposit so the operator is told BEFORE a request is made
 * instead of after a 400/409 that has no UI attached to it.
 */
export type DepositBlockReason =
  /** deposit_amount is 0 — the renter bought a damage waiver (deposit model B). */
  | 'waived'
  /** No vaulted card on the booking (setup never completed). */
  | 'no_card'
  /** deposit_status is not 'authorized' — nothing to charge against. */
  | 'not_authorized'
  | 'already_charged'

/**
 * `charge_failed` is NOT a block. It is the state a soft decline leaves behind
 * (insufficient funds, expired card, a 3DS challenge on an off-session charge),
 * and charge-deposit accepts it — `CHARGEABLE = ['authorized', 'charge_failed']`.
 * Returning a block for it made the client refuse a retry the server was willing
 * to perform, so one decline permanently ended the operator's ability to recover
 * damage costs from the app. `charged` stays terminal; that one is real.
 */
const CHARGEABLE_STATUSES = ['authorized', 'charge_failed']

export function depositBlockReason(state: DepositState | null): DepositBlockReason | null {
  if (!state) return 'not_authorized'

  // Checked FIRST and independently of status: a EUR 0 deposit is a product
  // decision (paid waiver), not a workflow failure, and must never be
  // explained to the operator as "not set up yet".
  if (!(state.depositAmount > 0)) return 'waived'

  if (state.depositStatus === 'charged') return 'already_charged'
  if (!state.hasVaultedCard) return 'no_card'
  if (!CHARGEABLE_STATUSES.includes(state.depositStatus)) return 'not_authorized'
  return null
}

/** True when a previous charge was declined and the next one is a retry. The
 *  operator needs to be told, but it must not stop them from trying again. */
export function depositChargeFailed(state: DepositState | null): boolean {
  return state?.depositStatus === 'charge_failed'
}

/**
 * Carries the edge function's own status/code through to the UI. A generic
 * `Error` here would collapse "card declined" (402), "not your booking" (403)
 * and "already charged" (409) into one unactionable toast.
 */
export class DepositChargeError extends Error {
  readonly httpStatus: number
  readonly code: string | null
  readonly depositStatus: string | null

  constructor(
    message: string,
    httpStatus: number,
    code: string | null = null,
    depositStatus: string | null = null,
  ) {
    super(message)
    this.name = 'DepositChargeError'
    this.httpStatus = httpStatus
    this.code = code
    this.depositStatus = depositStatus
    // Required for `instanceof` to survive TS's ES5-class downlevelling.
    Object.setPrototypeOf(this, DepositChargeError.prototype)
  }
}

export interface ChargeDepositInput {
  bookingId: string
  /** Whole euros. Rounded to 2dp before sending. */
  assessedAmount: number
  /** booking.deposit_amount. Enforced server-side too — this only avoids a
   *  pointless round trip and a Stripe idempotency key burn. */
  depositCap: number
}

export interface ChargeDepositResult {
  deposit_status: string
  payment_intent_id: string
  charged_amount: number
}

/**
 * Charges the vaulted card against assessed damage.
 *
 * NOTE for callers: charge-deposit's Stripe idempotency key is scoped to the
 * booking, the recorded attempt number and the amount
 * (`rentivo_dep_<booking_id>_<attempt>_<cents>`). Two taps of the same button
 * read the same attempt number and collapse into ONE charge, while a retry
 * after a recorded decline gets a fresh key and reaches Stripe properly. It was
 * a fixed per-booking key, which meant Stripe replayed the first response for
 * 24 hours and a retry could never succeed.
 *
 * A successful charge is still terminal: the server only accepts
 * `deposit_status` of 'authorized' or 'charge_failed'. Get the amount right the
 * first time — hence the confirmation step upstream.
 */
export async function chargeDeposit(input: ChargeDepositInput): Promise<ChargeDepositResult> {
  const amount = roundEuros(input.assessedAmount)
  const cap = roundEuros(input.depositCap)

  if (!input.bookingId) {
    throw new DepositChargeError('Missing booking_id', 400)
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new DepositChargeError('Invalid assessed_amount', 400)
  }
  if (!(cap > 0)) {
    throw new DepositChargeError('This booking has no chargeable deposit', 409)
  }
  if (amount > cap) {
    throw new DepositChargeError(`assessed_amount exceeds deposit cap (${cap})`, 400)
  }

  // Mock mode must not reach the real function — a mock run would otherwise
  // charge a real card. Same guard as createDamageReport in lib/api/damage.ts.
  if (Config.useMock) {
    await new Promise(resolve => setTimeout(resolve, 600))
    return {
      deposit_status: 'charged',
      payment_intent_id: `pi_mock_dep_${Date.now()}`,
      charged_amount: amount,
    }
  }

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  // charge-deposit returns 401 with no Authorization header; failing here is
  // clearer than a bare "Unauthorized" bubbling out of a fetch.
  if (!accessToken) {
    throw new DepositChargeError('Unauthorized', 401)
  }

  const res = await fetch(`${Config.supabaseUrl}/functions/v1/charge-deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: Config.supabaseAnonKey,
    },
    body: JSON.stringify({ booking_id: input.bookingId, assessed_amount: amount }),
  })

  const body = (await res.json().catch(() => null)) as {
    error?: string
    code?: string | null
    deposit_status?: string
    payment_intent_id?: string
    charged_amount?: number
  } | null

  if (!res.ok) {
    throw new DepositChargeError(
      body?.error ?? `Deposit charge failed (${res.status})`,
      res.status,
      body?.code ?? null,
      body?.deposit_status ?? null,
    )
  }

  return {
    deposit_status: body?.deposit_status ?? 'charged',
    payment_intent_id: body?.payment_intent_id ?? '',
    charged_amount: typeof body?.charged_amount === 'number' ? body.charged_amount : amount,
  }
}

function roundEuros(value: number): number {
  if (!Number.isFinite(value)) return NaN
  return Math.round(value * 100) / 100
}

/* ────────────────────────────────────────────────────────────────────────────
 * Replacing the card on file (deposit re-vault)
 *
 * When charge-deposit is declined the booking lands on
 * deposit_status='charge_failed'. The retry path is attempt-scoped now, so a
 * retry does reach Stripe — but it retries THE SAME DEAD CARD, which is
 * pointless. There was no route anywhere in the app for the renter to supply a
 * different one: `createDepositSetup` was called from exactly one place, the
 * checkout screen in app/(consumer)/booking/[listingId].tsx, and never again.
 *
 * SERVER DEPENDENCY — this flow is not fully live until two things change in
 * supabase/ (out of scope here; both are written up in the report):
 *
 *   1. create-deposit-setup returns the EXISTING SetupIntent verbatim whenever
 *      booking.deposit_setup_intent_id is set. After the first card was vaulted
 *      that intent has status 'succeeded', and a succeeded SetupIntent cannot be
 *      confirmed again — Stripe rejects it with setup_intent_unexpected_state.
 *      Its fixed idempotency key `rentivo_si_<booking_id>` would replay the same
 *      object even if that early return were removed.
 *   2. The setup_intent.succeeded webhook writes the new payment_method only
 *      `.eq('deposit_status', 'none')`, so a re-vault from 'charge_failed' or
 *      'authorized' matches zero rows and the new card is silently discarded.
 *
 * Until (1) ships, `startDepositRevault` returns reusedExistingIntent=true and
 * the confirm step fails with a specific, honest message rather than a generic
 * card error. That is deliberate: a button that quietly does nothing is worse
 * than one that says exactly which server-side guard blocked it.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Statuses a renter may replace the card from. 'charged' and 'released' are
 *  terminal — the money question is settled and a new card buys nothing.
 *  'none' means the card was never vaulted, which is checkout's job, not this. */
const REVAULTABLE_STATUSES = ['authorized', 'charge_failed']

/**
 * True when the renter should be offered a "use a different card" control.
 *
 * A EUR 0 deposit (paid damage waiver) is excluded first and independently of
 * status, for the same reason depositBlockReason does it: there is no card to
 * replace, and prompting for one would misrepresent the product they bought.
 */
export function canRevaultDepositCard(state: DepositState | null): boolean {
  if (!state) return false
  if (!(state.depositAmount > 0)) return false
  return REVAULTABLE_STATUSES.includes(state.depositStatus)
}

export type DepositRevaultCode =
  /** Booking is not in a state where replacing the card means anything. */
  | 'not_revaultable'
  /** No Supabase session — create-deposit-setup 401s without one. */
  | 'unauthorized'
  /** create-deposit-setup returned non-2xx. */
  | 'request_failed'

export class DepositRevaultError extends Error {
  readonly code: DepositRevaultCode

  constructor(message: string, code: DepositRevaultCode) {
    super(message)
    this.name = 'DepositRevaultError'
    this.code = code
    // Required for `instanceof` to survive TS's ES5-class downlevelling.
    Object.setPrototypeOf(this, DepositRevaultError.prototype)
  }
}

export interface DepositRevaultSetup {
  /** Pass to confirmSetupIntent() with the renter's new card. */
  clientSecret: string
  setupIntentId: string
  /**
   * True when the server handed back the SetupIntent already stored on the
   * booking instead of minting a new one. The caller must treat a confirm
   * failure as the server-side limitation documented above, not as a card
   * problem — telling a renter their new card was declined when it was never
   * charged would be a lie.
   */
  reusedExistingIntent: boolean
}

/**
 * Asks create-deposit-setup for a SetupIntent the renter can confirm with a new
 * card. Confirming it is the CALLER's job: confirmSetupIntent() comes from the
 * useStripe() hook and only exists inside a component.
 *
 * Does not mutate anything itself — the payment_method is attached by Stripe on
 * confirm and persisted by the setup_intent.succeeded webhook.
 */
export async function startDepositRevault(state: DepositState): Promise<DepositRevaultSetup> {
  if (!canRevaultDepositCard(state)) {
    throw new DepositRevaultError(
      'This booking has no deposit card to replace',
      'not_revaultable',
    )
  }

  // Mock mode must not reach the real function — same guard as chargeDeposit.
  if (Config.useMock) {
    await new Promise(resolve => setTimeout(resolve, 400))
    return {
      clientSecret: `seti_mock_secret_${Date.now()}`,
      setupIntentId: `seti_mock_${Date.now()}`,
      reusedExistingIntent: false,
    }
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  // supabase-js RESOLVES on failure: getSession returns { data, error } rather
  // than rejecting, so this branch is the only thing standing between an
  // expired refresh token and an unexplained 401 from the edge function.
  if (sessionError) {
    throw new DepositRevaultError(sessionError.message, 'unauthorized')
  }
  const accessToken = session?.access_token
  if (!accessToken) {
    throw new DepositRevaultError('Unauthorized', 'unauthorized')
  }

  let result: { clientSecret: string; setup_intent_id: string }
  try {
    result = await createDepositSetup({ bookingId: state.bookingId, accessToken })
  } catch (e) {
    // createDepositSetup throws Error(<edge function's own jsonError body>),
    // which is human-readable copy ("No deposit required for this booking",
    // "Booking does not belong to caller") — safe to surface directly.
    throw new DepositRevaultError(
      e instanceof Error && e.message ? e.message : 'Failed to start card update',
      'request_failed',
    )
  }

  return {
    clientSecret: result.clientSecret,
    setupIntentId: result.setup_intent_id,
    reusedExistingIntent:
      !!state.setupIntentId && state.setupIntentId === result.setup_intent_id,
  }
}
