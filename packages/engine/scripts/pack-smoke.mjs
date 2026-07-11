#!/usr/bin/env node
/**
 * Packs @retiregolden/engine and exercises the resulting tarball the way an
 * external consumer (the Pro desktop app) will: install it into a scratch
 * project and import the published surface from plain Node ESM — no Vite
 * alias, no workspace symlink, no browser globals, no network.
 *
 * The dev loop never touches dist/ (Vite aliases the package to src/), so
 * this is the one check that proves the exports map and the emitted .js/.d.ts
 * actually resolve. Run from anywhere: `node packages/engine/scripts/pack-smoke.mjs`.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shell = process.platform === 'win32' // npm is npm.cmd on Windows

const smokeScript = `
import assert from 'node:assert/strict'

// Prove "no ambient network / no browser globals": any engine code path that
// reached for these would now throw.
delete globalThis.fetch
assert.equal(typeof globalThis.fetch, 'undefined')
assert.equal(typeof globalThis.window, 'undefined')
assert.equal(typeof globalThis.document, 'undefined')
assert.equal(typeof globalThis.localStorage, 'undefined')

// Representative subpaths: root entry, directory-index exports, a deep
// module, and the testing fixtures.
const { simulatePlan, planSchema, CURRENT_PLAN_SCHEMA_VERSION } = await import('@retiregolden/engine')
const { packForYear } = await import('@retiregolden/engine/params')
const simulate = await import('@retiregolden/engine/projection/simulate')
const { singlePersonPlan, cashAccount, productionTaxCalculator, runPlan } = await import(
  '@retiregolden/engine/testing/planFixtures'
)

assert.equal(typeof simulatePlan, 'function')
assert.equal(simulate.simulatePlan, simulatePlan)
assert.equal(CURRENT_PLAN_SCHEMA_VERSION, 1)
assert.ok(packForYear(2026) && typeof packForYear(2026) === 'object')

const plan = singlePersonPlan({ planningAge: 90 })
plan.accounts = [cashAccount('cash', 500_000)]
plan.expenses.baseAnnual = 40_000
const result = runPlan(planSchema.parse(plan), productionTaxCalculator(), 2026)

assert.ok(Array.isArray(result.years) && result.years.length > 10, 'projection produced a multi-year ledger')
assert.equal(result.years[0].year, 2026)
assert.ok(Number.isFinite(result.endingNetWorth), 'ending net worth is a number')

console.log(
  'pack smoke OK: projected ' + result.years.length + ' years (' + result.years[0].year + '-' +
    result.years.at(-1).year + ') from the packed artifact in plain Node ESM',
)
`

const work = mkdtempSync(join(tmpdir(), 'engine-pack-smoke-'))
try {
  const packOutput = execFileSync('npm', ['pack', '--pack-destination', work], {
    cwd: pkgDir,
    encoding: 'utf8',
    shell,
  })
  const tarball = packOutput.trim().split('\n').pop().trim()

  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'engine-pack-smoke', private: true, type: 'module' }))
  execFileSync('npm', ['install', '--no-audit', '--no-fund', join(work, tarball)], {
    cwd: work,
    stdio: 'inherit',
    shell,
  })

  writeFileSync(join(work, 'smoke.mjs'), smokeScript)
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: work, stdio: 'inherit' })
} finally {
  try {
    rmSync(work, { recursive: true, force: true })
  } catch {
    // best-effort cleanup; a locked temp dir must not fail the check
  }
}
