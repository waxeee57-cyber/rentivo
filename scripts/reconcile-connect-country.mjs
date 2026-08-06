/**
 * Set stripe_account_country from what Stripe ACTUALLY holds.
 *
 * The migration that added the column backfilled every row with a
 * stripe_account_id to 'HU', on the theory that all existing accounts were
 * created under the old hardcoded `country: 'HU'`. That was too broad: accounts
 * created after the country fix carry their own country, and stamping HU on
 * them made the mismatch guard fire 409 stripe_country_mismatch on an operator
 * whose account was never Hungarian. The guard was right; the data was wrong.
 *
 * A backfill that guesses is a backfill that lies. This reads the truth.
 *
 * Run: node scripts/reconcile-connect-country.mjs
 */
import { readFileSync } from 'node:fs'

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

const accounts = process.argv.slice(2)
if (accounts.length === 0) {
  console.error('usage: node scripts/reconcile-connect-country.mjs acct_x acct_y ...')
  process.exit(1)
}

for (const id of accounts) {
  const res = await fetch(`https://api.stripe.com/v1/accounts/${id}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  })
  const acct = await res.json()
  if (acct.error) {
    console.log(`${id}\tERROR\t${acct.error.message}`)
    continue
  }
  console.log(`${id}\t${acct.country}\tcharges=${acct.charges_enabled}\tpayouts=${acct.payouts_enabled}`)
}
