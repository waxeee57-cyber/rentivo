#!/usr/bin/env node
/**
 * Emits public/legal/{privacy,terms,cookies}/index.html from constants/legal.data.mjs.
 *
 * WHY
 * The in-app screens and the hosted pages used to be written independently and
 * drifted until they named different data controllers. Now there is one literal
 * and two renderers: components/legal/LegalDocumentScreen.tsx for the app, and
 * this script for the web. Editing the text in one place is the whole point —
 * NEVER hand-edit anything under public/legal/.
 *
 * The visual chrome (CSS, header, brand mark, language switcher) is not copied
 * into this file: it is EXTRACTED at build time from public/privacy/index.html,
 * which stays the design reference. One stylesheet, three documents.
 *
 *   node scripts/build-legal.mjs
 *
 * Idempotent: same inputs, byte-identical outputs. Exits non-zero if the three
 * languages have drifted out of structural parity, or if the operator's real
 * legal identity has not been filled in yet (warning only — see below).
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { LEGAL, LEGAL_ENTITY } from '../constants/legal.data.mjs'

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')
const CHROME_SRC = path.join(ROOT, 'public', 'privacy', 'index.html')
const OUT_DIR = path.join(ROOT, 'public', 'legal')
const LANGS = ['en', 'es', 'hu']
const DOCS = ['privacy', 'terms', 'cookies']

const die = msg => { console.error(`\n  build-legal: ${msg}\n`); process.exit(1) }

// ── 1. Structural parity ────────────────────────────────────────────────────
// en/es/hu must be the SAME DOCUMENT in three languages, not three documents.
// A missing section in one locale is a user in that locale who was never told
// something the other two were.
function assertParity() {
  const problems = []
  for (const lang of LANGS) {
    if (!LEGAL[lang]) { problems.push(`missing language: ${lang}`); continue }
    for (const doc of DOCS) if (!LEGAL[lang][doc]) problems.push(`missing doc: ${lang}.${doc}`)
    for (const doc of Object.keys(LEGAL[lang])) {
      if (!DOCS.includes(doc)) problems.push(`unexpected doc: ${lang}.${doc}`)
    }
  }
  if (problems.length) die(problems.join('\n              '))

  for (const doc of DOCS) {
    const reference = LEGAL.en[doc].sections.map(s => s.id)
    for (const lang of LANGS.slice(1)) {
      const ids = LEGAL[lang][doc].sections.map(s => s.id)
      if (ids.length !== reference.length) {
        problems.push(`${doc}: en has ${reference.length} sections, ${lang} has ${ids.length}`)
        continue
      }
      ids.forEach((id, i) => {
        if (id !== reference[i]) problems.push(`${doc}: section ${i + 1} is "${reference[i]}" in en but "${id}" in ${lang}`)
      })
    }
    for (const lang of LANGS) {
      LEGAL[lang][doc].sections.forEach(s => {
        if (!s.title || !Array.isArray(s.body) || s.body.length === 0) {
          problems.push(`${doc}.${lang}.${s.id}: empty title or body`)
        }
      })
    }
  }
  if (problems.length) die(`languages have drifted out of parity:\n              ${problems.join('\n              ')}`)
}

// ── 2. Platform fee ─────────────────────────────────────────────────────────
// Parsed out of constants/config.ts so the default lives in exactly one place.
// If the parse fails we stop rather than silently publishing a contract that
// quotes a fee the checkout does not charge.
function platformFeeLabel() {
  const configSrc = fs.readFileSync(path.join(ROOT, 'constants', 'config.ts'), 'utf8')
  const m = configSrc.match(/platformCut:\s*parseFloat\(\s*process\.env\.EXPO_PUBLIC_PLATFORM_CUT\s*\?\?\s*'([^']+)'\s*\)/)
  if (!m) die('could not read the platformCut default out of constants/config.ts')
  const cut = parseFloat(process.env.EXPO_PUBLIC_PLATFORM_CUT ?? m[1])
  if (!Number.isFinite(cut)) die('platformCut is not a number')
  const pct = cut * 100
  return `${pct.toFixed(Number.isInteger(pct) ? 0 : 1)}%`
}

// ── 3. Chrome extraction ────────────────────────────────────────────────────
function readChrome() {
  if (!fs.existsSync(CHROME_SRC)) die(`chrome source not found: ${path.relative(ROOT, CHROME_SRC)}`)
  const src = fs.readFileSync(CHROME_SRC, 'utf8')
  const style = src.match(/<style>[\s\S]*?<\/style>/)
  const header = src.match(/<header>[\s\S]*?<\/header>/)
  const fonts = src.match(/<link rel="preconnect"[\s\S]*?rel="stylesheet">/)
  if (!style) die('no <style> block in the chrome source')
  if (!header) die('no <header> block in the chrome source (brand + language switcher)')
  if (!fonts) die('no font <link> block in the chrome source')
  return { style: style[0], header: header[0], fonts: fonts[0] }
}

// ── 4. Text → HTML ──────────────────────────────────────────────────────────
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const isPlaceholder = v => v.trim().startsWith('[')
const entitySpan = v => (isPlaceholder(v) ? `<span class="todo">${esc(v)}</span>` : esc(v))

// The "before publishing" banner talks about *highlighted fields*, so it only
// belongs on a document that actually has some. Terms and Cookies name no
// controller, so they get no banner and no false alarm.
const ENTITY_TOKEN = /\{\{(?:LEGAL_NAME|SEAT_ADDRESS|REG_NUMBER|TAX_NUMBER)\}\}/
const docNamesTheController = docId =>
  LANGS.some(l => ENTITY_TOKEN.test(JSON.stringify(LEGAL[l][docId])))

function inline(text, fee) {
  let out = esc(text)
  out = out
    .replace(/\{\{LEGAL_NAME\}\}/g, entitySpan(LEGAL_ENTITY.legalName))
    .replace(/\{\{SEAT_ADDRESS\}\}/g, entitySpan(LEGAL_ENTITY.seatAddress))
    .replace(/\{\{REG_NUMBER\}\}/g, entitySpan(LEGAL_ENTITY.regNumber))
    .replace(/\{\{TAX_NUMBER\}\}/g, entitySpan(LEGAL_ENTITY.taxNumber))
    .replace(/\{\{PLATFORM_FEE\}\}/g, esc(fee))
  // Linkify AFTER escaping, so no author-supplied markup can slip through.
  out = out.replace(/\bhttps?:\/\/[^\s<>(),;]+/g, u => `<a href="${u}" rel="noopener">${u}</a>`)
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, e => `<a href="mailto:${e}">${e}</a>`)
  return out
}

const BULLET = '· '

/** Paragraphs, with runs of "· " lines collapsed into a single <ul>. */
function renderBody(body, fee) {
  const out = []
  let bullets = []
  const flush = () => {
    if (!bullets.length) return
    out.push(`  <ul>\n${bullets.map(b => `    <li>${b}</li>`).join('\n')}\n  </ul>`)
    bullets = []
  }
  for (const paragraph of body) {
    if (paragraph.startsWith(BULLET)) bullets.push(inline(paragraph.slice(BULLET.length), fee))
    else { flush(); out.push(`  <p>${inline(paragraph, fee)}</p>`) }
  }
  flush()
  return out.join('\n')
}

