#!/usr/bin/env node
/**
 * One-shot: regenerate coverage then run touched suites + tsc.
 * Safe to delete after green. No git.
 */
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)))
const run = (cmd, args) => {
  console.log('\n>', cmd, args.join(' '))
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run('pnpm', ['--filter', '@retiregolden/engine', 'rules:coverage'])
run('pnpm', [
  '--filter',
  '@retiregolden/engine',
  'exec',
  'vitest',
  'run',
  'src/rules/taxRuleRegistry.conformance.test.ts',
  'src/rules/coverageReport.freshness.test.ts',
  'src/tax/federalTax.test.ts',
])
run('pnpm', ['--filter', '@retiregolden/engine', 'exec', 'tsc', '-p', 'tsconfig.json', '--noEmit'])
console.log('\nAll green.')
