/**
 * Design-QA chrome pins, cluster C (#467, #473). The checkbox-midline rule
 * landed on main through cluster B as well (#516), so the sheet carries one
 * copy and both pin files hold it. Pin the CSS, not a jsdom
 * visual: jsdom computes no layout, so a checkbox sitting on the row's
 * control midline is only observable in the stylesheet. The markup half of
 * this cluster lives in designQa.clusterC.markup.test.tsx.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

/**
 * A sheet with LF line endings whatever the checkout wrote, so multi-line
 * selector pins hold on Windows too, and with its comments removed, so a
 * commented-out rule can never satisfy a pin.
 */
function sheet(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
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
 * of the sheet, a `}`, a `{` (the first rule inside an at-rule block), or the
 * end of a comment. Plain string scanning, no dynamic RegExp.
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
    const boundary =
      before < 0 || source[before] === '}' || source[before] === '{' || source.slice(before - 1, before + 1) === '*/'
    if (!boundary) continue
    return ruleBodyAt(source, at, selector)
  }
  return ruleBodyAt(source, -1, selector)
}

/** [open-brace, close-brace] offsets of every block introduced by `prelude`, matched by brace depth. */
function atRuleBlocks(source: string, prelude: string): Array<[number, number]> {
  const blocks: Array<[number, number]> = []
  let from = 0
  while (from < source.length) {
    const at = source.indexOf(prelude, from)
    if (at < 0) break
    const open = source.indexOf('{', at + prelude.length)
    if (open < 0) break
    let depth = 1
    let i = open + 1
    while (depth > 0 && i < source.length) {
      if (source[i] === '{') depth++
      if (source[i] === '}') depth--
      i++
    }
    blocks.push([open, i - 1])
    from = i
  }
  return blocks
}

describe('Design-QA chrome pins: cluster C', () => {
  it('a form-grid checkbox centres on the row control midline under subgrid (#467, #473)', () => {
    const selector = ".form-grid > .field--checkbox > input[type='checkbox']"
    const body = rule(selector)
    expect(body).toMatch(/align-self:\s*center/)
    // Only inside the subgrid feature query: in the flex fallback the same
    // declaration would centre the box horizontally under its label. The
    // block is found by matching its braces, not by how it is formatted.
    const at = css.indexOf(selector)
    expect(atRuleBlocks(css, '@supports (grid-template-rows: subgrid)').some(([open, close]) => open < at && at < close)).toBe(
      true,
    )
    // It outranks the app-wide checkbox placement without an !important:
    // that rule is one class + one attribute + one element (0,2,1); this one
    // is two classes + one attribute + one element (0,3,1).
    expect(rule(".field--checkbox input[type='checkbox']")).toMatch(/align-self:\s*flex-start/)
  })

  it('the shared control tokens the midline maths relies on are still the app-wide pair', () => {
    const root = rule(':root', indexCss)
    expect(root).toMatch(/--control-height:\s*2\.3rem/)
    expect(root).toMatch(/--control-check-size:\s*1\.1rem/)
  })

  it('a form-grid field can still span the full row, which the Roth Mode select now uses (#477)', () => {
    expect(rule('.form-grid > .field-span-full')).toMatch(/grid-column:\s*1 \/ -1/)
  })
})
