/**
 * Stylesheet and source pins for Design-QA cluster H (#489, #511, #512,
 * #523, #526, #553). The rendered half is designQa.clusterH.markup.test.tsx.
 *
 * A row head holds a title and a Remove control side by side. When the title
 * wraps (a long goal label, #526) the control used to centre itself on the
 * two-line block, off the first line; it now sits on the first line's
 * baseline, and the title can wrap inside its own box rather than push the
 * control out of the row. The capital-loss carryforward is wired to its
 * schema path like every other money field (#553), so the engine's floor
 * reaches it while typing instead of a clamp rewriting the entry to 0.
 */
import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

import { boundsForPath } from './schemaBounds'

/**
 * A sheet with LF line endings whatever the checkout wrote, so multi-line
 * pins hold on Windows too, and with its comments removed, so a commented-out
 * rule can never satisfy a pin.
 */
function sheet(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

const css: string = sheet('./planner.css')

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
 * of the sheet, a `}`, or a `{`. Plain string scanning, no dynamic RegExp.
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
    const boundary = before < 0 || source[before] === '}' || source[before] === '{'
    if (!boundary) continue
    return ruleBodyAt(source, at, selector)
  }
  return ruleBodyAt(source, -1, selector)
}

describe('row head with a wrapping title (#526)', () => {
  it('aligns the title and its Remove control on the first baseline, not the centre of a wrapped block', () => {
    const head = rule('.item-row-head')
    expect(head).toMatch(/align-items: baseline;/)
    expect(head).not.toMatch(/align-items: center;/)
    // The head's baseline is its first item's, the title's, whose baseline is
    // its chip's: centred, the chip beside a two-line title sat between the
    // lines and took Remove with it, so the title is baseline-aligned too.
    const title = rule('.item-row-title')
    expect(title).toMatch(/align-items: baseline;/)
    expect(title).not.toMatch(/align-items: center;/)
  })

  it('lets the title wrap inside its own box instead of pushing the control out of the row', () => {
    const title = rule('.item-row-title')
    // A flex item's min-width is its content by default, which is what pushed
    // Remove out; the text then wraps beside the chip (not onto a second flex
    // line, so the title stays a single-line flex row).
    expect(title).toMatch(/min-width: 0;/)
    expect(title).not.toMatch(/flex-wrap: wrap;/)
    expect(title).toMatch(/overflow-wrap: anywhere;/)
    // The control keeps its width when the title is long, and so does the
    // chip: `overflow-wrap: anywhere` inherits and would otherwise let the
    // chip shrink to a character and wrap "GOAL" onto two lines.
    expect(rule('.item-row-head > .btn-ghost')).toMatch(/flex-shrink: 0;/)
    const chip = rule('.item-row-title > .type-chip')
    expect(chip).toMatch(/flex-shrink: 0;/)
    expect(chip).toMatch(/overflow-wrap: normal;/)
  })
})

describe('capital-loss carryforward (#553)', () => {
  const strategy = sheet('./sections/StrategySection.tsx')

  it('is wired to its schema path, and no longer clamps the entry to 0 in the commit', () => {
    expect(strategy).toContain('path="household.capitalLossCarryforward"')
    expect(strategy).not.toContain('d.household.capitalLossCarryforward = Math.max(0, v ?? 0)')
  })

  it("carries the engine's floor, and no ceiling, as the schema states it", () => {
    // `nonNegative` in packages/engine/src/model/plan.ts; the bounds map is
    // generated from the engine's JSON Schema and drift-checked.
    expect(boundsForPath('household.capitalLossCarryforward')).toEqual({ min: 0 })
  })
})
