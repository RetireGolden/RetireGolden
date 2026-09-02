/**
 * Design-QA pins, cluster A (#497, #499, #501, #504, #510, #513, #514, #518,
 * #522, #527). Stylesheet and source pins for the parts jsdom cannot observe
 * (a truncating crumb, the print palette, a scroll cue); the rendered
 * behaviour has its own DOM tests beside each surface.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readdirSync, readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

/** A file with LF line endings whatever the checkout wrote, so multi-line pins hold on Windows too (same helper shape as designQa.chrome.test.ts). */
function sheet(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')
}

/** The same, for an absolute path (the source sweeps). */
function text(path: string): string {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

const css = sheet('./planner.css')
const indexCss = sheet('../index.css')
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

/**
 * The six-digit hex value a custom property takes in `source`, found by plain
 * scanning (no dynamic RegExp): `#fff` and `#ffffff` are the same color.
 */
function hexOf(source: string, token: string): string | undefined {
  const at = source.indexOf(`${token}:`)
  if (at < 0) return undefined
  const raw = source.slice(at + token.length + 1).match(/^\s*#([0-9a-fA-F]{3,6})\b/)?.[1]?.toLowerCase()
  if (raw === undefined) return undefined
  return raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw
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
    // The truncation rule must actually win: the older attribute-only rule
    // (0,2,0) sets none of the properties this one relies on, and the block
    // sits after it in the sheet, so (0,2,1) + order decide it. Both are pinned.
    const older = rule(".workspace-breadcrumb [aria-current='page']")
    expect(older).not.toMatch(/display|overflow|white-space|text-overflow|min-width/)
    expect(css.indexOf(".workspace-breadcrumb [aria-current='page'] {")).toBeLessThan(clusterAt)
    expect(css.indexOf(".workspace-breadcrumb li[aria-current='page'] {", clusterAt)).toBeGreaterThan(clusterAt)
  })

  it('print forces the light palette over both dark mechanisms (#504)', () => {
    const printAt = clusterA.indexOf('@media print')
    expect(printAt).toBeGreaterThan(0)
    // The block's body: the selector is the first thing after the media brace.
    const print = clusterA.slice(clusterA.indexOf('{', printAt) + 1)
    const selector = "html:root,\n  html:root[data-theme='dark'],\n  html:root:not([data-theme='light'])"
    const body = rule(selector, print)
    expect(body).toMatch(/color-scheme:\s*light/)
    expect(hexOf(body, '--bg')).toBe('ffffff')
    expect(hexOf(body, '--fg')).toBe('111111')
    expect(hexOf(body, '--surface-1')).toBe('ffffff')
    // Both dark mechanisms in index.css are (0,2,0); the print selectors are
    // (0,2,1), so they win regardless of sheet order.
    expect(indexCss).toMatch(/^:root\[data-theme='dark'\] \{/m)
    expect(indexCss).toMatch(/^ {2}:root:not\(\[data-theme='light'\]\) \{/m)
    // The verdict and chart tokens on paper are the light-theme values, not
    // the brightened dark ones: parsed from index.css, not restated by hand.
    const lightRoot = indexCss.slice(indexCss.indexOf(':root {'), indexCss.indexOf(":root[data-theme='light']"))
    for (const token of ['--accent', '--accent-soft', '--accent-fg', '--good', '--warn', '--bad', ...Array.from({ length: 8 }, (_, i) => `--chart-${i + 1}`)]) {
      const light = hexOf(lightRoot, token)
      const paper = hexOf(body, token)
      expect(light, `${token} in index.css light root`).toBeTruthy()
      expect(paper, `${token} on paper`).toBe(light)
    }
    // The original :root print block stays as it was (hide rules, color-adjust).
    expect(css.slice(0, clusterAt)).toMatch(/@media print \{\s*:root \{\s*--bg: #fff;/)
  })

  it('optional money fields show their blank meaning in the muted token, without a unit chip (#518)', () => {
    const body = rule('.input-affix--optional > input::placeholder', clusterA)
    // Scoped to the opt-in modifier, never to every affixed input.
    expect(clusterA).not.toMatch(/^\.input-affix > input::placeholder/m)
    expect(body).toMatch(/color:\s*var\(--muted\)/)
    expect(body).toMatch(/opacity:\s*1\b/)
    // The chip keeps its width (visibility, not display) so the box does not jump on focus.
    const blank = rule('.input-affix > span.input-affix-unit--blank', clusterA)
    expect(blank).toMatch(/visibility:\s*hidden/)
    // The comment describes the real behaviour: the chip returns on typing, not on focus.
    expect(clusterA).toContain('returns with the first typed')
    expect(clusterA).not.toContain('returns on focus')
    expect(blank).not.toMatch(/display/)
    // Every token either dark mechanism overrides is restated on paper, so a
    // dark-only value (the chevron included) can never leak into print.
    const printBody = rule(
      "html:root,\n  html:root[data-theme='dark'],\n  html:root:not([data-theme='light'])",
      clusterA.slice(clusterA.indexOf('{', clusterA.indexOf('@media print')) + 1),
    )
    const darkBlock = indexCss.slice(indexCss.indexOf(":root[data-theme='dark'] {"), indexCss.indexOf('@media (prefers-color-scheme: dark)'))
    // Indentation-independent, and cross-checked against the light root so a
    // reformat of index.css fails here loudly rather than vacating the sweep.
    const darkTokens = [...darkBlock.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]!)
    const lightRoot = indexCss.slice(indexCss.indexOf(':root {'), indexCss.indexOf(":root[data-theme='light']"))
    expect(darkTokens.length).toBeGreaterThan(15)
    expect(darkTokens).toEqual(expect.arrayContaining(['--bg', '--fg', '--accent', '--chart-8', '--select-chevron', '--shadow-card']))
    for (const token of darkTokens) expect(lightRoot.includes(`${token}:`), `${token} also defined in the light root`).toBe(true)
    for (const token of darkTokens) expect(printBody.includes(`${token}:`), `${token} restated on paper`).toBe(true)
    // The chevron on paper carries the light muted stroke, not the dark one.
    expect(printBody).toMatch(/--select-chevron:\s*url\("data:image\/svg\+xml[^"]*stroke='%235b6470'/)
    // Screen rules in the block use tokens only; the print palette is the one
    // place a hex literal belongs (comments stripped: they cite issue numbers).
    const screen = clusterA
      .slice(clusterA.indexOf('*/') + 2)
      .replace(/@media print \{[\s\S]*?\n\}/, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(screen).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  })
})

describe('Design-QA cluster A: source pins', () => {
  it('the Market success KPI, the Results verdict, and the MC page quote one run (#497)', () => {
    const workspace = sheet('./PlanWorkspace.tsx')
    expect(workspace).toContain('of ${mcPathCount.toLocaleString()} varied markets')
    expect(workspace).toContain('Share of ${mcPathCount.toLocaleString()} varied-market simulations')
    expect(workspace).not.toContain('of ${DEFAULT_PATH_COUNT.toLocaleString()} varied markets')
    // The busy line names the run actually in flight (a registered 10,000-path
    // page run included), never a hard-coded default.
    expect(workspace).toContain('simulating ${mcPathCount.toLocaleString()} markets…')
    expect(workspace).not.toContain('DEFAULT_PATH_COUNT')
    const results = sheet('./ResultsPage.tsx')
    expect(results).toContain('Across {pathCountLabel} varied markets')
    expect(results).not.toContain('PATH_COUNT_LABEL')
    const mc = sheet('./MonteCarloPage.tsx')
    expect(mc).toContain('publishMcHeadline(plan, s)')
    // The store keeps the finest run and the hook never starts a default run
    // once a published one answers for the plan (review round 2).
    const hook = sheet('./useMcSuccessRate.ts')
    expect(hook).toContain('if (current !== undefined && current.pathCount > summary.pathCount) return')
    expect(hook).toContain('if (headline !== undefined) return undefined')
    // The page subscribes to the store (any publisher re-renders it), shares
    // its in-flight run with the hook, and stands its auto-run down when the
    // reader has already started one. The count-less wrapper is gone.
    expect(mc).toContain('const publishedHeadline = useMcHeadline(plan)')
    expect(mc).not.toContain('publishedMcSummary(plan)')
    expect(mc).toContain('if (headlineRun) registerMcHeadlineRun(plan, simulation, paths)')
    expect(mc).toContain('if (runToken.current === scheduledAt) run(DEFAULT_PATH_COUNT)')
    // A superseded headline run still publishes: the publish sits before the token check.
    expect(mc.indexOf('if (headlineRun) publishMcHeadline(plan, s)')).toBeLessThan(mc.indexOf('if (token === runToken.current) {\n            setSummary(s)'))
    // The in-flight result carries its path count, and the store snapshot serves both renders.
    expect(hook).toContain('.then((s) => ({ rate: s.successRate, pathCount: s.pathCount }))')
    expect(hook).toContain('return useSyncExternalStore(subscribe, snapshot, snapshot)')
    expect(hook).toContain('export function useInFlightMcPathCount(plan: Plan): number | undefined')
    expect(hook).toContain('pathCount: current?.pathCount ?? inFlightPathCount ?? DEFAULT_PATH_COUNT')
    // The MC intro names the run in flight, and the hero says the figures on
    // show are the last completed run while a replacement runs.
    expect(mc).toContain('same plan {(summary?.pathCount ?? inFlightPaths).toLocaleString()} times')
    expect(mc).toContain('Showing the last completed run ({summary.pathCount.toLocaleString()} paths) while')
    expect(mc).toContain('registerMcHeadlineRun(plan, simulation, paths)')
    expect(results).not.toContain('keeps verdict copy in sync')
    expect(hook).not.toMatch(/export function useMcSuccessRate\(/)
    expect(hook).toContain('export function useMcHeadline(plan: Plan): MonteCarloSummary | undefined')
    expect(mc).toMatch(/isHeadlineMcConfig\(plan, \{ modelKind, returnVolPct, equityWeightPct, seed, stochasticLongevity, ltcShock \}\)/)
    // The page's controls start on the one constant that defines the headline
    // configuration: no second copy of lognormal / 12 / 60 to drift.
    expect(mc).toContain('useState<ModelKind>(HEADLINE_MC_MODEL.kind)')
    expect(mc).toContain('useState<number>(HEADLINE_MC_MODEL.returnVolPct)')
    expect(mc).toContain('useState<number>(HEADLINE_MC_MODEL.equityWeightPct)')
    expect(mc).not.toMatch(/useState<ModelKind>\('lognormal'\)|useState\(12\)|useState\(60\)/)
    // On mount the page adopts the published run instead of replacing it with a coarser one.
    expect(mc).toContain('? publishedHeadline')
    // No literal "thousand" survives: the intro and the seed tip follow the run.
    expect(mc).not.toMatch(/a thousand times|same thousand markets/)
  })

  it('the Compare delta column formats every row and explains its colors (#499)', () => {
    const compare = sheet('./ComparePlansPage.tsx')
    expect(compare).toContain("unit: 'years'")
    // Money lasts renders a bounded label when one plan never depletes.
    expect(compare).toContain('deltaLabel: lasts.label')
    expect(compare).toContain('one plan never runs out, so the gap is at least or at most that many years')
    expect(compare).toContain("unit: 'pp'")
    expect(compare).toContain('className="field-hint compare-delta-legend"')
    // No hard-coded dash row remains outside MetricRow.
    expect(compare).not.toMatch(/<td>—<\/td>/)
  })

  it('the solver rules column says what its rows are (#510)', () => {
    const solver = sheet('./SpendingSolverPage.tsx')
    expect(solver).toContain('>If your plan spent only this</th>')
    expect(solver).not.toContain('>On your plan<')
  })

  it('survivor timings with nothing on either side are not shown as results (#513)', () => {
    const survivor = sheet('./SurvivorTransitionPage.tsx')
    expect(survivor).toContain('data-survivor-empty="degenerate"')
    // The criterion covers lifetime tax; the shortfall count is deliberately
    // not a criterion (a lone red shortfall count is the finding itself).
    const analysis = sheet('./survivorAnalysis.ts')
    const gate = analysis.slice(analysis.indexOf('export function isDegenerateTiming'), analysis.indexOf('export interface SurvivorAnalysis {'))
    expect(gate.length).toBeGreaterThan(0)
    expect(gate).toContain('nearZero(row.baseLifetimeTax)')
    // Shortfall is symmetric across the transition: survivor shortfall counts
    // only when the last joint year had none (the death introduced it).
    expect(gate).toContain('(nearZero(row.survivorShortfallYears) || row.lastJointYear.shortfall > 0.5)')
    expect(sheet('./survivorAnalysis.ts')).toContain('export function isDegenerateTiming(row: SurvivorScenarioRow): boolean')
    expect(survivor).toContain('live: rows.filter((r) => !isDegenerateTiming(r))')
    // The gate is the row's own content, never the base plan's depletion year:
    // a depleted plan with Social Security keeps its rows.
    expect(survivor).not.toMatch(/deathYear\s*[<>]=?\s*depletionYear/)
    expect(survivor).toMatch(/className="empty-state" data-survivor-empty/)
    // The year the empty state quotes travels in the snapshot with its rows.
    expect(survivor).toContain('depletionYear={analysisDepletionYear}')
    expect(survivor).not.toContain('depletionYear={summary.depletionYear}')
  })

  it('the Relocation tables are named scroll regions, not bare divs (#514)', () => {
    const relocation = sheet('./RelocationComparePage.tsx')
    expect(relocation).not.toContain('table-scroll')
    expect(relocation).toContain('<ScrollRegion label="Ranked relocation results" grow')
    expect(relocation).toContain('<ScrollRegion label={`Drivers for ${f.stateName}`} grow')
    expect(relocation).toContain('<th scope="col" className="nowrap" style={{ textAlign: \'right\' }}>Δ vs staying</th>')
  })

  it('the Strategy screen never points at a Retirement actions card that is not mounted (#518)', () => {
    const strategy = sheet('./sections/StrategySection.tsx')
    expect(strategy).toContain('retirementActionsCardParts(plan, currentStartYear()).mounts')
    expect(strategy).toMatch(/\{retirementActionsCardShown \? \(/)
    // The fallback names every trigger the shared predicate mounts on.
    for (const trigger of ['owned', 'traditional IRA', 'recording IRA contributions', 'a scheduled gift', 'carried in from an', 'older plan']) {
      expect(strategy, trigger).toContain(trigger)
    }
    expect(strategy).toContain('placeholder="No floor"')
    expect(strategy).toContain('placeholder="No reserve"')
    const editor = sheet('./sections/RetirementActionsEditor.tsx')
    expect(editor).toContain('retirementActionsCardParts(plan, currentStartYear())')
    expect(editor).toContain('if (!mounts) return null')
    const fields = sheet('./fields.tsx')
    expect(fields).toContain('placeholder={placeholder}')
    expect(fields).toContain("placeholder !== undefined && text.replace(/^\\$/, '') === '' ? 'input-affix-unit--blank' : undefined")
    expect(fields).toContain("className={placeholder !== undefined ? 'input-affix input-affix--optional' : 'input-affix'}")
  })

  it('wide tables carry a caption and scoped header cells (#504, #522)', () => {
    for (const file of [
      './ReportPage.tsx',
      './ResultsPage.tsx',
      './RelocationComparePage.tsx',
      './ComparePlansPage.tsx',
      './SurvivorTransitionPage.tsx',
      './SpendingSolverPage.tsx',
      './sections/IncomeFloorSection.tsx',
    ]) {
      expect(unscopedHeaderCells(sheet(file)), file).toEqual([])
    }
    // No `table-scroll` wrapper is left anywhere in planner-ui: the class has
    // no stylesheet rule, so it never scrolled; every wide table is a named
    // ScrollRegion (#514, review round 2).
    const srcDir = fileURLToPath(new URL('..', import.meta.url))
    const bare = (readdirSync(srcDir, { recursive: true }) as string[])
      .filter((f: string) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f: string) => text(`${srcDir}/${f}`).includes('table-scroll'))
    expect(bare).toEqual([])
    // The converted tables keep the full-height, boxless rendering the bare
    // div had (`grow`, no border): only horizontal scrolling and its cue are new.
    const converted = [
      ['./SpendingSolverPage.tsx', '<ScrollRegion label="Spending shape comparison" grow style={{ border: \'none\' }}>'],
      ['./SpendingSolverPage.tsx', '<ScrollRegion label="Published withdrawal rules on this plan" grow style={{ border: \'none\' }}>'],
      ['./RelocationComparePage.tsx', '<ScrollRegion label="Ranked relocation results" grow style={{ border: \'none\' }}>'],
      ['./RelocationComparePage.tsx', '<ScrollRegion label={`Drivers for ${f.stateName}`} grow style={{ border: \'none\' }}>'],
      ['./sections/IncomeFloorSection.tsx', '<ScrollRegion label="Nearest real TIPS per rung" grow style={{ border: \'none\' }}>'],
    ] as const
    for (const [file, tag] of converted) expect(sheet(file), `${file}: ${tag}`).toContain(tag)
    const report = sheet('./ReportPage.tsx')
    expect(report.match(/<caption className="sr-only">/g)?.length).toBeGreaterThanOrEqual(8)
    expect(report).toContain('<caption className="sr-only">Year-by-year appendix, nominal dollars</caption>')
    const results = sheet('./ResultsPage.tsx')
    expect(results).toMatch(
      /<ScrollRegion label="Year-by-year table">\s*<table className="year-table">\s*<caption className="sr-only">Year-by-year projection, one row per plan year<\/caption>/,
    )
  })

  it('the Insights preview paints no verdict color on a flat Monte Carlo delta and labels its wait (#527)', () => {
    const card = sheet('./insights/InsightCardView.tsx')
    expect(card).toContain('const mcLabel = mcDelta === null ? null : formatMcDelta(mcDelta)')
    expect(card).not.toContain("mcDelta >= 0 ? 'delta-pos'")
    expect(card).toMatch(/mcLabel\.flat \? \(\s*'no change'\s*\) : \(\s*<span className=\{mcLabel\.good \? 'delta-pos' : 'delta-neg'\}>\{mcLabel\.text\}<\/span>/)
    expect(card).toContain('<span className="muted" role="status" aria-busy="true">')
    expect(card).toContain("{loadingExact ? 'Previewing…' : expanded ? 'Hide preview' : 'Preview impact'}")
    // Enabled (Hide works) but busy for as long as either phase runs.
    expect(card).toContain('aria-busy={loadingExact || loadingMc || undefined}')
    // The wait has visible text, not only an aria-label.
    expect(card).toContain('<p className="small muted">Re-simulating this plan…</p>')
    expect(rule('.insight-preview-wait', clusterA)).toMatch(/display:\s*grid/)
    expect(card).toContain('const anyDeltaDefined = definedDollarDeltas.length > 0 || card.impact.successRateDeltaPct !== undefined')
    // Preview results are keyed to the plan they were computed for, so a stale
    // delta never sits beside a newer plan's depletion year.
    expect(card).toContain('const exactImpact = exactImpactFor !== null && exactImpactFor.plan === plan ? exactImpactFor.impact : null')
    expect(card).toContain('const mcDelta = mcDeltaFor !== null && mcDeltaFor.plan === plan ? mcDeltaFor.delta : null')
    // The flat note states two facts and claims no cause; it needs at least
    // one defined dollar delta and a settled Monte Carlo line if the card has one.
    expect(card).toContain('Every delta shown is zero. The base plan runs out of money in {baseDepletionYear}.')
    expect(card).toContain('const mcSettledFlat = card.impact.successRateDeltaPct === undefined ? true : !loadingMc && mcFlat')
    expect(card).toContain('anyDeltaDefined && definedDollarDeltas.every((v) => v === 0) && mcSettledFlat')
    // The button is released once the exact dollar deltas land, before the
    // slower Monte Carlo pair starts.
    const release = card.indexOf('setLoadingExact(false)')
    const mcPair = card.indexOf('await Promise.all([')
    expect(release).toBeGreaterThan(0)
    expect(mcPair).toBeGreaterThan(release)
  })
})

describe('Design-QA cluster A: pin hygiene', () => {
  it('reads every file through a CRLF-normalising helper, so the pins hold on a Windows checkout', () => {
    for (const file of ['./designQa.clusterA.test.ts', './designQa.chrome.test.ts']) {
      const reads = sheet(file).split('\n').filter((line) => line.includes('readFileSync' + '('))
      expect(reads.length, file).toBeGreaterThan(0)
      for (const line of reads) expect(line, `${file}: ${line.trim()}`).toContain(".replace(/\\r\\n/g, '\\n')")
    }
  })
})
