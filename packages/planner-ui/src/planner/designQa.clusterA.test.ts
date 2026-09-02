/**
 * Design-QA pins, cluster A (#497, #499, #501, #504, #510, #513, #514, #518,
 * #522, #527). Stylesheet and source pins for the parts jsdom cannot observe
 * (a truncating crumb, the print palette, a scroll cue); the rendered
 * behaviour has its own DOM tests beside each surface.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')
}

const css = read('./planner.css')
const indexCss = read('../index.css')
// Everything this cluster added sits in one commented block at the end of the sheet.
const clusterAt = css.indexOf('Design QA cluster A')
const clusterA = css.slice(clusterAt)

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

/** Body of the first rule whose selector list is exactly `selector` (see designQa.chrome.test.ts). */
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

/** Every `<th` inside a `<thead>` of the file carries scope="col". */
function unscopedHeaderCells(source: string): string[] {
  const out: string[] = []
  for (const block of source.match(/<thead>[\s\S]*?<\/thead>/g) ?? []) {
    for (const th of block.match(/<th(?=[\s>])[^>]*>/g) ?? []) {
      if (!/\bscope="col"/.test(th)) out.push(th)
    }
  }
  return out
}

describe('Design-QA cluster A: stylesheet pins', () => {
  it('appends its rules as one block at the end of the sheet and touches nothing above', () => {
    expect(clusterAt).toBeGreaterThan(0)
    expect(css.indexOf('Design QA cluster A', clusterAt + 1)).toBe(-1)
    // The rules this block overrides keep their original bodies above it.
    expect(rule('.workspace-breadcrumb ol')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('the breadcrumb truncates a long plan name like the H1 under it (#501)', () => {
    expect(rule('.workspace-breadcrumb ol', clusterA)).toMatch(/flex-wrap:\s*nowrap/)
    expect(rule('.workspace-breadcrumb li:first-child', clusterA)).toMatch(/flex:\s*0 0 auto/)
    const current = rule(".workspace-breadcrumb li[aria-current='page']", clusterA)
    expect(current).toMatch(/text-overflow:\s*ellipsis/)
    expect(current).toMatch(/white-space:\s*nowrap/)
    expect(current).toMatch(/overflow:\s*hidden/)
    expect(current).toMatch(/min-width:\s*0/)
    // A linked crumb (the report's plan-name crumb) clips on the anchor, not
    // on an ancestor, so the focus ring is never cut.
    const link = rule('.workspace-breadcrumb li + li > a', clusterA)
    expect(link).toMatch(/text-overflow:\s*ellipsis/)
    expect(link).toMatch(/overflow:\s*hidden/)
    expect(rule('.workspace-breadcrumb li + li', clusterA)).not.toMatch(/overflow/)
    // The separator glyph rule is untouched: it still draws the "/".
    expect(rule('.workspace-breadcrumb li + li::before')).toMatch(/content:\s*'\/'/)
  })

  it('print forces the light palette over both dark mechanisms (#504)', () => {
    const printAt = clusterA.indexOf('@media print')
    expect(printAt).toBeGreaterThan(0)
    // The block's body: the selector is the first thing after the media brace.
    const print = clusterA.slice(clusterA.indexOf('{', printAt) + 1)
    const selector = "html:root,\n  html:root[data-theme='dark'],\n  html:root:not([data-theme='light'])"
    const body = rule(selector, print)
    expect(body).toMatch(/color-scheme:\s*light/)
    expect(body).toMatch(/--bg:\s*#fff\b/)
    expect(body).toMatch(/--fg:\s*#111\b/)
    expect(body).toMatch(/--surface-1:\s*#fff\b/)
    // Both dark mechanisms in index.css are (0,2,0); the print selectors are
    // (0,2,1), so they win regardless of sheet order.
    expect(indexCss).toMatch(/^:root\[data-theme='dark'\] \{/m)
    expect(indexCss).toMatch(/^ {2}:root:not\(\[data-theme='light'\]\) \{/m)
    // The verdict and chart tokens on paper are the light-theme values, not
    // the brightened dark ones: parsed from index.css, not restated by hand.
    const lightRoot = indexCss.slice(indexCss.indexOf(':root {'), indexCss.indexOf(":root[data-theme='light']"))
    // #fff and #ffffff are the same color; compare the six-digit form.
    const hex = (source: string, token: string): string | undefined => {
      const raw = source.match(new RegExp(`${token}:\\s*#([0-9a-fA-F]{3,6})\\b`))?.[1]?.toLowerCase()
      return raw === undefined ? undefined : raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw
    }
    for (const token of ['--accent', '--accent-soft', '--accent-fg', '--good', '--warn', '--bad', ...Array.from({ length: 8 }, (_, i) => `--chart-${i + 1}`)]) {
      const light = hex(lightRoot, token)
      const paper = hex(body, token)
      expect(light, `${token} in index.css light root`).toBeTruthy()
      expect(paper, `${token} on paper`).toBe(light)
    }
    // The original :root print block stays as it was (hide rules, color-adjust).
    expect(css.slice(0, clusterAt)).toMatch(/@media print \{\s*:root \{\s*--bg: #fff;/)
  })

  it('optional money fields show their blank meaning in the muted token (#518)', () => {
    const body = rule('.input-affix > input::placeholder', clusterA)
    expect(body).toMatch(/color:\s*var\(--muted\)/)
    expect(body).toMatch(/opacity:\s*1\b/)
    // Screen rules in the block use tokens only; the print palette is the one
    // place a hex literal belongs (comments stripped: they cite issue numbers).
    const screen = clusterA.slice(clusterA.indexOf('*/') + 2, clusterA.indexOf('@media print')).replace(/\/\*[\s\S]*?\*\//g, '')
    expect(screen).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  })
})

describe('Design-QA cluster A: source pins', () => {
  it('the Market success KPI and the Results verdict quote the run they show (#497)', () => {
    const workspace = read('./PlanWorkspace.tsx')
    expect(workspace).toContain('of ${mcPathCount.toLocaleString()} varied markets')
    expect(workspace).toContain('Share of ${mcPathCount.toLocaleString()} varied-market simulations')
    expect(workspace).not.toContain('of ${DEFAULT_PATH_COUNT.toLocaleString()} varied markets')
    // The busy line still names the default run that is about to start.
    expect(workspace).toContain('simulating ${DEFAULT_PATH_COUNT.toLocaleString()} markets…')
    const results = read('./ResultsPage.tsx')
    expect(results).toContain('Across {pathCountLabel} varied markets')
    expect(results).not.toContain('PATH_COUNT_LABEL')
    const mc = read('./MonteCarloPage.tsx')
    expect(mc).toContain('publishMcHeadline(plan, { rate: s.successRate, pathCount: s.pathCount })')
    expect(mc).toMatch(/isHeadlineMcConfig\(plan, \{ modelKind, returnVolPct, equityWeightPct, seed, stochasticLongevity, ltcShock \}\)/)
    // No literal "thousand" survives: the intro and the seed tip follow the run.
    expect(mc).not.toMatch(/a thousand times|same thousand markets/)
    expect(mc).toContain('same plan {(summary?.pathCount ?? DEFAULT_PATH_COUNT).toLocaleString()} times')
  })

  it('the Compare delta column formats every row and explains its colors (#499)', () => {
    const compare = read('./ComparePlansPage.tsx')
    expect(compare).toContain("unit: 'years'")
    expect(compare).toContain("unit: 'pp'")
    expect(compare).toContain('className="field-hint compare-delta-legend"')
    // No hard-coded dash row remains outside MetricRow.
    expect(compare).not.toMatch(/<td>—<\/td>/)
  })

  it('the solver rules column says what its rows are (#510)', () => {
    const solver = read('./SpendingSolverPage.tsx')
    expect(solver).toContain('>If your plan spent only this</th>')
    expect(solver).not.toContain('>On your plan<')
  })

  it('survivor timings after depletion are not shown as results (#513)', () => {
    const survivor = read('./SurvivorTransitionPage.tsx')
    expect(survivor).toContain('data-survivor-empty="depleted"')
    expect(survivor).toContain('const { summary } = useProjection(plan)')
    expect(survivor).toMatch(/className="empty-state" data-survivor-empty/)
  })

  it('the Relocation tables are named scroll regions, not bare divs (#514)', () => {
    const relocation = read('./RelocationComparePage.tsx')
    expect(relocation).not.toContain('table-scroll')
    expect(relocation).toContain('<ScrollRegion label="Ranked relocation results">')
    expect(relocation).toContain('<ScrollRegion label={`Drivers for ${f.stateName}`}>')
    expect(relocation).toContain('<th scope="col" className="nowrap" style={{ textAlign: \'right\' }}>Δ vs staying</th>')
  })

  it('the Strategy screen never points at a Retirement actions card that is not mounted (#518)', () => {
    const strategy = read('./sections/StrategySection.tsx')
    expect(strategy).toContain('retirementActionsCardParts(plan, currentStartYear()).mounts')
    expect(strategy).toMatch(/\{retirementActionsCardShown \? \(/)
    expect(strategy).toContain('placeholder="No floor"')
    expect(strategy).toContain('placeholder="No reserve"')
    const editor = read('./sections/RetirementActionsEditor.tsx')
    expect(editor).toContain('retirementActionsCardParts(plan, currentStartYear())')
    expect(editor).toContain('if (!mounts) return null')
    const fields = read('./fields.tsx')
    expect(fields).toContain('placeholder={placeholder}')
  })

  it('wide tables carry a caption and scoped header cells (#504, #522)', () => {
    for (const file of ['./ReportPage.tsx', './ResultsPage.tsx', './RelocationComparePage.tsx', './ComparePlansPage.tsx']) {
      expect(unscopedHeaderCells(read(file)), file).toEqual([])
    }
    const report = read('./ReportPage.tsx')
    expect(report.match(/<caption className="sr-only">/g)?.length).toBeGreaterThanOrEqual(8)
    expect(report).toContain('<caption className="sr-only">Year-by-year appendix, nominal dollars</caption>')
    const results = read('./ResultsPage.tsx')
    expect(results).toMatch(
      /<ScrollRegion label="Year-by-year table">\s*<table className="year-table">\s*<caption className="sr-only">Year-by-year projection, one row per plan year<\/caption>/,
    )
  })

  it('the Insights preview paints no verdict color on a flat Monte Carlo delta and labels its wait (#527)', () => {
    const card = read('./insights/InsightCardView.tsx')
    expect(card).toContain('const mcFlat = mcDelta !== null && Math.abs(mcDelta) < 0.05')
    expect(card).not.toContain("mcDelta >= 0 ? 'delta-pos'")
    expect(card).toMatch(/mcFlat \? \(\s*'no change'\s*\) : \(\s*<span className=\{mcDelta > 0 \? 'delta-pos' : 'delta-neg'\}>/)
    expect(card).toContain('<span className="muted" role="status" aria-busy="true">')
    expect(card).toContain("{loadingExact ? 'Previewing…' : expanded ? 'Hide preview' : 'Preview impact'}")
    expect(card).toContain('aria-busy={loadingExact || undefined}')
    expect(card).toContain('aria-label="Re-simulating this plan"')
    expect(card).toContain('with or without this change, so every delta is zero')
  })
})
