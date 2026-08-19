/**
 * KPI bar overflow containment.
 *
 * Lifetime Tax's subtext ("nominal $ · federal + state + penalties") is
 * longer than a 10rem auto-fit column. `white-space: nowrap` without
 * overflow containment painted that line into Roth Converted, so the
 * next cell read `penaltiesending Roth $0`.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const css: string = readFileSync(fileURLToPath(new URL('./planner.css', import.meta.url)), 'utf8')

function ruleBody(selector: string): string {
  const escaped = selector.replace('.', '\\.')
  const re = new RegExp(`(?:^|[\\s,}])${escaped}\\s*\\{`)
  const match = re.exec(css)
  expect(match, `rule ${selector} present in planner.css`).not.toBeNull()
  const open = css.indexOf('{', match!.index)
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
  it('each .kpi clips overflow so children cannot paint into the next cell', () => {
    const body = ruleBody('.kpi')
    expect(body).toMatch(/min-width:\s*0/)
    expect(body).toMatch(/overflow:\s*hidden/)
  })

  it('kpi-sub wraps instead of nowrap so Lifetime Tax copy stays in its cell', () => {
    const body = ruleBody('.kpi-sub')
    expect(body).not.toMatch(/white-space:\s*nowrap/)
    expect(body).toMatch(/overflow-wrap:\s*break-word/)
    expect(body).toMatch(/min-width:\s*0/)
  })
})
