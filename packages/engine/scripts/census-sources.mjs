import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/**
 * Read a source file named the way the output census names it: relative to
 * `packages/` (for example `planner-ui/src/planner/ResultsPage.tsx`). Returns
 * undefined when the file does not exist so the conformance test can report
 * the census entry rather than throw.
 */
export function readPackageSource(censusPath) {
  const file = join(repoRoot, 'packages', censusPath)
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}
