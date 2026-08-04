#!/usr/bin/env node
/**
 * Rentivo quality gate — the mechanical half of a design/code review.
 *
 * WHY THIS EXISTS
 * A 2026-08-04 audit pass burned a very large amount of review effort
 * re-deriving facts a script can measure in under a second: which locales were
 * missing keys, which text styles fell back to the system font, which contrast
 * pairs failed AA, which Supabase queries had no bound. Every check below was a
 * REAL defect found that day. Keeping them as assertions means the next review
 * starts from a 30-line report instead of 40 000 lines of source.
 *
 *   node scripts/quality-check.mjs           # report + exit 1 on regression
 *   node scripts/quality-check.mjs --update  # rewrite the baseline
 *
 * Run it before every commit and in CI. A metric that only ever gets WORSE
 * silently is how a codebase rots.
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')
const BASELINE = path.join(ROOT, 'docs', 'QUALITY-BASELINE.json')
const UPDATE = process.argv.includes('--update')

const SKIP = /node_modules|[\\/]\.git|[\\/]android|[\\/]ios|[\\/]dist|[\\/]\.next|[\\/]\.expo|__pycache__|[\\/]build/
function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (SKIP.test(p)) continue
    if (e.isDirectory()) walk(p, exts, out)
    else if (exts.some(x => e.name.endsWith(x))) out.push(p)
  }
  return out
}
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/')
const APP = [...walk(path.join(ROOT, 'app'), ['.tsx', '.ts']), ...walk(path.join(ROOT, 'components'), ['.tsx', '.ts'])]
const LIB = walk(path.join(ROOT, 'lib'), ['.ts', '.tsx'])
const EDGE = walk(path.join(ROOT, 'supabase', 'functions'), ['.ts'])

const findings = []   // { metric, count, worst[] }
const add = (metric, count, worst = []) => findings.push({ metric, count, worst })

// ── 1. Colour contrast (WCAG 2.x) ──────────────────────────────────────────
// The 2026-08-04 audit found body text at 2.61:1 in light mode and the primary
// button label at 3.76:1 — both below the 4.5:1 floor, on every screen.
const srgb = c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const lum = hex => {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

function parseTheme(src, name) {
  const m = src.match(new RegExp(`export const ${name}\\s*=\\s*{([\\s\\S]*?)\\n}`))
  if (!m) return null
  const out = {}
  for (const kv of m[1].matchAll(/(\w+)\s*:\s*'(#[0-9A-Fa-f]{6})'/g)) out[kv[1]] = kv[2]
  return out
}
const colorsSrc = fs.existsSync(path.join(ROOT, 'constants/colors.ts'))
  ? fs.readFileSync(path.join(ROOT, 'constants/colors.ts'), 'utf8') : ''
const PAIRS = [
  ['text', 'background', 4.5], ['text', 'surface', 4.5],
  ['textSecondary', 'background', 4.5], ['textSecondary', 'surface', 4.5],
  ['textTertiary', 'background', 4.5], ['textTertiary', 'surface', 4.5],
  ['textInverse', 'primary', 4.5], ['primary', 'surface', 4.5],
  ['error', 'surface', 4.5], ['success', 'surface', 4.5], ['warning', 'surface', 4.5],
]
const contrastFails = []
for (const theme of ['Colors', 'DarkColors']) {
  const t = parseTheme(colorsSrc, theme)
  if (!t) continue
  for (const [fg, bg, min] of PAIRS) {
    if (!t[fg] || !t[bg]) continue
    const r = ratio(t[fg], t[bg])
    if (r < min) contrastFails.push(`${theme}.${fg} on ${bg}: ${r.toFixed(2)}:1 (need ${min})`)
  }
}
add('contrast_pairs_below_AA', contrastFails.length, contrastFails)

// ── 2. i18n parity + untranslated values ───────────────────────────────────
const i18nPath = path.join(ROOT, 'constants/i18n.ts')
let localeKeys = {}
if (fs.existsSync(i18nPath)) {
  const src = fs.readFileSync(i18nPath, 'utf8')
  for (const loc of ['en', 'es', 'hu']) {
    const m = src.match(new RegExp(`\\n  ${loc}:\\s*{([\\s\\S]*?)\\n  },`))
    if (!m) continue
    const map = {}
    // Comments first: an explanatory `// Two problems: "Premium" is …` parses as
    // a key called `problems` and shows up as a missing translation in es/hu.
    const body = m[1].replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    // NOT anchored per line: this file packs several keys onto one line
    // (`pickupTime: '…', returnTime: '…',`). A line-anchored parser silently
    // dropped every second key and reported four phantom "missing translations".
    for (const kv of body.matchAll(/(\w+):\s*(['"`])((?:\\.|(?!\2)[\s\S])*?)\2/g)) map[kv[1]] = kv[3]
    localeKeys[loc] = map
  }
}
const en = localeKeys.en ?? {}
const missing = []
for (const loc of ['es', 'hu']) {
  for (const k of Object.keys(en)) if (!(k in (localeKeys[loc] ?? {}))) missing.push(`${loc}:${k}`)
}
add('i18n_missing_keys', missing.length, missing.slice(0, 20))
const untranslated = []
for (const loc of ['es', 'hu']) {
  for (const [k, v] of Object.entries(localeKeys[loc] ?? {})) {
    // Identical to EN and long enough that it is unlikely to be a real cognate.
    if (en[k] && en[k] === v && v.length > 6 && /\s/.test(v)) untranslated.push(`${loc}:${k}`)
  }
}
add('i18n_untranslated_values', untranslated.length, untranslated.slice(0, 20))

// ── 3. Brand typeface coverage ─────────────────────────────────────────────
// The app shipped in Roboto for months: `Fonts` existed but 342 heading-weight
// styles never referenced it. Any style with a fontSize must name a face.
let noFamily = 0
const noFamilyWorst = {}
for (const f of APP) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\{[^{}]*fontSize:[^{}]*\}/g)) {
    if (!/fontFamily/.test(m[0])) { noFamily++; noFamilyWorst[rel(f)] = (noFamilyWorst[rel(f)] ?? 0) + 1 }
  }
}
add('text_styles_without_fontFamily', noFamily,
  Object.entries(noFamilyWorst).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${v}  ${k}`))

// ── 4. fontFamily + fontWeight together (faux-bold on Android) ─────────────
let fauxBold = 0
const fauxWorst = []
for (const f of APP) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/\{[^{}]*\}/g)) {
    if (/fontFamily:\s*Fonts\./.test(m[0]) && /fontWeight:/.test(m[0])) { fauxBold++; fauxWorst.push(rel(f)) }
  }
}
add('fontFamily_with_fontWeight', fauxBold, [...new Set(fauxWorst)].slice(0, 10))

// ── 5. Colour emoji used as UI icons ───────────────────────────────────────
// Multi-colour glyphs beside a monoline Ionicons set is the loudest
// "not designed" tell. Typographic glyphs (arrows, ✓, ★) are allowed.
// Ranges are punched out around the glyphs the type system legitimately uses:
// ★ U+2605 / ☆ U+2606 (rating), ✓ U+2713 ✔ U+2714 ✕ U+2715 ✖ U+2716 ✗ U+2717
// (check + close). Regional indicators (flags) are excluded too — a country
// flag carries information no monoline icon can, and the language picker
// deliberately keeps them.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{2604}\u{2607}-\u{2712}\u{2718}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u
let emoji = 0
const emojiWorst = []
for (const f of APP) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    if (EMOJI.test(l)) { emoji++; emojiWorst.push(`${rel(f)}:${i + 1}`) }
  })
}
add('colour_emoji_lines', emoji, emojiWorst.slice(0, 10))

// ── 6. Unbounded Supabase list queries ─────────────────────────────────────
// `fetchListings` pulled EVERY active listing with nested joins, no pagination.
const unbounded = []
for (const f of [...LIB, ...EDGE]) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\.from\((['"`])([\w.]+)\1\)([\s\S]{0,600}?)(?=\n\s*(?:\}|const |export |async |function )|$)/g)) {
    const chain = m[3]
    if (!/\.select\(/.test(chain)) continue
    if (/\.(single|maybeSingle|range|limit)\s*\(/.test(chain)) continue
    if (/\.(insert|update|upsert|delete)\s*\(/.test(chain)) continue
    unbounded.push(`${rel(f)} → ${m[2]}`)
  }
}
add('unbounded_select_queries', unbounded.length, unbounded.slice(0, 10))

// ── 7. Mutations that ignore the mock gate ─────────────────────────────────
// With USE_MOCK=true these fired real writes at production; a zero-row UPDATE
// returns no error from supabase-js, so the UI reported success either way.
const ungated = []
for (const f of LIB) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)[\s\S]*?(?=\nexport |\n?$)/g)) {
    const body = m[0]
    if (!/\.(insert|update|upsert|delete)\s*\(/.test(body)) continue
    if (/Config\.useMock/.test(body)) continue
    ungated.push(`${rel(f)} → ${m[1]}()`)
  }
}
add('mutations_without_mock_gate', ungated.length, ungated.slice(0, 10))

// ── 8. Floating-dock clearance ─────────────────────────────────────────────
// Dock = height 64 + marginBottom 26 ≈ 90px. Lists with less bottom padding
// hide their last row (sign-out, the last fleet card) under it permanently.
const DOCK = 100
// Deep screens (detail, checkout, settings) hide the dock via DEEP_SCREEN in
// their group layout, so their bottom padding is intentionally smaller. Collect
// those routes from the layouts rather than guessing from the file's contents.
const deepRoutes = new Set()
for (const layout of ['(consumer)', '(host)', '(operator)'].map(g => path.join(ROOT, 'app', g, '_layout.tsx'))) {
  if (!fs.existsSync(layout)) continue
  const src = fs.readFileSync(layout, 'utf8')
  for (const m of src.matchAll(/<Tabs\.Screen\s+name="([^"]+)"\s+options=\{DEEP_SCREEN\}/g)) {
    deepRoutes.add(m[1].replace(/\/index$/, ''))
  }
}
const isDeep = f => {
  const r = rel(f).replace(/^app\/\([^)]+\)\//, '').replace(/\.tsx?$/, '').replace(/\/index$/, '')
  return deepRoutes.has(r)
}
const clipped = []
for (const f of APP) {
  const src = fs.readFileSync(f, 'utf8')
  if (!/tabBarStyle|\(consumer\)|\(host\)|\(operator\)/.test(src) && !/(consumer|host|operator)/.test(rel(f))) continue
  if (isDeep(f) || /DEEP_SCREEN|display:\s*'none'/.test(src)) continue
  for (const m of src.matchAll(/(?:content|list|scroll\w*|container)\s*:\s*\{[^{}]*\}/gi)) {
    const pb = m[0].match(/paddingBottom:\s*(\d+)/)
    if (pb && Number(pb[1]) < DOCK) clipped.push(`${rel(f)} paddingBottom:${pb[1]}`)
  }
}
add('lists_clipped_by_dock', clipped.length, clipped.slice(0, 10))

// ── 9. Secrets that must never be in the tree ──────────────────────────────
const secrets = []
for (const f of [...walk(ROOT, ['.env', '.ts', '.tsx', '.json', '.md'])]) {
  // `.env` holds real local credentials by design and is gitignored (verified:
  // `git ls-files .env` empty, `git check-ignore .env` matches). This check is
  // about secrets reaching the TRACKED tree, so scanning it only ever produces
  // a permanent false positive that trains people to ignore the gate.
  if (/\.env$|\.env\.example|\.env\.stash|QUALITY-BASELINE/.test(f)) continue
  const src = fs.readFileSync(f, 'utf8')
  if (/\b(sk_live|sk_test|rk_live|whsec_)[A-Za-z0-9]{10,}/.test(src)) secrets.push(rel(f))
  if (/\beyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/.test(src)) secrets.push(`${rel(f)} (JWT)`)
}
add('secrets_in_tree', [...new Set(secrets)].length, [...new Set(secrets)].slice(0, 10))

// ── 10. Diagnostics that leak to device logs ───────────────────────────────
let consoles = 0
const consoleWorst = {}
for (const f of [...APP, ...LIB]) {
  const n = (fs.readFileSync(f, 'utf8').match(/console\.(log|error|warn|info)\(/g) ?? []).length
  if (n) { consoles += n; consoleWorst[rel(f)] = n }
}
add('console_calls', consoles,
  Object.entries(consoleWorst).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${v}  ${k}`))

// ── 11. Type escapes ───────────────────────────────────────────────────────
let anyCount = 0
for (const f of [...APP, ...LIB, ...EDGE]) {
  anyCount += (fs.readFileSync(f, 'utf8').match(/\bas any\b|:\s*any\b/g) ?? []).length
}
add('type_escapes_any', anyCount)

// ── Report ─────────────────────────────────────────────────────────────────
const current = Object.fromEntries(findings.map(f => [f.metric, f.count]))
let base = {}
if (fs.existsSync(BASELINE)) base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))

const W = Math.max(...findings.map(f => f.metric.length)) + 2
let regressions = 0
console.log('\n  RENTIVO QUALITY GATE\n')
console.log('  ' + 'metric'.padEnd(W) + 'now'.padStart(7) + 'base'.padStart(7) + '   ')
console.log('  ' + '-'.repeat(W + 18))
for (const f of findings) {
  const b = base[f.metric]
  const delta = b === undefined ? '  new' : f.count > b ? `  +${f.count - b} REGRESSION` : f.count < b ? `  -${b - f.count} better` : '  ='
  if (b !== undefined && f.count > b) regressions++
  console.log('  ' + f.metric.padEnd(W) + String(f.count).padStart(7) + String(b ?? '-').padStart(7) + delta)
}
console.log('')
for (const f of findings) {
  if (!f.worst.length) continue
  console.log(`  ${f.metric}:`)
  for (const w of f.worst) console.log('    ' + w)
  console.log('')
}

if (UPDATE) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true })
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n', 'utf8')
  console.log(`  baseline written → ${rel(BASELINE)}\n`)
  process.exit(0)
}
if (regressions) {
  console.log(`  ${regressions} metric(s) regressed against the baseline.`)
  console.log('  Fix them, or run with --update if the new number is deliberate.\n')
  process.exit(1)
}
console.log('  No regressions.\n')
