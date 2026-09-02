#!/usr/bin/env node
/**
 * Post-build check that the plan-card name clamp survived CSS minification.
 *
 * Runs after `vite build` (see the `build` script in package.json) and fails
 * the build when no stylesheet under `dist/` carries the complete
 * `.plan-card-name` clamp (#533). It reads the emitted stylesheets, so the
 * transformer, minifier, and browser targets the Vite config resolves to
 * are not assumed; what is assumed is that the build emits CSS as `.css`
 * files somewhere under `dist/` (it walks the tree, so `assetsDir` or the
 * hashing scheme may change). If a future config inlines CSS into JS, this
 * fails with "no stylesheet" and must be revisited rather than passing by
 * default. The rules are in ./cssClamp.mjs with fixture tests in
 * ./cssClamp.test.mjs; the source-sheet pin is planner-ui's
 * designQa.clusterE.test.ts.
 *
 * Usage (needs an existing build):
 *   node scripts/check-css-clamp.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { clampProblems, lacksRule } from './cssClamp.mjs'

const distDir = fileURLToPath(new URL('../dist', import.meta.url))

/** Every .css file under dir, depth-first. */
function cssFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...cssFiles(full))
    else if (name.endsWith('.css')) out.push(full)
  }
  return out
}

if (!existsSync(distDir)) {
  console.error(`check-css-clamp: no build at ${distDir}; run vite build first`)
  process.exit(1)
}
let files
try {
  files = cssFiles(distDir)
} catch (err) {
  // The build is there but could not be read (an unreadable entry, a dangling
  // link): say that, not "no build", so the fix is looked for in the right place.
  console.error(`check-css-clamp: could not read the build under ${distDir}: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}
if (files.length === 0) {
  console.error(`check-css-clamp: no .css file under ${distDir}; if the build now inlines CSS, this check needs a new reader`)
  process.exit(1)
}

// The clamp lives in exactly one sheet. A sheet that has the rule but has it
// wrong is the one to blame; a vendor sheet with no rule at all is never
// reported ahead of it, so the diagnostic points at the right file.
const results = files.map((file) => ({ name: relative(distDir, file), problems: clampProblems(readFileSync(file, 'utf8')) }))
const withRule = results.filter((r) => !lacksRule(r.problems))
if (withRule.length === 0) {
  console.error(`check-css-clamp: no clamp rule in any of ${results.length} stylesheet(s): ${results.map((r) => r.name).join(', ')}`)
  process.exit(1)
}
const best = withRule.reduce((a, b) => (b.problems.length < a.problems.length ? b : a))
if (best.problems.length > 0) {
  console.error(`check-css-clamp: ${best.name}: ${best.problems.join('; ')}`)
  process.exit(1)
}
console.log(`css clamp OK (${best.name})`)
