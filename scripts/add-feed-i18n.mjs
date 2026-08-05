/**
 * One-shot: add the feed surface's translation keys to all three locales.
 *
 * Inserted after `instantBook:` inside each block, bottom-up so the earlier
 * blocks' line numbers do not shift under us. The three locales must end with
 * IDENTICAL key sets - the quality gate fails the build otherwise, and a
 * missing key renders as the raw key name to a real user.
 *
 * Run: node scripts/add-feed-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'constants/i18n.ts'

const KEYS = {
  feedGrid:             ['Grid', 'Cuadrícula', 'Rács'],
  feedFeed:             ['Feed', 'Feed', 'Feed'],
  feedWhatYouGet:       ['What you get', 'Qué incluye', 'Amit kapsz'],
  feedMoneyGoes:        ['Where the money goes', 'Adónde va el dinero', 'Hová megy a pénz'],
  feedServiceFee:       ['Service fee', 'Tarifa de servicio', 'Szolgáltatási díj'],
  feedYouPay:           ['You pay', 'Tú pagas', 'Te fizetsz'],
  feedDepositZero:      [
    'Deposit €0 with the damage waiver. Nothing is charged until the owner confirms.',
    'Fianza de 0 € con la exención de daños. No se cobra nada hasta que el propietario confirme.',
    'A kaució €0 a kárátvállalással. Semmit nem terhelünk, amíg a tulajdonos vissza nem igazol.',
  ],
  feedDepositHeld:      [
    'Deposit {amount}, returned after drop-off. Nothing is charged until the owner confirms.',
    'Fianza de {amount}, devuelta tras la entrega. No se cobra nada hasta que el propietario confirme.',
    'Kaució {amount}, visszaadás után jóváírjuk. Semmit nem terhelünk, amíg a tulajdonos vissza nem igazol.',
  ],
  feedDaysN:            ['{n} days', '{n} días', '{n} nap'],
  feedSeatsN:           ['{n} seats', '{n} plazas', '{n} férőhely'],
  feedReserveFor:       ['Reserve — {amount}', 'Reservar — {amount}', 'Foglalás — {amount}'],
  feedShortlist:        ['Shortlist', 'Guardar', 'Mentés'],
  feedShare:            ['Share', 'Compartir', 'Megosztás'],
  feedPrivateHost:      ['Private host', 'Anfitrión particular', 'Magánszemély'],
  feedVerifiedOperator: ['Verified operator', 'Operador verificado', 'Hitelesített üzemeltető'],
  feedShortlistedN:     ['{n} shortlisted', '{n} guardados', '{n} mentve'],
  feedCompare:          ['Compare', 'Comparar', 'Összehasonlítás'],
  feedCompareTitle:     ['Side by side', 'Lado a lado', 'Egymás mellett'],
  feedCompareEmpty:     [
    'Tap the heart on anything you like. They land here, side by side.',
    'Toca el corazón en lo que te guste. Aparecerán aquí, lado a lado.',
    'Koppints a szívre, ami tetszik. Itt landolnak, egymás mellett.',
  ],
  feedCompareNote:      [
    'Green is the lowest in that row. Totals include the service fee, and the deposit is held, not spent.',
    'El verde es el valor más bajo de la fila. Los totales incluyen la tarifa de servicio; la fianza se bloquea, no se cobra.',
    'A zöld a sor legalacsonyabb értéke. A végösszeg tartalmazza a szolgáltatási díjat, a kauciót zároljuk, nem vonjuk le.',
  ],
  feedRowPerDay:        ['Per day', 'Por día', 'Naponta'],
  feedRowDays:          ['Days', 'Días', 'Napok'],
  feedRowTotal:         ['Total', 'Total', 'Összesen'],
  feedRowDeposit:       ['Deposit', 'Fianza', 'Kaució'],
  feedRowSeats:         ['Seats', 'Plazas', 'Férőhely'],
  feedRowRating:        ['Rating', 'Valoración', 'Értékelés'],
  feedRowBooking:       ['Booking', 'Reserva', 'Foglalás'],
  feedOnRequest:        ['On request', 'Bajo petición', 'Kérésre'],
  feedEmpty:            [
    'Nothing available for these dates yet.',
    'Nada disponible para estas fechas todavía.',
    'Ezekre a napokra még nincs szabad jármű.',
  ],
  feedEmptyHint:        [
    'Try a wider date range, or a different city.',
    'Prueba un rango de fechas más amplio u otra ciudad.',
    'Próbálj tágabb időszakot vagy másik várost.',
  ],
}

const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const src = readFileSync(FILE, 'utf8')
const lines = src.split('\n')

// Locate the `instantBook:` line inside each locale block.
const anchors = []
lines.forEach((l, i) => { if (/^\s+instantBook:/.test(l)) anchors.push(i) })
if (anchors.length !== 3) {
  console.error(`expected 3 instantBook anchors, found ${anchors.length}`)
  process.exit(1)
}
if (lines.some(l => /^\s+feedWhatYouGet:/.test(l))) {
  console.error('feed keys already present - nothing to do')
  process.exit(0)
}

const indent = (lines[anchors[0]].match(/^(\s+)/) || [, '    '])[1]

// Bottom-up, so inserting into `hu` does not move the `es`/`en` anchors.
for (let li = 2; li >= 0; li--) {
  const block = Object.entries(KEYS)
    .map(([k, v]) => `${indent}${k}: '${esc(v[li])}',`)
  lines.splice(anchors[li] + 1, 0, ...block)
}

writeFileSync(FILE, lines.join('\n'))

// Verify parity immediately rather than trusting the splice.
const out = readFileSync(FILE, 'utf8')
const counts = Object.keys(KEYS).map(k => {
  const n = (out.match(new RegExp(`^\\s+${k}:`, 'gm')) || []).length
  return [k, n]
})
const bad = counts.filter(([, n]) => n !== 3)
console.log(`added ${Object.keys(KEYS).length} keys x 3 locales`)
if (bad.length) { console.error('PARITY BROKEN:', bad); process.exit(1) }
console.log('parity ok: every new key appears exactly 3 times')
