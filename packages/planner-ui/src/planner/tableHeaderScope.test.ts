/**
 * Every data-table header in the planner declares what it heads.
 *
 * Forty `<th>` elements carried no `scope` against 155 that did, concentrated
 * in the comparison tables where header association matters most: the Social
 * Security claim-age sweeps, the Monte Carlo annuitization and window tables,
 * the retirement-action promotion panels, the explain panels. A screen reader
 * in table-navigation mode announces a cell with the headers it can associate,
 * and an implicit association is what the browser guesses when the markup does
 * not say.
 *
 * A sweep rather than a per-page assertion: the gap was uniform, and the point
 * is that it stays at zero as pages are added.
 */
import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readdirSync, readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

/** Every non-test `.tsx` under `planner/`, the tree that owns the app's tables. */
function componentFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true }) as Array<{ name: string; isDirectory: () => boolean }>) {
      const full = `${at}/${entry.name}`
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) out.push(full)
    }
  }
  walk(dir)
  return out
}

/**
 * `<th` openings with no `scope=` before the tag closes. `(?![a-z])` keeps
 * `<thead>` out; the second lookahead only scans as far as the tag's own `>`.
 */
const UNSCOPED = /<th(?![a-z])(?![^>]*\bscope=)/g

describe('data-table headers', () => {
  const root = fileURLToPath(new URL('.', import.meta.url))
  const files = componentFiles(root)

  it('reads the planner tree, so the sweep below is not vacuous', () => {
    expect(files.length).toBeGreaterThan(40)
    const withHeaders = files.filter((f) => readFileSync(f, 'utf8').includes('<th'))
    expect(withHeaders.length).toBeGreaterThan(15)
  })

  it('all declare a scope', () => {
    const offenders: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const count = source.match(UNSCOPED)?.length ?? 0
      if (count > 0) offenders.push(`${file.slice(root.length)} (${count})`)
    }
    expect(offenders).toEqual([])
  })

  it('gives the claim-age heatmap’s leading body cell a row scope, not a column one', () => {
    // The one header the sweep above could have mislabelled: it sits inside a
    // `<tbody>` row and heads that row, not the column beneath it.
    const heatmap = readFileSync(`${root}SsAnalysisPage.tsx`, 'utf8')
    expect(heatmap).toContain('<th scope="row">{ra}</th>')
  })
})
