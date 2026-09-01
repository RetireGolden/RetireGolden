/**
 * Design-QA chrome pins (#418, #419, #423, #431). Pin the CSS, not a jsdom
 * visual: the plan-name input truncates with an ellipsis, the survivor table
 * has a column floor so headers wrap on word boundaries, and the content-page
 * back link and the full-span field hook exist for the pages that use them.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const css: string = readFileSync(fileURLToPath(new URL('./planner.css', import.meta.url)), 'utf8')
const learnCss: string = readFileSync(fileURLToPath(new URL('../learn/learn.css', import.meta.url)), 'utf8')

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