// Chrome copy the documents themselves do not carry. Kept here because it is
// page furniture, not legal text.
const UI = {
  en: {
    skip: 'Skip to content', contents: 'Contents', legal: 'Rentivo legal',
    privacy: 'Privacy Policy', terms: 'Terms of Service', cookies: 'Cookies & Storage',
    meta: (u, v) => `Last updated: ${u} · Version ${v}`,
    also: (a, b) => `Also available in ${a} and ${b}.`,
    draft: '<strong>Before publishing:</strong> the highlighted fields must be completed with the operator’s real registered identity. A document that names the wrong controller — or none — is not merely incomplete, it is invalid. This draft has not been reviewed by a lawyer.',
  },
  es: {
    skip: 'Saltar al contenido', contents: 'Contenido', legal: 'Legal de Rentivo',
    privacy: 'Política de Privacidad', terms: 'Términos del Servicio', cookies: 'Cookies y almacenamiento',
    meta: (u, v) => `Última actualización: ${u} · Versión ${v}`,
    also: (a, b) => `Disponible también en ${a} y ${b}.`,
    draft: '<strong>Antes de publicar:</strong> los campos resaltados deben completarse con la identidad registrada real del operador. Un documento que nombra al responsable equivocado — o a ninguno — no es solo incompleto, es inválido. Este borrador no ha sido revisado por un abogado.',
  },
  hu: {
    skip: 'Ugrás a tartalomra', contents: 'Tartalom', legal: 'Rentivo jogi dokumentumok',
    privacy: 'Adatvédelmi tájékoztató', terms: 'ÁSZF', cookies: 'Sütik és tárolás',
    meta: (u, v) => `Utolsó frissítés: ${u} · ${v} verzió`,
    also: (a, b) => `Elérhető ${a} és ${b} is.`,
    draft: '<strong>Publikálás előtt:</strong> a kiemelt mezőket az üzemeltető valós, nyilvántartott adataival kell kitölteni. Az a dokumentum, amely rossz adatkezelőt nevez meg — vagy egyet sem —, nem csupán hiányos, hanem érvénytelen. Ezt a tervezetet ügyvéd nem vizsgálta át.',
  },
}

const LANG_NAMES = { en: 'English', es: 'Español', hu: 'Magyar' }

