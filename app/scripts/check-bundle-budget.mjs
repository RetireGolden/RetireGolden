#!/usr/bin/env node
/**
 * Bundle size budget for the built app.
 *
 * Runs after `vite build` (see the `build` script in package.json) and fails
 * the build when `dist/` grows past the limits below. Rationale, the measured
 * numbers behind each limit, and what to do when one trips are in
 * DOCS/operations/bundle-budget.md.
 *
 * Two things this is deliberately NOT:
 *
 *  - It is not `build.chunkSizeWarningLimit`. That knob only moves the line at
 *    which Vite prints a warning nobody fails on; raising it is how a bundle
 *    gets to 6 MB unnoticed.
 *  - It is not a gzip budget. These are transfer-independent bytes: what the
 *    device downloads on a cold visit, stores in the PWA precache, and parses.
 *
 * Sizes are KiB (1024 bytes), matching workbox's own precache report. Vite's
 * build log prints kB (1000 bytes), so its numbers read ~2.4% larger.
 *
 * Usage:
 *   node scripts/check-bundle-budget.mjs            # after a build
 *   node scripts/check-bundle-budget.mjs --report   # print sizes, never fail
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const distDir = fileURLToPath(new URL('../dist', import.meta.url))
const assetsDir = join(distDir, 'assets')

/**
 * Per-chunk-class limits, in KiB. Each is the size measured when the budget
 * landed plus headroom, so ordinary feature work fits and a structural
 * regression does not.
 *
 * `match` is tested against the emitted file name. A chunk rolldown names
 * differently after a refactor stops matching its entry and falls through to
 * DEFAULT_CHUNK_KIB — which is the intended behavior: a chunk that changed
 * identity should be looked at, not silently inherit a large allowance.
 */
const CHUNK_BUDGETS = [
  {
    label: 'planner Web Worker',
    match: /^planner\.worker-[^/]*\.js$/,
    maxKiB: 1000,
    // The load-bearing one. Bundlers build every worker ENTRY separately, so
    // they cannot share a chunk: a second worker entry means a second copy of
    // the ~740 KiB engine simulation core in dist/ and in the precache. That
    // is exactly how this app came to ship four of them.
    exactCount: 1,
  },
  {
    label: 'engine simulation core (useProjection)',
    match: /^useProjection-[^/]*\.js$/,
    maxKiB: 640,
  },
  {
    label: 'Learning Center registry',
    match: /^learningRegistry-[^/]*\.js$/,
    maxKiB: 600,
  },
  {
    label: 'chart vendor (Recharts)',
    match: /^CartesianChart-[^/]*\.js$/,
    maxKiB: 380,
  },
  {
    label: 'app entry',
    match: /^index-[^/]*\.js$/,
    maxKiB: 300,
    exactCount: 1,
  },
]

/** Every other JS chunk: route chunks, page chunks, shared vendor slices. */
const DEFAULT_CHUNK_KIB = 260
/** All emitted JS together — catches "many new chunks" as well as one fat one. */
const TOTAL_JS_KIB = 4400
/** One stylesheet, and all of them. */
const MAX_CSS_KIB = 64
const TOTAL_CSS_KIB = 80
/**
 * What the service worker precaches, i.e. what an install costs and what an
 * offline visit is guaranteed. The HiGHS wasm (~3 MB) and the Learn
 * illustrations (~5 MB) are runtime-cached instead and are not counted here —
 * see the workbox config in vite.config.ts.
 */
const PRECACHE_KIB = 4500

const kib = (bytes) => bytes / 1024
const fmt = (n) => `${n.toFixed(1)} KiB`

function listAssets() {
  let names
  try {
    names = readdirSync(assetsDir)
  } catch {
    throw new Error(
      `bundle budget: no ${assetsDir}. Run \`pnpm --filter retiregolden-web build\` first (this script runs after vite build).`,
    )
  }
  return names.map((name) => ({ name, bytes: statSync(join(assetsDir, name)).size }))
}

/** Sum the files the generated service worker lists in its precache manifest. */
function precacheKiB() {
  let sw
  try {
    sw = readFileSync(join(distDir, 'sw.js'), 'utf8')
  } catch {
    return null
  }
  const start = sw.indexOf('precacheAndRoute([')
  if (start === -1) return null
  const end = sw.indexOf('])', start)
  const manifest = sw.slice(start, end === -1 ? undefined : end)
  let total = 0
  let entries = 0
  for (const m of manifest.matchAll(/url:"([^"]+)"/g)) {
    entries += 1
    try {
      total += statSync(join(distDir, decodeURIComponent(m[1]))).size
    } catch {
      // A manifest URL with no file on disk is workbox's problem, not the
      // budget's; skip it rather than fail on an unrelated defect.
    }
  }
  return { kiB: kib(total), entries }
}

