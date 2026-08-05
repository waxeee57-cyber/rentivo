/**
 * One-shot codemod: borderGold -> borderAccent, Shadow.gold -> Shadow.accent.
 *
 * Both names described pigment rather than role. `borderGold` had already
 * drifted to a coral value in the light palette, so the name was actively
 * lying about half the time, and `Shadow.gold` was painting a gold glow under
 * bubbles that fill with C.primary.
 *
 * Deliberately NOT renamed: the `gold` palette token itself. That one is a
 * loyalty rung and a top operator tier - a rank name, like an airline's, not
 * brand chrome. See the scope note on the token in constants/colors.ts.
 *
 * Run: node scripts/rename-brand-tokens.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = process.cwd()
const DRY = process.argv.includes('--dry')
const SKIP = /node_modules|\.git|\.expo|[\\/]android[\\/]|[\\/]ios[\\/]|[\\/]dist[\\/]/
const EXT = new Set(['.ts', '.tsx'])

// Word-boundary anchored so `borderGoldish` or a substring match cannot be hit.
const RULES = [
  [/\bborderGold\b/g, 'borderAccent'],
  [/\bShadow\.gold\b/g, 'Shadow.accent'],
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (SKIP.test(p)) continue
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (EXT.has(extname(p))) out.push(p)
  }
  return out
}

let files = 0
let hits = 0
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8')
  let out = src
  for (const [re, to] of RULES) {
    const found = out.match(re)
    if (found) hits += found.length
    out = out.replace(re, to)
  }
  if (out !== src) {
    files += 1
    if (!DRY) writeFileSync(file, out)
    console.log(`${DRY ? 'would patch' : 'patched'}  ${file.slice(ROOT.length + 1)}`)
  }
}
console.log(`\n${hits} reference(s) across ${files} file(s)${DRY ? ' (dry run)' : ''}`)
