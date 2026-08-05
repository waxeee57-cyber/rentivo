import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'

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

/** Values written to `rentivo_bookings.deposit_status` by create-deposit-setup,
 *  charge-deposit and stripe-webhook. The column is plain text, so this is a
 *  documentation type rather than a constraint. */
export type KnownDepositStatus =
  | 'none'
  | 'pending'
  | 'authorized'
  | 'charged'
  | 'charge_failed'
  | 'released'

export interface DepositState {
  bookingId: string
  /** The hard cap on any charge. Whole euros. 0 means "nothing is chargeable". */
  depositAmount: number
  depositStatus: string
  depositChargedAmount: number
  /** True once the setup_intent.succeeded webhook stored a vaulted card. */
  hasVaultedCard: boolean
  currency: string
}

/**
 * The deposit_* workflow columns are NOT on the `Booking` type in types/index.ts,
 * so a screen cannot learn from `fetchBooking` whether a charge is even possible.
 * Read them explicitly.
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
    }
  }

  const { data, error } = await supabase
    .from('rentivo_bookings')
    // One literal, NOT a concatenation: supabase-js parses the select string as
    // a literal type to infer the row shape, and `'a' + 'b'` widens to `string`,
    // which collapses the inference to GenericStringError.
    .select('id, deposit_amount, deposit_status, deposit_charged_amount, deposit_payment_method_id, currency')
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
    currency: string | null
  }

  return {
    bookingId: row.id,
    depositAmount: toEuros(row.deposit_amount),
    depositStatus: row.deposit_status ?? 'none',
    depositChargedAmount: toEuros(row.deposit_charged_amount),
    hasVaultedCard: !!row.deposit_payment_method_id,
    currency: row.currency ?? 'EUR',
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
  /** A previous off_session charge was declined; the server will not retry it. */
  | 'charge_failed'

export function depositBlockReason(state: DepositState | null): DepositBlockReason | null {
  if (!state) return 'not_authorized'

  // Checked FIRST and independently of status: a EUR 0 deposit is a product
  // decision (paid waiver), not a workflow failure, and must never be
  // explained to the operator as "not set up yet".
  if (!(state.depositAmount > 0)) return 'waived'

  if (state.depositStatus === 'charged') return 'already_charged'
  if (state.depositStatus === 'charge_failed') return 'charge_failed'
  if (!state.hasVaultedCard) return 'no_card'
  if (state.depositStatus !== 'authorized') return 'not_authorized'
  return null
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
 * NOTE for callers: charge-deposit uses a FIXED Stripe idempotency key
 * (`rentivo_dep_<booking_id>`), so a booking gets exactly one deposit charge.
 * A second call with a different amount is rejected by Stripe, and the server
 * refuses anything that is not `deposit_status === 'authorized'` anyway.
 * Get the amount right the first time — hence the confirmation step upstream.
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
