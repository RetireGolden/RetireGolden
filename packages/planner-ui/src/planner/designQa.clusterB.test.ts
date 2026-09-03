/**
 * Design-QA cluster B pins (#507, #516, #519, #521, #525). CSS and token
 * pins, kept apart from designQa.chrome.test.ts so parallel Design-QA
 * branches do not collide in one file. jsdom computes no layout, so the
 * defects these cover — an invisible checkbox edge, a box pinned to the top
 * of its track, a missing focus ring — are only observable in the sheet.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')

const css = read('./planner.css')
const indexCss = read('../index.css')

function ruleBodyAt(source: string, start: number, selector: string): string {
  expect(start, `rule ${selector} present`).toBeGreaterThanOrEqual(0)
  const open = source.indexOf('{', start)
  let depth = 1
  let i = open + 1
  while (depth > 0 && i < source.length) {
    if (source[i] === '{') depth++
    if (source[i] === '}') depth--
    i++
  }
  return source.slice(open + 1, i - 1)
}

/**
 * Body of the first rule whose selector list is exactly `selector` (see
 * designQa.chrome.test.ts); here a `{` also counts as a boundary, so the
 * first rule inside an at-rule block is reachable.
 */
function rule(selector: string, source = css): string {
  let from = 0
  while (from < source.length) {
    const at = source.indexOf(selector, from)
    if (at < 0) break
    from = at + selector.length
    let after = from
    while (after < source.length && /\s/.test(source[after])) after++
    if (source[after] !== '{') continue
    let before = at - 1
    while (before >= 0 && /\s/.test(source[before])) before--
    const boundary =
      before < 0 || source[before] === '}' || source[before] === '{' || source.slice(before - 1, before + 1) === '*/'
    if (!boundary) continue
    return ruleBodyAt(source, at, selector)
  }
  return ruleBodyAt(source, -1, selector)
}

/** The appended cluster-B block: the last thing in the sheet, so it wins ties. */
const clusterBlock = (() => {
  const at = css.indexOf('/* --- Design QA cluster B')
  expect(at, 'cluster B block present').toBeGreaterThanOrEqual(0)
  return css.slice(at)
})()

function tokensOf(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const match of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[match[1]] = match[2].toLowerCase()
  }
  return out
}

function themeBlock(selectorStart: string): string {
  return ruleBodyAt(indexCss, indexCss.indexOf(selectorStart), selectorStart)
}

function luminance(hex: string): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

