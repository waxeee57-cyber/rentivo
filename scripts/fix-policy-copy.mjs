/**
 * The cancellation policy descriptions the OPERATOR picks from were wrong.
 *
 * The server (supabase/functions/cancel-booking, mirrored in
 * lib/utils/cancellation.ts) gives a full refund at 24h for flexible, 48h for
 * moderate and 72h for strict. The picker said "1 day", "5 days" and "14 days".
 *
 * So an operator chose "Strict - full refund 14 days before" believing late
 * cancellations were protected, and the platform refunded the renter in full at
 * 3 days out. The operator was told one commercial term and bound to another,
 * and the renter saw the operator's chosen policy name on the listing. Under
 * consumer law the term actually applied is the one that matters, which makes
 * this a misrepresentation to the operator, not a cosmetic string.
 *
 * Run: node scripts/fix-policy-copy.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'constants/i18n.ts'

const REPLACEMENTS = [
  // en
  ["opFleetPolicyFlexibleDesc: 'Full refund 1 day before',", "opFleetPolicyFlexibleDesc: 'Full refund up to 24 hours before',"],
  ["opFleetPolicyModerateDesc: 'Full refund 5 days before',", "opFleetPolicyModerateDesc: 'Full refund up to 48 hours before, 50% up to 24 hours',"],
  ["opFleetPolicyStrictDesc: 'Full refund 14 days before',", "opFleetPolicyStrictDesc: 'Full refund up to 72 hours before',"],
  // es
  ["opFleetPolicyFlexibleDesc: 'Reembolso completo 1 día antes',", "opFleetPolicyFlexibleDesc: 'Reembolso completo hasta 24 horas antes',"],
  ["opFleetPolicyModerateDesc: 'Reembolso completo 5 días antes',", "opFleetPolicyModerateDesc: 'Reembolso completo hasta 48 horas antes, 50% hasta 24 horas',"],
  ["opFleetPolicyStrictDesc: 'Reembolso completo 14 días antes',", "opFleetPolicyStrictDesc: 'Reembolso completo hasta 72 horas antes',"],
  // hu
  ["opFleetPolicyFlexibleDesc: 'Teljes visszatérítés 1 nappal korábban',", "opFleetPolicyFlexibleDesc: 'Teljes visszatérítés 24 órával a kezdés előttig',"],
  ["opFleetPolicyModerateDesc: 'Teljes visszatérítés 5 nappal korábban',", "opFleetPolicyModerateDesc: 'Teljes visszatérítés 48 órával előttig, 50% 24 óráig',"],
  ["opFleetPolicyStrictDesc: 'Teljes visszatérítés 14 nappal korábban',", "opFleetPolicyStrictDesc: 'Teljes visszatérítés 72 órával a kezdés előttig',"],
]

let src = readFileSync(FILE, 'utf8')
let changed = 0
for (const [from, to] of REPLACEMENTS) {
  if (!src.includes(from)) {
    console.error(`NOT FOUND, aborting: ${from}`)
    process.exit(1)
  }
  src = src.replace(from, to)
  changed++
}
writeFileSync(FILE, src)
console.log(`rewrote ${changed} policy descriptions to match what cancel-booking actually does`)
