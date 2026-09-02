/**
 * Stylesheet and source pins for the product decisions Nathan answered on #495
 * on 2026-09-02 (#465, #486, #495, #500, #502, #508, #524, #545, #548, #550,
 * #553, #572).
 *
 * jsdom computes no layout, so what a chrome pin can hold is the rule that
 * decides the geometry. The measurements that chose the fixed track were taken
 * in a real browser on /plan/:id/spending, /assumptions and /accounts, and are
 * recorded above the pin. The behaviour halves live in warnings.test.ts (the
 * bands), designQa.decisions.markup.test.tsx (what renders), and
 * packages/engine/src/model/plan.conversionWindow.test.ts (the engine rules).
 */
import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

/** A source with LF line endings whatever the checkout wrote, so multi-line pins hold on Windows too. */
function sheet(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')
}

const css: string = sheet('./planner.css')

/** The body of the rule whose selector list is exactly `selector`. */
function rule(selector: string, source = css): string {
  const at = source.indexOf(`${selector} {`)
  expect(at, `rule not found: ${selector}`).toBeGreaterThanOrEqual(0)
  const open = source.indexOf('{', at)
  return source.slice(open + 1, source.indexOf('}', open))
}

describe('D9 (#465): one fixed column rhythm for every form grid', () => {
  // Measured on /plan/example:example-couple/spending in Chromium with this
  // branch's stylesheet. Before: the same field was 215.94px at the top of the
  // card and 204.6px inside an item row at 1024, and 211.94px vs 200.6px at
  // 768 — the item row's 1rem inset, spent by a flexible track. After: 184px in
  // both, at both widths, and on Assumptions' nested wells too. At 375 the
  // track goes back to stretching (293px / 259px, no horizontal scroll).
  it('the grid lays fixed tracks, not flexible ones, through one custom property', () => {
    const body = rule('.form-grid')
    expect(body).toMatch(/--form-col:\s*11\.5rem/)
    expect(body).toMatch(/grid-template-columns:\s*repeat\(auto-fill, var\(--form-col\)\)/)
    // A flexible track is what made the two grids disagree; it must not return.
    expect(body).not.toMatch(/minmax/)
    expect(body).toMatch(/gap:\s*0\.8rem 1\.1rem/)
  })

  it('a phone stretches the single track instead of leaving a gutter', () => {
    const at = css.indexOf('@media (max-width: 640px) {\n  .form-grid > .field-with-action--wide {')
    expect(at).toBeGreaterThanOrEqual(0)
    const phone = css.slice(at, css.indexOf('\n}\n', at))
    expect(rule('.form-grid', phone)).toMatch(/--form-col:\s*minmax\(11\.5rem, 1fr\)/)
  })

  it('a nested well no longer sets a third column width of its own', () => {
    expect(css).not.toMatch(/repeat\(auto-fit, minmax\(11\.5rem, 1fr\)\)/)
    // The two marker classes carried nothing but that override, so they are
    // gone from the markup rather than left dangling with no rule behind them.
    expect(css).not.toContain('nested-control-grid')
    expect(css).not.toContain('nested-phase-grid')
    for (const file of ['AllocationPanel', 'AssumptionsSection', 'RetirementAccountEditors', 'AccountEditorSharedFields']) {
      const source = sheet(`./sections/${file}.tsx`)
      expect(source, file).not.toContain('nested-control-grid')
      expect(source, file).not.toContain('nested-phase-grid')
    }
  })
})

describe('D1, D2, D3, D7, D4 (#495): the soft warning is a note, never a fault', () => {
  it('reads in the warn token in the callout treatment, one step down from the error', () => {
    const body = rule('.field-warning')
    expect(body).toMatch(/border:\s*1px solid color-mix\(in srgb, var\(--warn\)/)
    expect(body).toMatch(/background:\s*color-mix\(in srgb, var\(--warn\)/)
    // Not the danger token: the plan holds the value.
    expect(body).not.toMatch(/var\(--bad\)/)
    // Never a colored side-stripe (DESIGN.md, Callouts).
    expect(body).not.toMatch(/border-left:/)
    // Both themes define --warn, so the rule needs no theme branch of its own.
    const index = sheet('../index.css')
    expect(index.match(/--warn:/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('the field renders it as a status, and the control never goes aria-invalid for it', () => {
    const fields = sheet('./fields.tsx')
    expect(fields).toContain("import { warningFor } from './warnings'")
    expect(fields).toContain('const warning = warningFor(path, value)')
    expect(fields).toMatch(/\{!error && !note && warning \? \(/)
    expect(fields).toMatch(/className="field-warning" id=\{`\$\{id\}-warning`\} role="status"/)
    // aria-invalid is set from `error` alone; the warning only describes.
    expect(fields).not.toMatch(/aria-invalid=\{[^}]*warning/)
    expect(fields).toMatch(/error \? `\$\{id\}-error` : notKept \? `\$\{id\}-note` : warning && `\$\{id\}-warning`/)
    expect(fields).toMatch(/error \? `\$\{id\}-error` : adjustedNote \? `\$\{id\}-note` : warning && `\$\{id\}-warning`/)
  })

  it('the thresholds carry the decision they came from, so a later edit has to say why', () => {
    const warnings = sheet('./warnings.ts')
    expect(warnings).toContain('#495')
    expect(warnings).toContain('decision list D1, D2, D3, D7')
    expect(warnings).toContain('ratePct: 30')
    expect(warnings).toContain('growthPctMax: 50')
    expect(warnings).toContain('sharePctMax: 100')
    expect(warnings).toContain('amountDollars: 100_000_000')
    expect(warnings).toContain('deductionDollars: 1_000_000')
  })
})

describe('D6 (#508): the bracket target is a list of published rates', () => {
  it('the strategy card offers the pack rates rather than a free number box', () => {
    const strategy = sheet('./sections/StrategySection.tsx')
    expect(strategy).toContain("import { bracketOptions } from '../bracketOptions'")
    expect(strategy).toContain('options={bracketOptions(rc.startYear, rc.targetValue)}')
    expect(strategy).toContain('path="strategies.rothConversion.targetValue"')
    // The rates are read from the pack, never written down in the app.
    const options = sheet('./bracketOptions.ts')
    expect(options).toContain("import { packForYear } from '@retiregolden/engine/params'")
    expect(options).not.toMatch(/\b(10|12|22|24|32|35|37)\s*,\s*(10|12|22|24|32|35|37)\b/)
  })
})

describe('D8 (#486): neither guaranteed-income card carries an estate beneficiary', () => {
  it('the shared control stands down for a pension and an annuity, with a note in its place', () => {
    const shared = sheet('./sections/AccountEditorSharedFields.tsx')
    expect(shared).toContain("if (account.type === 'debt' || account.type === 'property') return null")
    expect(shared).toContain("if (account.type === 'pension' || account.type === 'annuity') {")
    expect(shared).toContain('Guaranteed income does not pass to the estate.')
  })
})