describe('Design-QA cluster B: native check boxes carry their own edge token (#521)', () => {
  const light = tokensOf(themeBlock(':root {'))
  const toggledDark = tokensOf(themeBlock(":root[data-theme='dark']"))
  const mediaDark = tokensOf(themeBlock(":root:not([data-theme='light'])"))

  it('defines --control-border in the light block and both dark mechanisms, identically', () => {
    expect(light['control-border']).toBeTruthy()
    expect(toggledDark['control-border']).toBeTruthy()
    expect(mediaDark['control-border']).toBe(toggledDark['control-border'])
  })

  it('clears the 3:1 non-text floor against both surfaces in both themes', () => {
    for (const [name, theme] of [
      ['light', light],
      ['dark', toggledDark],
    ] as const) {
      for (const bg of ['surface-1', 'surface-2'] as const) {
        expect(contrast(theme['control-border'], theme[bg]), `${name}: control-border on ${bg}`).toBeGreaterThanOrEqual(3)
      }
      // The old edge, kept for panels and fields, is what failed: pin the
      // reason the token exists so nobody "simplifies" it back to --border.
      expect(contrast(theme['border'], theme['surface-1']), `${name}: --border alone is not enough`).toBeLessThan(3)
    }
  })

  it('the shared check/radio rule draws its edge from the token, and hover deepens it from there', () => {
    const box = rule("input[type='checkbox'],\ninput[type='radio']", indexCss)
    expect(box).toMatch(/border:\s*1px solid var\(--control-border\)/)
    expect(box).not.toMatch(/var\(--border\)/)
    const hover = rule("input[type='checkbox']:hover:not(:disabled),\ninput[type='radio']:hover:not(:disabled)", indexCss)
    expect(hover).toMatch(/color-mix\(in srgb, var\(--fg\) 30%, var\(--control-border\)\)/)
  })

  it('nested form groups are bounded wells, not a gold side-stripe (#521)', () => {
    // Edited in place: the sheet carries exactly one .nested-form-section
    // rule, so there is no dead side-stripe copy to resurrect by mistake.
    expect(css.match(/^\.nested-form-section\s*\{/gm)).toHaveLength(1)
    const well = rule('.nested-form-section')
    expect(well).toMatch(/border:\s*1px solid var\(--border\)/)
    expect(well).toMatch(/border-radius:\s*var\(--radius\)/)
    expect(well).toMatch(/background:\s*color-mix\(in srgb, var\(--fg\) 3%, transparent\)/)
    expect(well).not.toMatch(/border-left/)
    expect(css).not.toMatch(/border-left:\s*3px solid var\(--accent\)/)
    // Inside a form grid the well takes the full row, so it never shares a
    // track with a field beside it.
    expect(rule('.form-grid > .nested-form-section')).toMatch(/grid-column:\s*1 \/ -1/)
  })
})

describe('Design-QA cluster B: layout and focus chrome', () => {
  it('a checkbox in a subgridded form row is centred on its neighbours (#516)', () => {
    const supports = clusterBlock.slice(clusterBlock.indexOf('@supports (grid-template-rows: subgrid)'))
    expect(supports.length).toBeGreaterThan(0)
    expect(rule(".form-grid > .field--checkbox > input[type='checkbox']", supports)).toMatch(/align-self:\s*center/)
    // The base rule outside a subgrid row is untouched.
    expect(rule(".field--checkbox input[type='checkbox']")).toMatch(/align-self:\s*flex-start/)
  })

  it('an import source card shows the app ring on any focus, since focus is restored by script (#507)', () => {
    const body = rule('.import-page .home-path-card:focus', clusterBlock)
    expect(body).toMatch(/outline:\s*2px solid var\(--accent\)/)
    expect(body).toMatch(/outline-offset:\s*2px/)
  })

  it('example group headings exist and a card title keeps its size at h3 or h4 (#519)', () => {
    expect(rule('.example-group-heading', clusterBlock)).toMatch(/font-weight:\s*650/)
    const title = rule('.plan-grid h3.plan-card-name,\n.plan-grid h4.plan-card-name', clusterBlock)
    expect(title).toMatch(/font-size:\s*1\.05rem/)
    expect(title).toMatch(/margin:\s*0/)
  })

  it('the optimizer failure well takes the app focus ring on any focus, since it is focused by script (#525)', () => {
    const ring = rule('.optimizer-failure:focus', clusterBlock)
    expect(ring).toMatch(/outline:\s*2px solid var\(--accent\)/)
    expect(ring).toMatch(/outline-offset:\s*2px/)
    // No rule hides the ring for script focus after a pointer click.
    expect(clusterBlock).not.toMatch(/\.optimizer-failure:focus:not\(:focus-visible\)/)
    // The thrown-error well is a warn callout, which the sheet defines.
    const warn = rule('.callout--warn')
    expect(warn).toMatch(/var\(--warn\)/)
    const page = read('./OptimizePage.tsx')
    expect(page).toMatch(/className="callout callout--warn optimizer-failure" role="alert" tabIndex=\{-1\}/)
    expect(page).toMatch(/className="card optimizer-failure" tabIndex=\{-1\}/)
  })

  it('the cluster block is appended after every earlier rule, so it wins ties', () => {
    expect(css.indexOf('/* --- Design QA cluster B')).toBeGreaterThan(css.indexOf('.solver-failure .picker-actions'))
  })
})
