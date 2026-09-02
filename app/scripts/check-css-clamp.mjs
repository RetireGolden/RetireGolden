#!/usr/bin/env node
/**
 * Post-build check that the plan-card name clamp survived CSS minification.
 *
 * Runs after `vite build` (see the `build` script in package.json) and fails
 * the build when no stylesheet in `dist/assets` carries the complete
 * `.plan-card-name` clamp (#533). It reads what ships, so it is right for
 * whatever CSS transformer, minifier, and browser targets the Vite config
 * resolves to, now or after an upgrade. The rules are in ./cssClamp.mjs
 * with fixture tests in ./cssClamp.test.mjs; the source-sheet pin is
 * planner-ui's designQa.clusterE.test.ts.
 *
 * Usage (needs an existing build):
 *   node scripts/check-css-clamp.mjs
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { clampProblems } from './cssClamp.mjs'

const assetsDir = fileURLToPath(new URL('../dist/assets', import.meta.url))

let names
try {
  names = readdirSync(assetsDir).filter((n) => n.endsWith('.css'))
} catch {
  console.error(`check-css-clamp: no build at ${assetsDir}; run vite build first`)
  process.exit(1)
}
if (names.length === 0) {
  console.error('check-css-clamp: the build has no stylesheet')
  process.exit(1)
}

// The clamp lives in exactly one sheet; report the best candidate's problems.
let best = null
for (const name of names) {
  const problems = clampProblems(readFileSync(join(assetsDir, name), 'utf8'))
  if (best === null || problems.length < best.problems.length) best = { name, problems }
  if (problems.length === 0) break
}
if (best.problems.length > 0) {
  console.error(`check-css-clamp: ${best.name}: ${best.problems.join('; ')}`)
  process.exit(1)
}
console.log(`css clamp OK (${best.name})`)
