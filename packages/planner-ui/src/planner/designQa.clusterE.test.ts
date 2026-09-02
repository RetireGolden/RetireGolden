/**
 * Design-QA cluster E pins (#533, #534, #535, #541, #549) and the pure helpers
 * the cluster added. The breadcrumb truncation (#501) is cluster A's rule,
 * pinned in designQa.clusterA.test.ts; this cluster adds none of its own. Pin the CSS, not a jsdom visual: jsdom computes no layout,
 * so a clamped card name or a truncated crumb is only observable in the
 * stylesheet. The rendered-DOM checks for this cluster live in
 * designQa.clusterE.dom.test.tsx.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

import {
  clampPlanName,
  duplicateNameDefault,
  duplicateNameFor,
  PLAN_NAME_MAX_LENGTH,
  PLAN_NAME_TITLE_MAX_LENGTH,
  planNameForTitle,
} from './planName'
import { ordinalSuffixes } from './sections/sectionHelpers'

/** A sheet with LF line endings whatever the checkout wrote, so multi-line selector pins hold on Windows too. */
function sheet(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')
}

const css: string = sheet('./planner.css')
const indexCss: string = sheet('../index.css')

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

/** Body of the LAST rule for `selector` — the cluster block appends overrides at the end of the sheet. */
function lastRule(selector: string, source = css): string {
  let last = -1
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
    if (boundary) last = at
  }
  return ruleBodyAt(source, last, selector)
}

describe('Design-QA cluster E chrome pins', () => {
  it('a plan card clamps a long name to two lines instead of growing past its siblings (#533)', () => {
    const body = lastRule('.plan-card-name')
    expect(body).toMatch(/-webkit-line-clamp:\s*2/)
    expect(body).toMatch(/display:\s*-webkit-box/)
    expect(body).toMatch(/overflow:\s*hidden/)
    // A 182-character run with no spaces must still break inside the card.
    expect(body).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('the Learn clear control is a positioned button and the UA glyph is hidden (#534)', () => {
    expect(rule('.learn-search')).toMatch(/position:\s*relative/)
    // Room for the button exists only while the button does; the two-class
    // selector outranks learn.css's `.learn-search-input` padding, which the
    // Learn chunk loads after this sheet. No unconditional padding-right.
    expect(rule('.learn-search--has-query .learn-search-input')).toMatch(/padding-right:\s*2\.75rem/)
    expect(css).not.toMatch(/\.learn-search \.learn-search-input\s*\{/)
    // Every engine's native cancel control, one rule each.
    expect(rule('.learn-search .learn-search-input::-webkit-search-cancel-button')).toMatch(/appearance:\s*none/)
    expect(rule('.learn-search .learn-search-input::-webkit-search-decoration')).toMatch(/appearance:\s*none/)
    expect(rule('.learn-search .learn-search-input::-ms-clear')).toMatch(/display:\s*none/)
    const clear = rule('.learn-search-clear')
    expect(clear).toMatch(/position:\s*absolute/)
    expect(clear).toMatch(/cursor:\s*pointer/)
    // The app-wide focus signature, and a coarse-pointer target near 44px.
    expect(rule('.learn-search-clear:focus-visible')).toMatch(/outline:\s*2px solid var\(--accent\)/)
    const coarse = css.slice(css.indexOf('/* --- Design QA cluster E'))
    expect(coarse).toMatch(/@media \(pointer: coarse\) \{\s*\.learn-search-clear \{\s*width:\s*2\.75rem/)
  })
})

describe('Design-QA cluster E: disabled field chrome (#535)', () => {
  it('a disabled text field and an affixed box take the flat disabled tokens', () => {
    const input = rule(".field input:not([type='checkbox']):not([type='radio']):not([type='range']):disabled")
    expect(input).toMatch(/background-color:\s*var\(--surface-2\)/)
    expect(input).toMatch(/color:\s*var\(--muted\)/)
    expect(input).toMatch(/border-color:\s*var\(--border\)/)
    expect(input).toMatch(/cursor:\s*not-allowed/)
    const affix = rule('.field .input-affix:has(> input:disabled)')
    expect(affix).toMatch(/background:\s*var\(--surface-2\)/)
    expect(affix).toMatch(/cursor:\s*not-allowed/)
    // The same tokens the buttons and selects use, so both themes follow.
    expect(rule('.btn:disabled', indexCss)).toMatch(/background:\s*var\(--surface-2\)/)
    expect(rule('select:disabled', indexCss)).toMatch(/background-color:\s*var\(--surface-2\)/)
  })
})

describe('plan-name presentation limits (#533)', () => {
  it('cuts a default that overruns the input cap, trimming a trailing space', () => {
    const long = `Copy of ${'word '.repeat(60)}`
    const clamped = clampPlanName(long)
    expect(clamped.length).toBeLessThanOrEqual(PLAN_NAME_MAX_LENGTH)
    expect(clamped.startsWith('Copy of word')).toBe(true)
    expect(clamped.endsWith(' ')).toBe(false)
    // A name that fits is returned as is.
    expect(clampPlanName('My plan')).toBe('My plan')
  })

  it('a Duplicate confirmed with an emptied prompt gets the clamped default, never the unclamped store fallback', () => {
    const atCap = 'n'.repeat(PLAN_NAME_MAX_LENGTH)
    expect(duplicateNameDefault(atCap).length).toBe(PLAN_NAME_MAX_LENGTH)
    expect(duplicateNameDefault(atCap).startsWith('Copy of n')).toBe(true)
    for (const entered of ['', '   ']) {
      expect(duplicateNameFor(entered, atCap)).toBe(duplicateNameDefault(atCap))
    }
    // Typed text wins, trimmed and capped.
    expect(duplicateNameFor('  Retire at 62  ', atCap)).toBe('Retire at 62')
    expect(duplicateNameFor('x'.repeat(PLAN_NAME_MAX_LENGTH + 5), atCap).length).toBe(PLAN_NAME_MAX_LENGTH)
  })

  it('shortens the name for the tab title with an ellipsis, and only past the cap', () => {
    const long = 'x'.repeat(PLAN_NAME_TITLE_MAX_LENGTH + 40)
    const title = planNameForTitle(long)
    expect(title.endsWith('…')).toBe(true)
    expect(title.length).toBe(PLAN_NAME_TITLE_MAX_LENGTH + 1)
    expect(planNameForTitle('x'.repeat(PLAN_NAME_TITLE_MAX_LENGTH))).toBe('x'.repeat(PLAN_NAME_TITLE_MAX_LENGTH))
  })
})

describe('ordinalSuffixes (#541, #549)', () => {
  it('numbers only the titles that repeat, in list order', () => {
    expect(ordinalSuffixes(['Mortgage', 'Home', 'Mortgage', 'Car loan', 'Home'])).toEqual([
      ' (1)',
      ' (1)',
      ' (2)',
      '',
      ' (2)',
    ])
    expect(ordinalSuffixes(['Riley · age 85', 'Riley · age 85'])).toEqual([' (1)', ' (2)'])
  })

  it('leaves unique titles bare and handles an empty list', () => {
    expect(ordinalSuffixes(['Home', 'Mortgage'])).toEqual(['', ''])
    expect(ordinalSuffixes([])).toEqual([])
  })
})
