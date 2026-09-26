/**
 * Design QA, stylesheet half of the KPI wrap (the markup half and the Chromium
 * measurements are in designQa.kpiWrap.markup.test.tsx). "short from 2026" is
 * 15 characters in a 10rem cell whose value does not wrap; the class the
 * worded Money lasts value carries lets it wrap between words, and break a
 * word only if one alone could not fit, so it never paints past its cell.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

/** The stylesheet with LF line endings whatever the checkout wrote. */
const css: string = readFileSync(fileURLToPath(new URL('./planner.css', import.meta.url)), 'utf8').replace(/\r\n/g, '\n')

/** The body of the one top-level rule whose selector list is exactly `selector`, and where it starts. */
function ruleBody(selector: string): { body: string; at: number } {
  const at = css.indexOf('\n' + selector + ' {')
  if (at < 0) throw new Error(`no top-level rule for ${selector}`)
  if (css.indexOf('\n' + selector + ' {', at + 1) >= 0) throw new Error(`more than one top-level rule for ${selector}`)
  const open = css.indexOf('{', at)
  return { body: css.slice(open + 1, css.indexOf('}', open)), at }
}

describe('design QA: kpi-value--wrap', () => {
  it('wraps between words, after the no-wrap .kpi-value rule it overrides', () => {
    const base = ruleBody('.kpi-value')
    const wrap = ruleBody('.kpi-value--wrap')
    expect(base.body).toMatch(/white-space:\s*nowrap;/)
    expect(wrap.body).toMatch(/white-space:\s*normal;/)
    expect(wrap.body).toMatch(/overflow-wrap:\s*anywhere;/)
    // Equal specificity, so the later rule wins.
    expect(wrap.at).toBeGreaterThan(base.at)
  })
})
