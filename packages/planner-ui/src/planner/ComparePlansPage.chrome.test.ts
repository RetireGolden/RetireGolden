/**
 * Compare-plans table chrome (#384). Pin the CSS, not a jsdom visual:
 * plan-name headers keep user casing, A/B columns share width, and the
 * year-table uppercase/nowrap rule stays in place for other tables.
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

describe('Compare-plans table chrome (#384)', () => {
  it('year-table headers elsewhere stay uppercase and nowrap', () => {
    const table = ruleBodyAt(css.search(/(?:^|[\s}])\.year-table\s*\{/), '.year-table')
    expect(table).toMatch(/white-space:\s*nowrap/)
    const headers = ruleBodyAt(css.search(/(?:^|[\s}])\.year-table thead th\s*\{/), '.year-table thead th')
    expect(headers).toMatch(/text-transform:\s*uppercase/)
  })

  it('compare-table plan-name headers are not uppercase', () => {
    const body = ruleBodyAt(
      css.indexOf('.year-table.compare-table thead th.compare-table-plan-name'),
      '.year-table.compare-table thead th.compare-table-plan-name',
    )
    expect(body).toMatch(/text-transform:\s*none/)
    expect(body).not.toMatch(/text-transform:\s*uppercase/)
    expect(body).toMatch(/white-space:\s*normal/)
    expect(body).toMatch(/letter-spacing:\s*normal/)
  })

  it('Plan A and Plan B columns share equal width under table-layout:fixed', () => {
    const table = ruleBodyAt(css.indexOf('.year-table.compare-table {'), '.year-table.compare-table')
    expect(table).toMatch(/table-layout:\s*fixed/)
    expect(table).toMatch(/min-width:\s*52rem/)
    const names = ruleBodyAt(
      css.indexOf('.year-table.compare-table thead th.compare-table-plan-name'),
      '.year-table.compare-table thead th.compare-table-plan-name',
    )
    expect(names).toMatch(/width:\s*28%/)
  })

  it('font inherit is scoped to field select only', () => {
    const shared = ruleBodyAt(
      css.indexOf(".field input:not([type='checkbox']):not([type='radio'])"),
      '.field input / .field select shared',
    )
    expect(shared).not.toMatch(/font:\s*inherit/)
    const select = ruleBodyAt(css.indexOf('\n.field select {'), '.field select')
    expect(select).toMatch(/font:\s*inherit/)
  })
})
