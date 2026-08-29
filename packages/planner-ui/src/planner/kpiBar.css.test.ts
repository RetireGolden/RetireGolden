/**
 * KPI bar overflow containment.
 *
 * An earlier Lifetime Tax sub-line ("nominal $ · federal + state + penalties")
 * was longer than a 10rem auto-fit column. `white-space: nowrap` without
 * overflow containment painted that line into Roth Converted, so the
 * next cell read `penaltiesending Roth $0`. Containment lives on
 * `.kpi-sub` so focus rings and large headline values stay visible.
 * #318 shortened the workspace Lifetime tax copy. This file still guards
 * the #287 containment, not that copy.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const css: string = readFileSync(fileURLToPath(new URL('./planner.css', import.meta.url)), 'utf8')

function ruleBodyAt(start: number, selector: string): string {
  expect(start, `rule ${selector} present in planner.css`).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  let depth = 1
  let i = open + 1
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++
    if (css[i] === '}') depth--
    i++
  }
  return css.slice(open + 1, i - 1)
}

describe('KPI bar cells contain their subtext', () => {
  it('each .kpi can shrink in the auto-fit grid without clipping values or focus rings', () => {
    const body = ruleBodyAt(css.search(/(?:^|[\s,}])\.kpi\s*\{/), '.kpi')
    expect(body).toMatch(/min-width:\s*0/)
    expect(body).not.toMatch(/overflow:\s*hidden/)
  })

  it('kpi-sub wraps and stays in its cell so Lifetime Tax copy cannot paint into the next KPI', () => {
    const body = ruleBodyAt(css.search(/(?:^|[\s,}])\.kpi-sub\s*\{/), '.kpi-sub')
    expect(body).not.toMatch(/white-space:\s*nowrap/)
    expect(body).toMatch(/overflow-wrap:\s*break-word/)
    expect(body).toMatch(/min-width:\s*0/)
    expect(body).toMatch(/overflow:\s*hidden/)
  })
})
