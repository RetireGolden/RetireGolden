/** @vitest-environment jsdom */
/**
 * Plan-card Delete must look destructive at rest vs Duplicate (#312).
 * String-slicing a hover-only rule is not enough. Winning rest and hover
 * colors must resolve `--bad` on the plan-card action only — form
 * ghost-danger Remove stays muted at rest.
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

type CascadeState = 'rest' | 'hover'

function selectorAppliesInState(selector: string, state: CascadeState): string | null {
  if (selector.includes('@')) return null
  if (/(^|[^n]):(focus|active)/.test(selector) || selector.includes(':focus-visible')) return null
  const hasHover = selector.includes(':hover')
  if (state === 'rest' && (hasHover || /:[a-z]/.test(selector))) return null
  if (state === 'hover' && hasHover === false && /:[a-z]/.test(selector) && !selector.includes(':not')) {
    return null
  }
  return selector.replace(/:hover/g, '').replace(/:not\(:disabled\)/g, '')
}

/** Winning `color` from the live stylesheet cascade for rest or hover. */
function cascadedColor(el: Element, state: CascadeState): string | null {
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
      const matchSel = selectorAppliesInState(rule.selectorText, state)
      if (matchSel === null) continue
      const value = rule.style.getPropertyValue('color')
      if (!value) continue
      try {
        if (!el.matches(matchSel)) continue
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

function computedTokenColor(token: '--bad' | '--muted'): string {
  const probe = document.createElement('span')
  probe.setAttribute('data-token-probe', 'true')
  probe.style.color = `var(${token})`
  document.body.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
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

function mountFormRemove() {
  const remove = document.createElement('button')
  remove.className = 'btn-ghost btn-ghost-danger'
  remove.textContent = 'Remove'
  document.body.appendChild(remove)
  return remove
}

describe('plan-card Duplicate vs Delete chrome (#312)', () => {
  afterEach(() => {
    document.head.querySelectorAll('[data-plan-card-chrome-test]').forEach((n) => n.remove())
    document.documentElement.removeAttribute('data-theme')
    document.body.replaceChildren()
  })

  it('Delete resting color is --bad and form Remove stays muted', () => {
    injectChromeCss()
    const { duplicate, del } = mountActionPair()
    const formRemove = mountFormRemove()

    expect(cascadedColor(duplicate, 'rest'), 'Duplicate resting cascade').toMatch(/var\(--muted\)/)
    expect(cascadedColor(del, 'rest'), 'Delete resting cascade').toMatch(/var\(--bad\)/)
    expect(cascadedColor(formRemove, 'rest'), 'form Remove resting cascade').toMatch(/var\(--muted\)/)
    expect(cascadedColor(del, 'rest')).not.toBe(cascadedColor(duplicate, 'rest'))
  })

  it('hovered Delete stays --bad and beats .btn-ghost:hover', () => {
    injectChromeCss()
    const { duplicate, del } = mountActionPair()

    expect(cascadedColor(duplicate, 'hover'), 'Duplicate hover cascade').toMatch(/var\(--fg\)/)
    expect(cascadedColor(del, 'hover'), 'Delete hover cascade').toMatch(/var\(--bad\)/)
    expect(cascadedColor(del, 'hover')).not.toBe(cascadedColor(duplicate, 'hover'))
  })

  it('Delete computed color equals --bad in each theme', () => {
    injectChromeCss()
    const { duplicate, del } = mountActionPair()

    const byTheme: Record<'light' | 'dark', { bad: string; muted: string; del: string; dup: string }> = {
      light: { bad: '', muted: '', del: '', dup: '' },
      dark: { bad: '', muted: '', del: '', dup: '' },
    }

    for (const theme of ['light', 'dark'] as const) {
      document.documentElement.setAttribute('data-theme', theme)
      const bad = computedTokenColor('--bad')
      const muted = computedTokenColor('--muted')
      const delColor = getComputedStyle(del).color
      const dupColor = getComputedStyle(duplicate).color
      expect(bad, `${theme} --bad probe`).not.toBe('')
      expect(muted, `${theme} --muted probe`).not.toBe('')
      expect(delColor, `${theme} Delete computed`).toBe(bad)
      expect(dupColor, `${theme} Duplicate computed`).toBe(muted)
      byTheme[theme] = { bad, muted, del: delColor, dup: dupColor }
    }

    if (byTheme.light.bad !== byTheme.dark.bad) {
      expect(byTheme.light.del).not.toBe(byTheme.dark.del)
    }
    if (byTheme.light.muted !== byTheme.dark.muted) {
      expect(byTheme.light.dup).not.toBe(byTheme.dark.dup)
    }
  })

  it('disabled ghost-danger is faded and not-allowed', () => {
    injectChromeCss()
    const remove = mountFormRemove()
    remove.disabled = true
    const style = getComputedStyle(remove)
    expect(Number.parseFloat(style.opacity)).toBeLessThan(1)
    expect(style.cursor).toBe('not-allowed')
  })
})
