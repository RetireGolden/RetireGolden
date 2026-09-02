/**
 * Design-QA pins, cluster G (#514, #465). Pin the stylesheet and the
 * sources, not a jsdom visual: jsdom computes no layout, so a two-column
 * select or a padded, scrollable results table is only observable in the
 * sheet and in which chrome a page reaches for. Markup-level checks for this
 * cluster live in designQa.clusterG.markup.test.tsx.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readdirSync, readFileSync, statSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

/**
 * A file with LF line endings whatever the checkout wrote (this repo is
 * checked out CRLF on Windows), with block comments removed so a
 * commented-out rule can never satisfy a pin.
 */
function sheet(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

/** A source file with LF line endings; comments kept (a pin may read one). */
function source(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')
}

/** Every file under `dir` (recursive) whose name matches `pattern`, as absolute paths. */
function walk(dir: string, pattern: RegExp): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir) as string[]) {
    const full = `${dir}/${name}`
    if (statSync(full).isDirectory()) out.push(...walk(full, pattern))
    else if (pattern.test(name)) out.push(full)
  }
  return out
}

const css: string = sheet('./planner.css')
const srcDir: string = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '')
/** Forward slashes throughout, so the walk's paths and this file's compare on Windows too. */
const slash = (p: string): string => p.replace(/\\/g, '/')
const thisPin: string = slash(fileURLToPath(import.meta.url))

describe('Design QA cluster G: Relocation results table (#514)', () => {
  it('no source or stylesheet under src uses .table-scroll, a class nothing defines', () => {
    // The class had no rule anywhere, so the tables inside it rendered with
    // UA defaults: 1px cell padding, figures flush against the card edge,
    // three-line headers. Every wide table takes the ScrollRegion chrome.
    // The sweep covers every source extension and every stylesheet under
    // src (import, learn, home, not only the planner tree), so the defect
    // cannot come back through another page or a new sheet. Design-QA pins
    // (this one, and cluster A's narrower sweep on main) spell the class to
    // forbid it, so they are the only files left out.
    const stylesheets = walk(srcDir, /\.css$/)
    expect(stylesheets.length).toBeGreaterThanOrEqual(3)
    for (const s of stylesheets) expect(readFileSync(s, 'utf8') as string, s).not.toContain('table-scroll')
    const isPin = (f: string) => /\/designQa\.[^/]*\.test\.tsx?$/.test(slash(f))
    expect(isPin(thisPin)).toBe(true)
    const offenders = walk(srcDir, /\.(ts|tsx|js|jsx|mjs)$/)
      .filter((f: string) => !isPin(f))
      .filter((f: string) => (readFileSync(f, 'utf8') as string).includes('table-scroll'))
    expect(offenders).toEqual([])
  })

  it('Relocation Compare renders its ranked results and driver drill-down as named scroll regions of year-tables', () => {
    const page = source('./RelocationComparePage.tsx')
    expect(page).toContain("import { ScrollRegion } from './ScrollRegion'")
    expect(page).toContain('<ScrollRegion label="Ranked relocation results" grow')
    expect(page).toContain('<ScrollRegion label={`Drivers for ${f.stateName}`} grow')
    // Every table on the page carries the app's table chrome; none is bare.
    expect(page).not.toMatch(/<table>/)
    expect(page.match(/<table className="year-table">/g)?.length).toBe(2)
    // The rule column is prose, not a figure; so is a row's error message.
    expect(page).toContain('<th scope="col" className="year-table-text">Rule</th>')
    expect(page).toMatch(/<td colSpan=\{result\.monteCarlo \? 5 : 4\} className="year-table-text"/)
  })

  it('the sibling tables that shared the dead wrap (Spending solver, Income floor) took the same treatment', () => {
    const solver = source('./SpendingSolverPage.tsx')
    expect(solver).toContain('<ScrollRegion label="Spending shape comparison" grow')
    expect(solver).toContain('<ScrollRegion label="Published withdrawal rules on this plan" grow')
    expect(solver).not.toMatch(/<table>/)
    expect(solver.match(/<table className="year-table">/g)?.length).toBe(2)
    expect(solver).toContain('<th scope="col" className="year-table-text">If your plan spent only this</th>')

    const floor = source('./sections/IncomeFloorSection.tsx')
    expect(floor).toContain('<ScrollRegion label="Nearest real TIPS per rung" grow')
    expect(floor).toContain('<ScrollRegion label={`Buy-list: ${ladder.name}`}>')
    expect(floor).not.toMatch(/<table>/)
    expect(floor.match(/<table className="year-table">/g)?.length).toBe(2)
    expect(floor).toContain('<th scope="col" className="year-table-text">Nearest real TIPS (CUSIP)</th>')
  })

  it('help copy inside a year-table header keeps prose casing (the header transform stops at the bubble)', () => {
    // The reset covers the ⓘ trigger (a literal "i" that read as "I") as
    // well as the bubble.
    const at = css.indexOf('.year-table thead th .help-tip,\n.year-table thead th .help-tip-bubble {')
    expect(at).toBeGreaterThanOrEqual(0)
    const body = css.slice(at, css.indexOf('}', at))
    expect(body).toMatch(/text-transform:\s*none/)
    expect(body).toMatch(/letter-spacing:\s*normal/)
    // Still needed: the header rule it overrides is what uppercases.
    const header = css.indexOf('.year-table thead th {')
    expect(css.slice(header, css.indexOf('}', header))).toMatch(/text-transform:\s*uppercase/)
    // Relocation's headers are the ones carrying help copy.
    expect(source('./RelocationComparePage.tsx')).toMatch(/<th scope="col"[^>]*>\s*Lifetime state\+local tax <HelpTip/)
  })

  it('the Import map step set-aside list takes a stylesheet class, not inline spacing', () => {
    const at = css.indexOf('.import-set-aside {')
    expect(at).toBeGreaterThanOrEqual(0)
    const body = css.slice(at, css.indexOf('}', at))
    expect(body).toMatch(/padding-left:\s*1\.2rem/)
    expect(body).toMatch(/max-width:\s*78ch/)
  })

  it('the prose-column class the tables use is left-aligned and wraps', () => {
    const at = css.indexOf('.year-table th.year-table-text,\n.year-table td.year-table-text {')
    expect(at).toBeGreaterThanOrEqual(0)
    const body = css.slice(at, css.indexOf('}', at))
    expect(body).toMatch(/text-align:\s*left/)
    expect(body).toMatch(/white-space:\s*normal/)
  })

  it('the year-table cells the Relocation tables now use carry real padding and right-aligned figures', () => {
    const at = css.indexOf('.year-table th,\n.year-table td {')
    expect(at).toBeGreaterThanOrEqual(0)
    const body = css.slice(at, css.indexOf('}', at))
    expect(body).toMatch(/padding:\s*0\.4rem 0\.7rem/)
    expect(body).toMatch(/text-align:\s*right/)
  })
})

