/**
 * Design-QA cluster E: stylesheet pins for the rules the cluster appended
 * (#533 card clamp and open overlay, #534 Learn clear control, #535 disabled
 * field chrome) and unit tests for the pure helpers it added (the plan-name
 * caps for #533, the ordinal suffixes for #541 and #549). The ordinals have
 * no stylesheet of their own; their rendering is checked in the DOM file.
 *
 * The pins read the CSS rather than render it: jsdom computes no layout, so
 * a clamped card name or a disabled field's fill is only observable in the
 * stylesheet. The rendered-DOM checks for the cluster live in
 * designQa.clusterE.dom.test.tsx. The breadcrumb truncation (#501) is
 * cluster A's rule, pinned in designQa.clusterA.test.ts; this file adds no
 * pin for it.
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
import { SURVIVOR_MIN_MARRIAGE_YEARS } from '@retiregolden/engine/socialSecurity/maritalBenefits'
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
    if (!atRuleBoundary(source, at)) continue
    return ruleBodyAt(source, at, selector)
  }
  return ruleBodyAt(source, -1, selector)
}

/**
 * Whether only whitespace separates `at` from the start of the sheet, a
 * `}`, or the end of a comment. The comment check reads the two characters
 * before the whitespace explicitly, so a comment that ends at the very start
 * of the sheet is a boundary too.
 */
function atRuleBoundary(source: string, at: number): boolean {
  let before = at - 1
  while (before >= 0 && /\s/.test(source[before]!)) before--
  if (before < 0 || source[before] === '}') return true
  return before >= 1 && source[before - 1] === '*' && source[before] === '/'
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
    if (atRuleBoundary(source, at)) last = at
  }
  return ruleBodyAt(source, last, selector)
}

describe('the pin helpers themselves', () => {
  it('find a rule that follows a sheet-leading comment, and one after a brace, and reject one inside a selector list', () => {
    const sheet = '/* header */\n.first { a: b }\n.x, .second { c: d }\n.second { e: f }'
    expect(rule('.first', sheet)).toMatch(/a: b/)
    expect(rule('.second', sheet)).toMatch(/e: f/)
    expect(lastRule('.second', sheet)).toMatch(/e: f/)
    expect(rule('.x', '/* c */.x { g: h }')).toMatch(/g: h/)
  })
})

describe('Design-QA cluster E chrome pins', () => {
  it('a plan card clamps a long name to two lines instead of growing past its siblings (#533)', () => {
    const body = lastRule('.plan-card-open > .plan-card-name')
    expect(body).toMatch(/-webkit-line-clamp:\s*2/)
    // The clamp is inert without both halves of the -webkit-box pair.
    expect(body).toMatch(/display:\s*-webkit-box/)
    expect(body).toMatch(/-webkit-box-orient:\s*vertical/)
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

describe('Design-QA cluster E: the reconciled plan card (#533)', () => {
  it('the open button is a block that holds the name and stretches over the card by its ::after', () => {
    const open = rule('.plan-card-open')
    expect(open).toMatch(/display:\s*block/)
    expect(open).toMatch(/min-width:\s*0/)
    expect(open).not.toMatch(/position:\s*absolute/)
    const overlay = rule('.plan-card-open::after')
    expect(overlay).toMatch(/position:\s*absolute/)
    expect(overlay).toMatch(/inset:\s*0/)
    expect(rule('.plan-card-open:focus-visible::after')).toMatch(/outline:\s*2px solid var\(--accent\)/)
  })

  it('the clamp is scoped to the name inside the open button, and the bare class stays unclamped for the example library', () => {
    expect(rule('.plan-card-name')).not.toMatch(/line-clamp|-webkit-box/)
    expect(css).not.toMatch(/^\.plan-card-name \{[^}]*line-clamp/m)
    const clamp = rule('.plan-card-open > .plan-card-name')
    expect(clamp).toMatch(/display:\s*-webkit-box/)
    expect(clamp).toMatch(/-webkit-box-orient:\s*vertical/)
    expect(clamp).toMatch(/-webkit-line-clamp:\s*2/)
    expect(clamp).toMatch(/min-width:\s*0/)
    expect(clamp).toMatch(/overflow:\s*hidden/)
    expect(clamp).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('the former-spouse kind box keeps the direct-child chip protection', () => {
    const kind = rule('.item-row-title > .item-row-kind')
    expect(kind).toMatch(/flex-shrink:\s*0/)
    expect(kind).toMatch(/overflow-wrap:\s*normal/)
    expect(rule('.item-row-title > .type-chip')).toMatch(/flex-shrink:\s*0/)
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

  it('never cuts inside a surrogate pair or a joined emoji at either cap', () => {
    // A four-person family emoji: four code points joined by three ZWJs, 11
    // UTF-16 units. The cap falls after exactly one whole family here, and
    // a second one would not fit, so the cut must stop on that boundary.
    const family = '👩‍👩‍👧‍👦'
    expect(family.length).toBe(11)
    const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
    const name = `${'x'.repeat(PLAN_NAME_MAX_LENGTH - family.length)}${family.repeat(3)}`
    const clamped = clampPlanName(name)
    expect(clamped).toBe(`${'x'.repeat(PLAN_NAME_MAX_LENGTH - family.length)}${family}`)
    expect(clamped.length).toBeLessThanOrEqual(PLAN_NAME_MAX_LENGTH)
    expect(clamped).not.toMatch(loneSurrogate)
    // One unit less room and the whole family is dropped, not split.
    const tight = `${'x'.repeat(PLAN_NAME_MAX_LENGTH - family.length + 1)}${family.repeat(2)}`
    expect(clampPlanName(tight)).toBe('x'.repeat(PLAN_NAME_MAX_LENGTH - family.length + 1))
    // The title cap behaves the same way, then adds its ellipsis.
    const title = planNameForTitle(`${'x'.repeat(PLAN_NAME_TITLE_MAX_LENGTH - 5)}${family.repeat(2)}`)
    expect(title).toBe(`${'x'.repeat(PLAN_NAME_TITLE_MAX_LENGTH - 5)}…`)
    expect(title).not.toMatch(loneSurrogate)
    // A plain surrogate pair (no ZWJ) at the boundary is also kept whole.
    const pair = '😀'
    expect(pair.length).toBe(2)
    const straddle = `${'x'.repeat(PLAN_NAME_MAX_LENGTH - 1)}${pair}`
    expect(clampPlanName(straddle)).toBe('x'.repeat(PLAN_NAME_MAX_LENGTH - 1))
    expect(clampPlanName(straddle)).not.toMatch(loneSurrogate)
  })

  it('shortens the name for the tab title with an ellipsis, and only past the cap', () => {
    const long = 'x'.repeat(PLAN_NAME_TITLE_MAX_LENGTH + 40)
    const title = planNameForTitle(long)
    expect(title.endsWith('…')).toBe(true)
    expect(title.length).toBe(PLAN_NAME_TITLE_MAX_LENGTH + 1)
    expect(planNameForTitle('x'.repeat(PLAN_NAME_TITLE_MAX_LENGTH))).toBe('x'.repeat(PLAN_NAME_TITLE_MAX_LENGTH))
  })
})

describe('survivor floor copy (#535 review)', () => {
  it('the engine floor is a whole number of months, which the copy relies on', () => {
    expect(Number.isInteger(SURVIVOR_MIN_MARRIAGE_YEARS * 12)).toBe(true)
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
