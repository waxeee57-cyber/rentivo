/**
 * Run every end-to-end suite and report one line each.
 *
 *   node scripts/e2e/all.mjs              sequential
 *   node scripts/e2e/all.mjs --parallel   all at once
 *   node scripts/e2e/all.mjs --verbose    stream each suite's output as it runs
 *
 * Parallel is not here to be fast. It is the proof: every suite owns one listing,
 * one date window and (where it mutates owner or account state) one operator and
 * one account, so running them together must produce exactly the numbers running
 * them one at a time produces. If parallel and sequential disagree, the suites
 * are sharing something and the disagreement is the bug — not whichever suite
 * happened to go red.
 *
 * Exit code is 0 only when every suite exits 0 and reports zero failed steps.
 * Sequential runs stream their output; parallel runs are captured per suite and
 * the failing ones are replayed in full at the end, because fifteen interleaved
 * writers produce a log nobody can read.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const PARALLEL = argv.includes('--parallel')
const VERBOSE = argv.includes('--verbose')
const only = argv.filter(a => !a.startsWith('--'))

/**
 * Ordered so that a sequential run reads in fixture-window order, which makes a
 * stray booking easy to attribute. gdpr runs its `build` phase: `erase` deletes
 * the subject account and needs two privileged SQL steps in the middle, so it is
 * not something a suite runner can drive on its own.
 */
const SUITES = [
  { name: 'money-path', file: 'money-path.mjs' },
  { name: 'contract', file: 'contract.mjs' },
  { name: 'damage-deposit', file: 'damage-deposit.mjs' },
  { name: 'messaging', file: 'messaging.mjs' },
  { name: 'gdpr', file: 'gdpr.mjs', args: ['build'] },
  { name: 'identity-gate', file: 'identity-gate.mjs' },
  { name: 'admin', file: 'admin.mjs' },
  { name: 'cancellation-matrix', file: 'cancellation-matrix.mjs', needsShift: true },
  { name: 'host-money-path', file: 'host-money-path.mjs' },
  { name: 'operator-onboarding', file: 'operator-onboarding.mjs' },
]

/**
 * The one step no test process can perform for itself.
 *
 * cancellation-matrix has to put bookings a few HOURS from their start date to
 * exercise the refund bands, and `start_date` is not in the UPDATE column grant
 * for `authenticated` — which that suite also asserts. There is no service-role
 * key in .env, so the statement is run out of band while the suite waits.
 */
const SHIFT_SQL = [
  'update public.rentivo_bookings b',
  "set start_date = current_date + (substring(b.notes from 'shift=([0-9]+)'))::int,",
  "    end_date   = current_date + (substring(b.notes from 'shift=([0-9]+)'))::int + 1",
  "where b.notes like 'E2E-CANCEL-MATRIX:%shift=%'",
  "  and b.status <> 'cancelled'",
  "  and b.created_at > now() - interval '3 hours'",
  '  and b.start_date > current_date + 200;',
].join('\n')

// The suites read `.env` and app sources with paths relative to the working
// directory, so running from anywhere else fails in a way that looks like a
// missing Stripe key rather than a wrong cwd.
if (!existsSync(resolve('.env')) || !existsSync(resolve('scripts/e2e/_lib.mjs'))) {
  console.error('Run this from the repo root:  node scripts/e2e/all.mjs')
  process.exit(2)
}

const chosen = only.length ? SUITES.filter(s => only.includes(s.name)) : SUITES
if (only.length && chosen.length !== only.length) {
  const known = SUITES.map(s => s.name).join(', ')
  console.error(`Unknown suite name. Known suites: ${known}`)
  process.exit(2)
}

/** Run one suite to completion, capturing everything it wrote. */
function runSuite(suite) {
  return new Promise(resolvePromise => {
    const started = Date.now()
    const child = spawn(process.execPath, [join(HERE, suite.file), ...(suite.args ?? [])], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    const collect = chunk => {
      const text = chunk.toString()
      out += text
      // Sequential runs stream, so a suite that stalls (cancellation-matrix
      // waiting on the shift) says so while it is happening rather than after.
      if (VERBOSE || !PARALLEL) process.stdout.write(text)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', err => {
      out += `\nfailed to spawn: ${err.message}\n`
      resolvePromise(finalise(suite, out, 127, started))
    })
    child.on('close', code => resolvePromise(finalise(suite, out, code ?? 0, started)))
  })
}

