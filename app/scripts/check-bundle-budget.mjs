#!/usr/bin/env node
/**
 * Bundle size budget for the built app — the CLI.
 *
 * Runs after `vite build` (see the `build` script in package.json) and fails
 * the build when `dist/` grows past the limits in ./bundleBudget.mjs, which
 * holds the limits, the parsers, and the evaluation as pure functions with
 * fixture tests in ./bundleBudget.test.mjs. Everything here is filesystem
 * reading.
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
 * Usage (both need an existing build — they weigh `dist/`, they do not make it):
 *   node scripts/check-bundle-budget.mjs            # after a build; fails when over
 *   node scripts/check-bundle-budget.mjs --report   # print sizes, never fail
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { evaluateBudget, parseLandingScripts, parsePrecacheUrls } from './bundleBudget.mjs'

const distDir = fileURLToPath(new URL('../dist', import.meta.url))
const assetsDir = join(distDir, 'assets')

function listAssets() {
  let names
  try {
    names = readdirSync(assetsDir)
  } catch {
    throw new Error(
      `bundle budget: no ${assetsDir}. Run \`pnpm --filter retiregolden-web build\` first — this weighs a build, it does not make one.`,
    )
  }
  return names.map((name) => ({ name, bytes: statSync(join(assetsDir, name)).size }))
}

/** Size of a file under dist/, or null when it is not there. */
function sizeOf(...segments) {
  try {
    return statSync(join(distDir, ...segments)).size
  } catch {
    return null
  }
}

function readLanding() {
  let html
  try {
    html = readFileSync(join(distDir, 'index.html'), 'utf8')
  } catch {
    return null
  }
  const parsed = parseLandingScripts(html)
  if (!parsed) return null
  const sizes = {}
  for (const name of parsed.names) sizes[name] = sizeOf('assets', name)
  return { ...parsed, sizes }
}

function readPrecache() {
  let sw
  try {
    sw = readFileSync(join(distDir, 'sw.js'), 'utf8')
  } catch {
    return null
  }
  const urls = parsePrecacheUrls(sw)
  if (!urls) return null
  const sizes = {}
  // Workbox emits build-relative URLs; tolerate a leading slash either way.
  for (const url of urls) sizes[url] = sizeOf(url.replace(/^\//, ''))
  return { urls, sizes }
}

const reportOnly = process.argv.includes('--report')
let result
try {
  result = evaluateBudget({ assets: listAssets(), landing: readLanding(), precache: readPrecache() })
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
      '\nreally warranted, raise the limit in scripts/bundleBudget.mjs in the same commit' +
      '\nand say why. See DOCS/operations/bundle-budget.md.',
  )
  process.exit(1)
}

if (result.failures.length > 0) {
  console.log(`\n${result.failures.length} budget failure(s), not enforced (--report):`)
  for (const failure of result.failures) console.log(`  - ${failure}`)
} else {
  console.log('bundle budget OK')
}
