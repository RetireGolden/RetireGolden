/** @vitest-environment jsdom */
/**
 * Plan-card Delete must look destructive at rest vs Duplicate (#312).
 * String-slicing `.btn-ghost-danger:hover` is not enough: that hover-only
 * rule is the regression. Winning *resting* color (no :hover/:focus) must
 * differ, and Delete must resolve `--bad` in both themes.
 */

import { afterEach, describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a jsdom test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a jsdom test; the app tsconfig omits node types
import { join } from 'node:path'

const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd()
const indexCss: string = readFileSync(join(cwd, 'src/index.css'), 'utf8')
const plannerCss: string = readFileSync(join(cwd, 'src/planner/planner.css'), 'utf8')

function injectChromeCss() {
  const style = document.createElement('style')
  style.setAttribute('data-plan-card-chrome-test', 'true')
  style.textContent = `${indexCss}\n${plannerCss}`
  document.head.appendChild(style)
  return style
}

function specificity(selector: string): number {
  const ids = (selector.match(/#/g) ?? []).length
  const classes = (selector.match(/\./g) ?? []).length
  const types = (selector.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length
  return ids * 10000 + classes * 100 + types
}

function isRestingSelector(selector: string): boolean {
  return !selector.includes('@') && !selector.includes(':')
}

/** Winning resting `color` from the live stylesheet cascade (pseudos skipped). */
function cascadedRestingColor(el: Element): string | null {
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
      if (!isRestingSelector(rule.selectorText)) continue
      const value = rule.style.getPropertyValue('color')
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

function mountActionPair() {
  const card = document.createElement('div')
  card.className = 'plan-card'
  const actions = document.createElement('span')
  actions.className = 'plan-card-actions'
  const duplicate = document.createElement('button')
  duplicate.className = 'btn-ghost'
  duplicate.textContent = 'Duplicate'
  const del = document.createElement('button')
  del.className = 'btn-ghost btn-ghost-danger'
  del.textContent = 'Delete'
  actions.append(duplicate, del)
  card.appendChild(actions)
  document.body.appendChild(card)
  return { duplicate, del }
}

describe('plan-card Duplicate vs Delete chrome (#312)', () => {
  afterEach(() => {
    document.head.querySelectorAll('[data-plan-card-chrome-test]').forEach((n) => n.remove())
    document.documentElement.removeAttribute('data-theme')
    document.body.replaceChildren()
  })

  it('Delete resting color is --bad and differs from Duplicate in both themes', () => {
    injectChromeCss()
    const { duplicate, del } = mountActionPair()

    const dupCascade = cascadedRestingColor(duplicate)
    const delCascade = cascadedRestingColor(del)
    expect(dupCascade, 'Duplicate resting cascade').toMatch(/var\(--muted\)/)
    expect(delCascade, 'Delete resting cascade').toMatch(/var\(--bad\)/)
    expect(delCascade).not.toBe(dupCascade)

    function assertComputedDistinct(theme: 'light' | 'dark') {
      document.documentElement.setAttribute('data-theme', theme)
      const dupColor = getComputedStyle(duplicate).color
      const delColor = getComputedStyle(del).color
      expect(delColor, `${theme} Delete computed`).not.toBe(dupColor)
      expect(delColor, `${theme} Delete computed`).not.toBe('')
      expect(dupColor, `${theme} Duplicate computed`).not.toBe('')
    }

    assertComputedDistinct('light')
    assertComputedDistinct('dark')
  })
})
