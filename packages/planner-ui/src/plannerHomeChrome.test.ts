/**
 * First-run planner-home chrome (#297): selected theme must not share the
 * primary-CTA gold fill, skip-to-content must sit in flow when focused, and
 * Getting started is a 2×2 — asserted from the stylesheets so a later
 * “make it gold again” or auto-fill grid cannot silently regress.
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

describe('planner home chrome (#297)', () => {
  it('selected theme segment does not use the primary-CTA accent fill', () => {
    const block = extractBlock(indexCss, ".theme-switcher-button[aria-pressed='true']")
    expect(block).not.toMatch(/var\(--accent\)/)
    expect(block).not.toMatch(/var\(--accent-fg\)/)
    expect(block).toMatch(/var\(--fg\)/)
  })

  it('focused skip-to-content is in document flow, not pinned over the wordmark', () => {
    const block = extractBlock(indexCss, '.skip-link:focus')
    expect(block).toMatch(/position:\s*static/)
    expect(block).not.toMatch(/top:\s*0\.5rem/)
  })

  it('Getting started grid is a 2-column 2×2, not auto-fill 16rem (3+1)', () => {
    const block = extractBlock(plannerCss, '.home-paths-grid {')
    expect(block).toMatch(/grid-template-columns:\s*repeat\(2/)
    expect(block).not.toMatch(/auto-fill/)
  })

  it('Start here is a column list', () => {
    const block = extractBlock(plannerCss, '.home-start-here-list {')
    expect(block).toMatch(/flex-direction:\s*column/)
  })
})
