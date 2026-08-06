/**
 * Transactional email is SERVER-TO-SERVER ONLY. This module cannot send mail,
 * and it no longer pretends to.
 *
 * `supabase/functions/send-email/index.ts` gates every request on a shared
 * secret before it looks at the body:
 *
 *     const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET')
 *     if (!internalSecret) return 503 'not configured'
 *     if (req.headers.get('X-Internal-Secret') !== internalSecret) return 401
 *
 * The previous implementation called `supabase.functions.invoke('send-email')`
 * with no such header, so EVERY call 401'd — and because it also discarded the
 * `{ error }` that supabase-js RESOLVES with, the failure was invisible: the
 * promise fulfilled and the caller carried on as though mail had been sent.
 */

/*
 * The secret CANNOT be moved into this module. React Native ships its JS bundle
 * to the device; anything reachable from client code (including every
 * EXPO_PUBLIC_* env var) is extractable from a shipped build. `send-email`
 * renders Rentivo-branded HTML to an arbitrary `to` address, so leaking that
 * secret would hand any user of the app an open relay for phishing under the
 * Rentivo brand. The 401 is the function behaving correctly; the client was the
 * bug.
 *
 * WHERE EMAIL ACTUALLY BELONGS
 * Send it from an edge function that already holds the secret, exactly as
 * `supabase/functions/drip-email/index.ts` does — it forwards
 * `X-Internal-Secret` from its own environment on a plain `fetch`. A client
 * screen that needs mail sent should call an edge function that performs the
 * action AND sends the mail, never a bare mail endpoint.
 */

/** Templates `send-email` can render. Kept exported so a server-side caller has
 *  one list to check against. */
export type EmailTemplate =
  | 'operator_welcome'
  | 'operator_day3_tips'
  | 'operator_day7_pricing'
  | 'operator_day14_growth'
  | 'booking_confirmed_guest'
  | 'booking_confirmed_operator'
  | 'booking_cancelled_guest'
  | 'booking_cancelled_operator'
  | 'identity_verified'

/** Thrown by `sendEmail`. A distinct class so a caller cannot mistake this for
 *  a transient network failure and retry it forever. */
export class ClientEmailUnsupportedError extends Error {
  readonly template: EmailTemplate

  constructor(template: EmailTemplate) {
    super(
      `Cannot send the "${template}" email from the app. ` +
      'supabase/functions/send-email requires the X-Internal-Secret header ' +
      '(INTERNAL_FUNCTION_SECRET), a server-only secret that must never ship in ' +
      'the client bundle. Send this mail from an edge function instead — see ' +
      'supabase/functions/drip-email/index.ts for the working pattern.'
    )
    this.name = 'ClientEmailUnsupportedError'
    this.template = template
    // Required for `instanceof` to survive TS's ES5-class downlevelling.
    Object.setPrototypeOf(this, ClientEmailUnsupportedError.prototype)
  }
}

/**
 * Always rejects. Present so that any existing or future call site fails loudly
 * and immediately — at the call, with an actionable message — instead of
 * silently swallowing a 401 and reporting success to the user.
 *
 * Deliberately makes no network request: a call that can only ever 401 is not
 * worth a round trip, and firing it would fill the function logs with 401s that
 * read like an attack rather than a bug.
 */
export function sendEmail(
  _to: string,
  template: EmailTemplate,
  _data: Record<string, string | number>
): Promise<never> {
  return Promise.reject(new ClientEmailUnsupportedError(template))
}
