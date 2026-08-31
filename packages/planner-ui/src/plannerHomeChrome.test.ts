/**
 * First-run planner-home chrome (#297): selected theme must not share the
 * primary-CTA gold fill, shell skip-to-content sits in flow when focused,
 * workspace skip stays out of the two-column grid, and Getting started is a
 * real 2×2 that beats `.plan-grid` auto-fill. Import source cards share
 * that same 2×2 — they used to stay auto-fill because the winning rule
 * required a `.home-paths` wrapper Import never had (#342).
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const indexCss: string = readFileSync(fileURLToPath(new URL('./index.css', import.meta.url)), 'utf8')
const plannerCss: string = readFileSync(
  fileURLToPath(new URL('./planner/planner.css', import.meta.url)),
  'utf8',
)

function extractBlock(css: string, selectorStart: string): string {
  const start = css.indexOf(selectorStart)
  expect(start, `selector ${selectorStart} present`).toBeGreaterThanOrEqual(0)
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

/** Specificity as (id, class, type) packed so later equal-spec rules can win by source order. */
function specificity(selector: string): number {
  const sel = selector.trim()
  const ids = (sel.match(/#/g) ?? []).length
  const classes = (sel.match(/\./g) ?? []).length
  const types = (sel.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length
  return ids * 10000 + classes * 100 + types
}

function winningDeclaration(css: string, className: string, property: string, ancestorClass?: string): string | null {
  const doc = `<!doctype html><html><head><style>${css}</style></head><body>
    ${ancestorClass ? `<div class="${ancestorClass}">` : ''}<div class="${className}" id="target"></div>${ancestorClass ? '</div>' : ''}
  </body></html>`
  // Cascade in this helper: last matching rule of highest specificity wins.
  // Used when jsdom computed-style is unavailable (this file is node-env).
  const ruleRe = /([^{}]+)\{([^{}]+)\}/g
  let match: RegExpExecArray | null
  let bestSpec = -1
  let bestValue: string | null = null
  const targetClasses = new Set(className.split(/\s+/))
  while ((match = ruleRe.exec(css)) !== null) {
    const selectors = match[1]!.split(',').map((s) => s.trim())
    const body = match[2]!
    const prop = body.match(new RegExp(`${property}\\s*:\\s*([^;]+)`))
    if (!prop) continue
    for (const sel of selectors) {
      if (sel.includes('@') || sel.includes(':') || sel.includes('[')) continue
      const parts = sel.split(/\s+/).filter(Boolean)
      const last = parts[parts.length - 1]!
      const lastClasses = [...last.matchAll(/\.([\w-]+)/g)].map((m) => m[1]!)
      if (lastClasses.length === 0) continue
      if (!lastClasses.every((c) => targetClasses.has(c))) continue
      if (parts.length > 1) {
        const ancestorSel = parts[0]!
        const ancestorNames = [...ancestorSel.matchAll(/\.([\w-]+)/g)].map((m) => m[1]!)
        if (!ancestorClass || !ancestorNames.every((c) => c === ancestorClass || ancestorClass.split(/\s+/).includes(c))) {
          continue
        }
      }
      const spec = specificity(sel)
      if (spec >= bestSpec) {
        bestSpec = spec
        bestValue = prop[1]!.trim()
      }
    }
  }
  void doc
  return bestValue
}

describe('planner home chrome (#297)', () => {
  it('selected theme segment does not use the primary-CTA accent fill', () => {
    const block = extractBlock(indexCss, ".theme-switcher-button[aria-pressed='true']")
    expect(block).not.toMatch(/var\(--accent\)/)
    expect(block).not.toMatch(/var\(--accent-fg\)/)
    expect(block).toMatch(/var\(--fg\)/)
  })

  it('focused shell skip-to-content is in document flow; generic skip-link:focus stays out of flow', () => {
    const generic = extractBlock(indexCss, '.skip-link:focus')
    expect(generic).toMatch(/position:\s*absolute/)
    expect(generic).not.toMatch(/position:\s*static/)
    const shell = extractBlock(indexCss, '.app-shell > .skip-link:focus')
    expect(shell).toMatch(/position:\s*static/)
  })

  it('workspace is a positioning context so its skip-link stays out of the grid', () => {
    const block = extractBlock(plannerCss, '.workspace {')
    expect(block).toMatch(/position:\s*relative/)
    expect(block).toMatch(/grid-template-columns:\s*13\.5rem/)
  })

  it('narrow header hides the wordmark so nav stays one row', () => {
    const mobile = extractBlock(indexCss, '@media (max-width: 640px)')
    const wordmark = extractBlock(mobile, '.brand-wordmark')
    expect(wordmark).toMatch(/display:\s*none/)
    const nav = extractBlock(mobile, '.nav {')
    expect(nav).toMatch(/flex-wrap:\s*nowrap/)
  })

  it('privacy-card actions do not stretch siblings to the backup-hint height', () => {
    const block = extractBlock(plannerCss, '.home-privacy-card .picker-actions')
    expect(block).toMatch(/align-items:\s*flex-start/)
  })

  it('Start here is a column list', () => {
    const block = extractBlock(plannerCss, '.home-start-here-list {')
    expect(block).toMatch(/flex-direction:\s*column/)
  })

  it('Getting started and Import landings share the 2×2 that beats later .plan-grid auto-fill', () => {
    const homeCols = winningDeclaration(
      plannerCss,
      'home-paths-grid plan-grid',
      'grid-template-columns',
      'home-paths',
    )
    expect(homeCols, 'home Getting started winning track list').toMatch(/repeat\(2/)
    expect(homeCols).not.toMatch(/auto-fill/)

    // ImportPage markup is `plan-grid home-paths-grid` with no `.home-paths`
    // wrapper. The 2-column rule must still win — requiring the wrapper is
    // the #342 bug (four 298px auto-fill tracks at the hosted-Free width).
    const importCols = winningDeclaration(
      plannerCss,
      'plan-grid home-paths-grid',
      'grid-template-columns',
    )
    expect(importCols, 'ImportPage winning track list').toMatch(/repeat\(2/)
    expect(importCols).not.toMatch(/auto-fill/)

    // The override must appear after `.plan-grid` so a same-specificity tie
    // cannot restore auto-fill, and it must not require `.home-paths`.
    const planGridAt = plannerCss.indexOf('\n.plan-grid {')
    const overrideAt = plannerCss.indexOf('.home-paths-grid.plan-grid')
    expect(planGridAt).toBeGreaterThanOrEqual(0)
    expect(overrideAt).toBeGreaterThan(planGridAt)
    expect(plannerCss).not.toMatch(/\.home-paths\s+\.home-paths-grid\.plan-grid/)
  })

  it('Import step back control sits with the h2, not item-row-head space-between', () => {
    const block = extractBlock(plannerCss, '.import-source-head {')
    expect(block).toMatch(/display:\s*flex/)
    expect(block).toMatch(/flex-wrap:\s*wrap/)
    expect(block).not.toMatch(/space-between/)
    expect(block).not.toMatch(/justify-content:\s*flex-end/)
  })
})
