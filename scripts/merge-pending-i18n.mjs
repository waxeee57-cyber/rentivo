/**
 * Merge every docs/i18n-pending-*.json file into constants/i18n.ts.
 *
 * Parallel work on the app produced new strings in several areas at once, and
 * three engineers splicing the same 4000-line translation table by hand is how
 * a locale block silently loses a key. Each area wrote its proposed keys to its
 * own JSON file instead; this script merges them in one pass, bottom-up so the
 * earlier anchors keep their line numbers, and refuses to write unless all
 * three locales end up with exactly the same key count.
 *
 * Idempotent: keys already present in the table are skipped, so re-running
 * after adding one more pending file is safe.
 *
 * Run: node scripts/merge-pending-i18n.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const FILE = 'constants/i18n.ts'
const DOCS = 'docs'
const ANCHOR = /^\s+instantBook:/
const LOCALES = ['en', 'es', 'hu']

// Keys that belong to no single area, added here rather than in a pending file.
const EXTRA = {
  opBkOpenInspection: {
    en: 'Open inspection report',
    es: 'Abrir informe de inspección',
    hu: 'Állapotfelmérés megnyitása',
  },
}

const pendingFiles = readdirSync(DOCS).filter(f => /^i18n-pending-.*\.json$/.test(f))
const incoming = { ...EXTRA }
for (const f of pendingFiles) {
  const parsed = JSON.parse(readFileSync(join(DOCS, f), 'utf8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (incoming[key]) {
      console.error(`duplicate key "${key}" across pending files (${f})`)
      process.exit(1)
    }
    incoming[key] = value
  }
}

const src = readFileSync(FILE, 'utf8')
const lines = src.split('\n')

// Skip anything already in the table. A key defined twice in the same object
// literal is legal TypeScript and silently wins on the last definition, so this
// has to be checked rather than assumed.
const fresh = Object.entries(incoming).filter(([key]) =>
  !new RegExp(`^\\s+${key}:`, 'm').test(src))

const skipped = Object.keys(incoming).length - fresh.length
if (fresh.length === 0) {
  console.log(`nothing to add (${skipped} already present)`)
  process.exit(0)
}

for (const [key, value] of fresh) {
  const missing = LOCALES.filter(l => typeof value[l] !== 'string' || value[l].length === 0)
  if (missing.length) {
    console.error(`key "${key}" is missing locales: ${missing.join(', ')}`)
    process.exit(1)
  }
}

const anchors = []
lines.forEach((line, i) => { if (ANCHOR.test(line)) anchors.push(i) })
if (anchors.length !== LOCALES.length) {
  console.error(`expected ${LOCALES.length} anchors, found ${anchors.length}`)
  process.exit(1)
}

const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const indent = (lines[anchors[0]].match(/^(\s+)/) || [, '    '])[1]

// Bottom-up: splicing the last locale first leaves the earlier anchor indexes
// valid.
for (let li = LOCALES.length - 1; li >= 0; li--) {
  lines.splice(anchors[li] + 1, 0,
    ...fresh.map(([key, value]) => `${indent}${key}: '${esc(value[LOCALES[li]])}',`))
}

writeFileSync(FILE, lines.join('\n'))

const out = readFileSync(FILE, 'utf8')
const broken = fresh
  .map(([key]) => [key, (out.match(new RegExp(`^\\s+${key}:`, 'gm')) || []).length])
  .filter(([, count]) => count !== LOCALES.length)

if (broken.length) {
  console.error('PARITY BROKEN:', broken)
  process.exit(1)
}

console.log(`merged ${fresh.length} keys x ${LOCALES.length} locales from ${pendingFiles.length} pending file(s); ${skipped} already present; parity ok`)
