#!/usr/bin/env node
/**
 * Writes DOCS/operations/walkthroughs/<id>.json for every walkthrough in
 * src/planner/examples/walkthroughs/index.ts by running the evidence suite
 * (src/planner/examples/walkthroughEvidence.test.ts) in export mode. The suite
 * needs the planner's Vite resolution for the engine sources, so the export
 * goes through vitest rather than a plain Node import; without the flag the
 * same suite holds the committed files to the computed ones.
 *
 * Usage: pnpm walkthroughs:export   (from packages/planner-ui)
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vitest = resolve(packageRoot, 'node_modules/vitest/vitest.mjs')
const result = spawnSync(
  process.execPath,
  [vitest, 'run', 'src/planner/examples/walkthroughEvidence.test.ts'],
  {
    cwd: packageRoot,
    stdio: 'inherit',
    env: { ...process.env, RG_WALKTHROUGH_EXPORT: '1', NO_COLOR: '1', FORCE_COLOR: '0' },
  },
)
if (result.error) throw result.error
process.exit(result.status ?? 1)