function check() {
  const assets = listAssets()
  const js = assets.filter((a) => a.name.endsWith('.js'))
  const css = assets.filter((a) => a.name.endsWith('.css'))
  const failures = []
  const rows = []

  const claimed = new Set()
  for (const budget of CHUNK_BUDGETS) {
    const matched = js.filter((a) => budget.match.test(a.name))
    for (const a of matched) claimed.add(a.name)
    if (budget.exactCount !== undefined && matched.length !== budget.exactCount) {
      failures.push(
        `${budget.label}: expected exactly ${budget.exactCount} chunk(s), found ${matched.length}` +
          (matched.length ? ` (${matched.map((a) => a.name).join(', ')})` : ''),
      )
    }
    for (const a of matched) {
      const size = kib(a.bytes)
      rows.push({ label: budget.label, name: a.name, size, max: budget.maxKiB })
      if (size > budget.maxKiB) {
        failures.push(`${budget.label} - ${a.name} is ${fmt(size)}, over its ${fmt(budget.maxKiB)} budget`)
      }
    }
  }

  for (const a of js) {
    if (claimed.has(a.name)) continue
    const size = kib(a.bytes)
    if (size > DEFAULT_CHUNK_KIB) {
      rows.push({ label: 'other JS chunk', name: a.name, size, max: DEFAULT_CHUNK_KIB })
      failures.push(`${a.name} is ${fmt(size)}, over the ${fmt(DEFAULT_CHUNK_KIB)} per-chunk budget`)
    }
  }

  const totalJs = kib(js.reduce((sum, a) => sum + a.bytes, 0))
  rows.push({ label: `all JS (${js.length} chunks)`, name: '', size: totalJs, max: TOTAL_JS_KIB })
  if (totalJs > TOTAL_JS_KIB) {
    failures.push(`all JS is ${fmt(totalJs)}, over the ${fmt(TOTAL_JS_KIB)} total budget`)
  }

  for (const a of css) {
    const size = kib(a.bytes)
    if (size > MAX_CSS_KIB) failures.push(`${a.name} is ${fmt(size)}, over the ${fmt(MAX_CSS_KIB)} stylesheet budget`)
  }
  const totalCss = kib(css.reduce((sum, a) => sum + a.bytes, 0))
  rows.push({ label: `all CSS (${css.length} files)`, name: '', size: totalCss, max: TOTAL_CSS_KIB })
  if (totalCss > TOTAL_CSS_KIB) {
    failures.push(`all CSS is ${fmt(totalCss)}, over the ${fmt(TOTAL_CSS_KIB)} total budget`)
  }

  const precache = precacheKiB()
  if (precache) {
    rows.push({ label: `PWA precache (${precache.entries} entries)`, name: '', size: precache.kiB, max: PRECACHE_KIB })
    if (precache.kiB > PRECACHE_KIB) {
      failures.push(`the PWA precache is ${fmt(precache.kiB)}, over the ${fmt(PRECACHE_KIB)} budget`)
    }
  }

  return { rows, failures }
}

const reportOnly = process.argv.includes('--report')
let result
try {
  result = check()
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error))
  process.exit(1)
}

console.log('bundle budget (KiB, uncompressed):')
for (const row of result.rows) {
  const pct = ((row.size / row.max) * 100).toFixed(0)
  const name = row.name ? `  ${row.name}` : ''
  console.log(`  ${row.size.toFixed(1).padStart(8)} / ${String(row.max).padStart(5)}  ${pct.padStart(4)}%  ${row.label}${name}`)
}

if (result.failures.length > 0 && !reportOnly) {
  console.error('\nbundle budget FAILED:')
  for (const failure of result.failures) console.error(`  - ${failure}`)
  console.error(
    '\nThe budget is a measured limit, not a preference. Split the chunk, or, if the growth is' +
      '\nreally warranted, raise the limit in scripts/check-bundle-budget.mjs in the same commit' +
      '\nand say why. See DOCS/operations/bundle-budget.md.',
  )
  process.exit(1)
}

if (result.failures.length > 0) {
  console.log(`\n${result.failures.length} budget failure(s), not enforced (--report).`)
} else {
  console.log('bundle budget OK')
}
