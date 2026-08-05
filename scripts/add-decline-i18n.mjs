/**
 * Adds the two strings the operator decline needs now that it actually
 * refunds. Same bottom-up splice + parity verification as add-feed-i18n.mjs.
 *
 * Run: node scripts/add-decline-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'constants/i18n.ts'
const ANCHOR = /^\s+instantBook:/

const KEYS = {
  opBkDeclined: ['Booking declined.', 'Reserva rechazada.', 'Foglalás elutasítva.'],
  opBkDeclinedRefunded: [
    'Booking declined. {amount} refunded to the guest.',
    'Reserva rechazada. Se han devuelto {amount} al huésped.',
    'Foglalás elutasítva. {amount} visszatérítve a vendégnek.',
  ],
}

const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const lines = readFileSync(FILE, 'utf8').split('\n')

const anchors = []
lines.forEach((l, i) => { if (ANCHOR.test(l)) anchors.push(i) })
if (anchors.length !== 3) { console.error(`expected 3 anchors, got ${anchors.length}`); process.exit(1) }
if (lines.some(l => /^\s+opBkDeclinedRefunded:/.test(l))) { console.error('already present'); process.exit(0) }

const indent = (lines[anchors[0]].match(/^(\s+)/) || [, '    '])[1]
for (let li = 2; li >= 0; li--) {
  lines.splice(anchors[li] + 1, 0,
    ...Object.entries(KEYS).map(([k, v]) => `${indent}${k}: '${esc(v[li])}',`))
}
writeFileSync(FILE, lines.join('\n'))

const out = readFileSync(FILE, 'utf8')
const bad = Object.keys(KEYS)
  .map(k => [k, (out.match(new RegExp(`^\\s+${k}:`, 'gm')) || []).length])
  .filter(([, n]) => n !== 3)
if (bad.length) { console.error('PARITY BROKEN:', bad); process.exit(1) }
console.log(`added ${Object.keys(KEYS).length} keys x 3 locales; parity ok`)
