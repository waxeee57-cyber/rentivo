/**
 * Create the Stripe CONNECT webhook endpoint and store its signing secret.
 *
 * Why this exists: a Stripe webhook endpoint is either a platform endpoint or a
 * Connect endpoint, and `connect` cannot be toggled after creation. The single
 * existing endpoint was a platform endpoint, so `account.updated` for a
 * CONNECTED account was never delivered — even though the event was in its
 * enabled list. Evidence from rentivo_stripe_events: 72 payment_intent.succeeded,
 * 13 setup_intent.succeeded, and zero account.updated, ever.
 *
 * The consequence is that `stripe_onboarded` could never change. An operator who
 * finished Connect onboarding stayed false forever, and create-payment-intent
 * refuses to route money to an account that reads as not onboarded. Onboarding
 * completed at Stripe and never completed here.
 *
 * The secret is written straight into the Supabase function environment and is
 * never printed or written to disk.
 *
 * Run: node scripts/setup-connect-webhook.mjs
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map(l => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map(m => [m[1], m[2].trim()]),
)

const KEY = env.STRIPE_SECRET_KEY
if (!KEY?.startsWith('sk_test_')) {
  console.error('REFUSING: not a Stripe test key.')
  process.exit(1)
}

const PROJECT = 'xeyfsacbozucxrwlefro'
const URL = `https://${PROJECT}.supabase.co/functions/v1/stripe-webhook`

async function stripe(path, params, method = 'POST') {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  return res.json()
}

const list = await stripe('/webhook_endpoints?limit=100', null, 'GET')
for (const e of list.data ?? []) {
  const detail = await stripe(`/webhook_endpoints/${e.id}`, null, 'GET')
  console.log(`${e.id}  connect=${detail.connect}  ${e.status}  ${e.url}`)
}

const existingConnect = []
for (const e of list.data ?? []) {
  const detail = await stripe(`/webhook_endpoints/${e.id}`, null, 'GET')
  if (detail.connect === true && e.url === URL) existingConnect.push(e.id)
}

// Recreate rather than reuse: Stripe returns the signing secret exactly once, at
// creation, so an endpoint whose secret we do not hold is useless to us.
for (const id of existingConnect) {
  await stripe(`/webhook_endpoints/${id}`, null, 'DELETE')
  console.log(`deleted stale connect endpoint ${id}`)
}

const body = new URLSearchParams()
body.set('url', URL)
body.set('connect', 'true')
body.set('description', 'Rentivo Connect events. A platform endpoint cannot receive connected-account events.')
body.append('enabled_events[]', 'account.updated')
body.append('enabled_events[]', 'account.application.deauthorized')

const created = await stripe('/webhook_endpoints', body)
if (created.error) {
  console.error('create failed:', created.error.message)
  process.exit(1)
}
console.log(`created ${created.id}  connect=${created.connect}  events=${created.enabled_events.join(',')}`)

if (!created.secret) {
  console.error('Stripe returned no signing secret; cannot configure the function.')
  process.exit(1)
}

// Never printed, never written to a file.
// `shell: true` on Windows: npx is a .cmd shim, and execFileSync will not run one
// without a shell.
execFileSync(
  'npx',
  ['supabase', 'secrets', 'set', `STRIPE_CONNECT_WEBHOOK_SECRET=${created.secret}`, '--project-ref', PROJECT],
  { stdio: ['ignore', 'inherit', 'inherit'], shell: true },
)
console.log('STRIPE_CONNECT_WEBHOOK_SECRET stored in the Supabase function environment.')
