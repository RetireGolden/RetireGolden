/**
 * Design-QA chrome pins (#418, #419, #423, #431, #436, #437, #438, #441). Pin
 * the CSS, not a jsdom visual: jsdom computes no layout, so the defects these
 * cover — a clipped focus ring, a mid-word clip, a header row that wraps —
 * are only observable in the stylesheet.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const css: string = readFileSync(fileURLToPath(new URL('./planner.css', import.meta.url)), 'utf8')
const learnCss: string = readFileSync(fileURLToPath(new URL('../learn/learn.css', import.meta.url)), 'utf8')
const indexCss: string = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8')

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
 * Body of the first rule whose selector list is exactly `selector`: the text
 * must be followed by `{` and preceded only by whitespace back to the start
 * of the sheet, a `}`, or the end of a comment — so `.foo, .nowrap {` never
 * satisfies a pin for `.nowrap`. Plain string scanning, no dynamic RegExp.
 */
function rule(selector: string, source = css): string {
  let from = 0
  while (from < source.length) {
    const at = source.indexOf(selector, from)
    if (at < 0) break
    from = at + selector.length
    let after = from
    while (after < source.length && /\s/.test(source[after]!)) after++
    if (source[after] !== '{') continue
    let before = at - 1
    while (before >= 0 && /\s/.test(source[before]!)) before--
    const boundary = before < 0 || source[before] === '}' || source.slice(before - 1, before + 1) === '*/'
    if (!boundary) continue
    return ruleBodyAt(source, at, selector)
  }
  return ruleBodyAt(source, -1, selector)
}

describe('Design-QA chrome pins', () => {
  it('plan-name input truncates with an ellipsis, not a mid-word clip (#431)', () => {
    const body = rule('.plan-name-input')
    expect(body).toMatch(/text-overflow:\s*ellipsis/)
    expect(body).toMatch(/width:\s*100%/)
    expect(body).toMatch(/max-width:\s*30rem/)
  })

  it('survivor table headers get a column floor and never break mid-token (#431)', () => {
    expect(rule('.compare-table.survivor-table')).toMatch(/min-width:\s*70rem/)
    // The filing-status column carries its longest segment on one line, so
    // a transition renders one line per segment, not a four-line wrap.
    const filingCell = rule('.compare-table.survivor-table .survivor-filing-cell')
    expect(filingCell).toMatch(/min-width: *18rem/)
    expect(filingCell).toMatch(/text-align: *left/)
    const headers = rule('.compare-table.survivor-table thead th')
    expect(headers).toMatch(/overflow-wrap:\s*normal/)
    expect(headers).toMatch(/hyphens:\s*none/)
    expect(rule('.nowrap')).toMatch(/white-space:\s*nowrap/)
    expect(rule('.survivor-timeline-segment')).toMatch(/display:\s*block/)
    // The wrap the table sits in scrolls, so the floor never widens the page.
    expect(rule('.year-table-wrap')).toMatch(/overflow:\s*auto/)
  })

  it('content pages have a chrome back link style (#419)', () => {
    const body = rule('.page-back')
    expect(body).toMatch(/color:\s*var\(--accent\)/)
    expect(body).toMatch(/display:\s*inline-block/)
  })

  it('a form-grid field can span the full row, which the Spending policy select uses (#423)', () => {
    expect(rule('.form-grid > .field-span-full')).toMatch(/grid-column:\s*1 \/ -1/)
  })

  it('article source links wrap inside the measure (#418)', () => {
    expect(rule('.learn-sources a', learnCss)).toMatch(/overflow-wrap:\s*anywhere/)
  })
})

describe('Design-QA chrome pins: theme and focus tokens', () => {
  it('the theme switcher does not clip its segment focus rings (#436)', () => {
    const switcher = rule('.theme-switcher', indexCss)
    expect(switcher).not.toMatch(/overflow:\s*hidden/)
    expect(switcher).toMatch(/border-radius:\s*999px/)
    // The end segments carry the pill shape instead of the container clipping it.
    expect(rule('.theme-switcher-button:first-child', indexCss)).toMatch(/border-radius:\s*999px 0 0 999px/)
    expect(rule('.theme-switcher-button:last-child', indexCss)).toMatch(/border-radius:\s*0 999px 999px 0/)
    // The ring itself is unchanged: the app-wide 2px gold signature, which is
    // what the removed clip was cutting into a sliver.
    const sharedFocus = indexCss.slice(indexCss.indexOf('.theme-switcher-button:focus-visible'))
    expect(sharedFocus.slice(0, 200)).toMatch(/outline:\s*2px solid var\(--accent\)/)
  })

  it('the plan breadcrumb link uses the shared focus ring, not the UA default (#437)', () => {
    const body = rule('.workspace-breadcrumb a:focus-visible')
    expect(body).toMatch(/outline:\s*2px solid var\(--accent\)/)
    expect(body).toMatch(/outline-offset:\s*2px/)
  })

  it('empty states are a bounded well, except the picker landing (#438)', () => {
    const body = rule('.empty-state')
    expect(body).toMatch(/border:\s*1px dashed var\(--border\)/)
    expect(body).toMatch(/border-radius:\s*var\(--radius\)/)
    expect(body).toMatch(/background:\s*color-mix/)
    const picker = rule('.picker-page .empty-state')
    expect(picker).toMatch(/border:\s*0/)
    expect(picker).toMatch(/background:\s*none/)
  })

  it('disabled buttons use the flat token treatment, not opacity on a live fill (#441)', () => {
    const body = rule('.btn:disabled', indexCss)
    expect(body).not.toMatch(/opacity/)
    expect(body).toMatch(/background:\s*var\(--surface-2\)/)
    expect(body).toMatch(/color:\s*var\(--muted\)/)
    expect(body).toMatch(/cursor:\s*not-allowed/)
    // Ghost buttons have no fill to composite against and keep the faded
    // treatment the plan-card Delete pin (#312) relies on.
    expect(rule('.btn-ghost:disabled')).toMatch(/opacity:\s*0\.45/)
  })
})
