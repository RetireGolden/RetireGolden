/** @vitest-environment jsdom */
/**
 * Computed-style / cascade proof that Getting started is a 2×2 and Import
 * stays auto-fill. String-slicing `.home-paths-grid` is not enough:
 * `.plan-grid` used to restore auto-fill later at the same specificity.
 */

import { afterEach, describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a jsdom test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a jsdom test; the app tsconfig omits node types
import { join } from 'node:path'

// jsdom's import.meta.url is not a file: URL, so sibling chrome tests' fileURLToPath
// pattern cannot load planner.css here. Read from the package cwd instead. `process`
// is untyped because tsconfig.src.json omits node types (this file is still in `src/`).
const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd()
const plannerCss: string = readFileSync(join(cwd, 'src/planner/planner.css'), 'utf8')

function injectPlannerCss() {
  const style = document.createElement('style')
  style.setAttribute('data-chrome-layout-test', 'true')
  style.textContent = plannerCss
  document.head.appendChild(style)
  return style
}

function specificity(selector: string): number {
  const ids = (selector.match(/#/g) ?? []).length
  const classes = (selector.match(/\./g) ?? []).length
  const types = (selector.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length
  return ids * 10000 + classes * 100 + types
}

/** Winning `grid-template-columns` from the live stylesheet cascade. */
function cascadedGridTemplateColumns(el: Element): string | null {
  let winner: { spec: number; order: number; value: string } | null = null
  let order = 0
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSStyleRule)) continue
      const value = rule.style.getPropertyValue('grid-template-columns')
      if (!value) continue
      try {
        if (!el.matches(rule.selectorText)) continue
      } catch {
        continue
      }
      const spec = specificity(rule.selectorText)
      if (!winner || spec > winner.spec || (spec === winner.spec && order >= winner.order)) {
        winner = { spec, order, value }
      }
      order += 1
    }
  }
  return winner?.value ?? null
}

describe('Getting started / Import grid cascade', () => {
  afterEach(() => {
    document.head.querySelectorAll('[data-chrome-layout-test]').forEach((n) => n.remove())
    document.body.replaceChildren()
  })

  it('home Getting started computed tracks are 2 columns, not auto-fill', () => {
    injectPlannerCss()
    const section = document.createElement('section')
    section.className = 'home-paths'
    const grid = document.createElement('div')
    grid.className = 'home-paths-grid plan-grid'
    section.appendChild(grid)
    document.body.appendChild(section)

    const fromCascade = cascadedGridTemplateColumns(grid)
    const fromComputed = getComputedStyle(grid).gridTemplateColumns
    const cols = fromCascade ?? fromComputed
    expect(cols, `cascade="${fromCascade}" computed="${fromComputed}"`).toMatch(/repeat\(2|1fr 1fr/)
    expect(cols).not.toMatch(/auto-fill/)
  })

  it('ImportPage source cards computed tracks stay auto-fill', () => {
    injectPlannerCss()
    const grid = document.createElement('div')
    grid.className = 'plan-grid home-paths-grid'
    document.body.appendChild(grid)

    const fromCascade = cascadedGridTemplateColumns(grid)
    const fromComputed = getComputedStyle(grid).gridTemplateColumns
    const cols = fromCascade ?? fromComputed
    expect(cols, `cascade="${fromCascade}" computed="${fromComputed}"`).toMatch(/auto-fill/)
    expect(cols).not.toMatch(/repeat\(2/)
  })
})