describe('Design QA cluster G: Goal Flexibility select (#465)', () => {
  it('a wide field spans two form-grid columns and collapses to the full row on phones', () => {
    expect(css).toContain('.form-grid > .field--wide {\n  grid-column: span 2;\n}')
    // The phone collapse sits inside the same 640px block as the compound field's.
    const media = css.indexOf('@media (max-width: 640px) {\n  .form-grid > .field-with-action--wide {')
    expect(media).toBeGreaterThanOrEqual(0)
    const block = css.slice(media, css.indexOf('\n}\n', media))
    expect(block).toContain('.form-grid > .field--wide {\n    grid-column: 1 / -1;\n  }')
  })

  it('the Goal row Flexibility select asks for the wide treatment; its sibling Layer select does not', () => {
    const page = source('./sections/SpendingSection.tsx')
    const flexibility = page.indexOf('label="Flexibility"')
    expect(flexibility).toBeGreaterThanOrEqual(0)
    const flexibilityProps = page.slice(flexibility, page.indexOf('options=', flexibility))
    expect(flexibilityProps).toMatch(/\n\s+wide\n/)
    const layer = page.indexOf('label="Layer"')
    expect(layer).toBeGreaterThanOrEqual(0)
    const layerProps = page.slice(layer, page.indexOf('options=', layer))
    expect(layerProps).not.toMatch(/\n\s+wide\n/)
  })
})

// The Import map step's set-aside sentence and list are covered by a rendered
// test, import/ImportPage.setAsideRows.test.tsx, not a source pin.