// ── 5. Page assembly ────────────────────────────────────────────────────────
function renderLangBlock(lang, docId, fee, needsDraftNotice) {
  const doc = LEGAL[lang][docId]
  const ui = UI[lang]
  const on = lang === 'en' ? ' class="on"' : ''
  const toc = doc.sections
    .map((s, i) => `      <li><a href="#${lang}-${i + 1}">${esc(s.title)}</a></li>`)
    .join('\n')
  const sections = doc.sections
    .map((s, i) => `  <h2 id="${lang}-${i + 1}">${i + 1}. ${esc(s.title)}</h2>\n${renderBody(s.body, fee)}`)
    .join('\n\n')
  const draft = needsDraftNotice ? `  <div class="draft">${ui.draft}</div>\n` : ''
  return `<div data-lang="${lang}"${on}>
  <h1>${esc(doc.title)}</h1>
  <p class="meta">${esc(ui.meta(doc.updated, doc.version))}</p>
  <p class="lede">${inline(doc.intro, fee)}</p>
${draft}
  <nav class="toc" aria-label="${esc(ui.contents)}">
    <h2>${esc(ui.contents)}</h2>
    <ol>
${toc}
    </ol>
  </nav>

${sections}
</div>`
}

function renderFooter(docId) {
  const rows = LANGS.map(lang => {
    const ui = UI[lang]
    const on = lang === 'en' ? ' class="on"' : ''
    const others = LANGS.filter(l => l !== lang).map(l => `<a href="?lang=${l}">${LANG_NAMES[l]}</a>`)
    const links = DOCS.map(d =>
      d === docId ? `<strong>${esc(ui[d])}</strong>` : `<a href="../${d}/?lang=${lang}">${esc(ui[d])}</a>`)
    return `    <p data-lang="${lang}"${on}>${esc(ui.legal)}: ${links.join(' · ')}</p>\n`
      + `    <p data-lang="${lang}"${on}>${ui.also(others[0], others[1])}</p>`
  }).join('\n')
  return `<footer>
  <div class="wrap">
    <p>© 2026 Rentivo</p>
${rows}
  </div>
</footer>`
}

function renderPage(docId, chrome, fee, needsDraftNotice) {
  const titles = Object.fromEntries(LANGS.map(l => [l, `${LEGAL[l][docId].title} — Rentivo`]))
  const blocks = LANGS.map(l => renderLangBlock(l, docId, fee, needsDraftNotice)).join('\n\n')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titles.en)}</title>
<meta name="description" content="${esc(LEGAL.en[docId].intro.replace(/\{\{\w+\}\}/g, '').slice(0, 155))}">
<meta name="robots" content="index, follow">
<!-- GENERATED by scripts/build-legal.mjs from constants/legal.data.mjs. Do not edit. -->
${chrome.fonts}
${chrome.style}
</head>
<body>
<a class="skip" href="#doc">${esc(UI.en.skip)}</a>

${chrome.header}

<main id="doc" class="wrap">

${blocks}

</main>

${renderFooter(docId)}

<script>
(function(){
  var LANGS = ${JSON.stringify(LANGS)};
  var TITLES = ${JSON.stringify(titles)};
  function pick(){
    var q = new URLSearchParams(location.search).get('lang');
    var h = (location.hash || '').replace('#','');
    var c = q || h;
    if (LANGS.indexOf(c) > -1) return c;
    var nav = (navigator.language || 'en').slice(0,2).toLowerCase();
    return LANGS.indexOf(nav) > -1 ? nav : 'en';
  }
  function apply(lang){
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang]').forEach(function(el){
      el.classList.toggle('on', el.getAttribute('data-lang') === lang);
    });
    document.querySelectorAll('.langs button').forEach(function(b){
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set') === lang));
    });
    document.title = TITLES[lang];
  }
  document.querySelectorAll('.langs button').forEach(function(b){
    b.addEventListener('click', function(){
      var l = b.getAttribute('data-set');
      apply(l);
      history.replaceState(null, '', '?lang=' + l);
    });
  });
  apply(pick());
})();
</script>
</body>
</html>
`
}

// ── 6. Run ──────────────────────────────────────────────────────────────────
assertParity()
const chrome = readChrome()
const fee = platformFeeLabel()
const unfilled = Object.entries(LEGAL_ENTITY).filter(([, v]) => isPlaceholder(v)).map(([k]) => k)

console.log('\n  BUILD LEGAL\n')
console.log(`  platform fee   ${fee}  (from constants/config.ts)`)
console.log(`  chrome         ${path.relative(ROOT, CHROME_SRC).replace(/\\/g, '/')}`)

for (const docId of DOCS) {
  const dir = path.join(OUT_DIR, docId)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'index.html')
  const html = renderPage(docId, chrome, fee, unfilled.length > 0 && docNamesTheController(docId))
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  fs.writeFileSync(file, html, 'utf8')
  const counts = LANGS.map(l => `${l}:${LEGAL[l][docId].sections.length}`).join(' ')
  const state = before === null ? 'created' : before === html ? 'unchanged' : 'updated'
  console.log(`  ${docId.padEnd(9)} ${String(Buffer.byteLength(html, 'utf8')).padStart(7)} bytes  ${counts}  ${state}`)
}

if (unfilled.length) {
  console.log(`\n  WARNING: LEGAL_ENTITY still has placeholders (${unfilled.join(', ')}).`)
  console.log('  Documents that name the controller carry a "before publishing" banner')
  console.log('  until they are filled in. Do not publish in this state.')
}
console.log('')