/**
 * Turn a suite's output into numbers.
 *
 * The counters come from the harness's own closing line, so this runner never
 * decides what passed — it only reads what the suite said. A suite that dies
 * before printing that line reports as `-` with a non-zero exit, which is a
 * different failure from "ran and had failing steps" and must not look the same.
 */
function finalise(suite, out, code, started) {
  const matches = [...out.matchAll(/=== (\d+) passed, (\d+) failed ===/g)]
  const last = matches[matches.length - 1]
  const passed = last ? Number(last[1]) : null
  const failed = last ? Number(last[2]) : null
  const failureLines = [...out.matchAll(/^ {2}- (.+)$/gm)].map(m => m[1])
  return {
    name: suite.name,
    passed,
    failed,
    code,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    ok: code === 0 && failed === 0,
    failureLines,
    out,
  }
}

const pad = (v, w) => String(v ?? '').padEnd(w)
const padLeft = (v, w) => String(v ?? '').padStart(w)

console.log(`\n=== e2e: ${chosen.length} suite(s), ${PARALLEL ? 'PARALLEL' : 'sequential'} ===`)
if (chosen.some(s => s.needsShift)) {
  console.log('\n  cancellation-matrix will pause and wait for this statement (service role):\n')
  console.log(SHIFT_SQL.split('\n').map(l => '    ' + l).join('\n'))
  console.log('\n  It is safe to run repeatedly, and it only ever touches rows this suite')
  console.log('  created in the last three hours.\n')
}

const wallStart = Date.now()
let results
if (PARALLEL) {
  results = await Promise.all(chosen.map(runSuite))
} else {
  results = []
  for (const suite of chosen) results.push(await runSuite(suite))
}
const wallSeconds = Math.round((Date.now() - wallStart) / 100) / 10

// ── The table ───────────────────────────────────────────────────────────────

console.log(`\n=== summary (${PARALLEL ? 'parallel' : 'sequential'}) ===`)
console.log(`${pad('suite', 22)}${padLeft('passed', 8)}${padLeft('failed', 8)}${padLeft('exit', 6)}${padLeft('secs', 8)}  result`)
console.log(`${'-'.repeat(21)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(5)} ${'-'.repeat(7)}  ------`)
for (const r of results) {
  console.log(
    pad(r.name, 22) + padLeft(r.passed ?? '-', 8) + padLeft(r.failed ?? '-', 8)
    + padLeft(r.code, 6) + padLeft(r.seconds, 8) + '  ' + (r.ok ? 'PASS' : 'FAIL'),
  )
}

const totalPassed = results.reduce((n, r) => n + (r.passed ?? 0), 0)
const totalFailed = results.reduce((n, r) => n + (r.failed ?? 0), 0)
const badSuites = results.filter(r => !r.ok)
console.log(`${'-'.repeat(21)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(5)} ${'-'.repeat(7)}  ------`)
console.log(
  pad('TOTAL', 22) + padLeft(totalPassed, 8) + padLeft(totalFailed, 8)
  + padLeft(badSuites.length ? 1 : 0, 6) + padLeft(wallSeconds, 8)
  + '  ' + (badSuites.length ? `${badSuites.length} SUITE(S) FAILED` : 'ALL GREEN'),
)

if (badSuites.length) {
  console.log('\n=== failing steps ===')
  for (const r of badSuites) {
    console.log(`\n  ${r.name} (exit ${r.code}):`)
    if (r.failureLines.length) {
      for (const line of r.failureLines) console.log(`    - ${line}`)
    } else {
      console.log('    - no failing-step list; the suite died before it could report')
    }
  }
  // In parallel mode nothing was streamed, so the only way to diagnose is to
  // replay the failing suites in full. Interleaving fifteen writers would have
  // produced a log nobody can read, which is why it was captured instead.
  if (PARALLEL && !VERBOSE) {
    for (const r of badSuites) {
      console.log(`\n=== full output: ${r.name} ===`)
      process.stdout.write(r.out.endsWith('\n') ? r.out : r.out + '\n')
    }
  }
}

process.exit(badSuites.length ? 1 : 0)
