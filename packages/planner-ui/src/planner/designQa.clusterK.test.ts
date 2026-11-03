/**
 * Design-QA cluster K, source half (#766, #767, #777, #778). jsdom computes
 * no layout, so the 375px overflow and the hover state are pinned in the
 * stylesheet here; the real-browser check is the app e2e
 * `phone-overflow.spec.ts`, which loads the Example couple at 375 in both
 * themes and asserts the page never scrolls sideways.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readdirSync, readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

function sheet(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')
}

const css: string = sheet('./planner.css')

/** Body of the first rule whose whole selector list is `selector` (see designQa.chrome.test.ts). */
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
    if (!(before < 0 || source[before] === '}' || source.slice(before - 1, before + 1) === '*/' || source[before] === '{')) continue
    const open = after
    let depth = 1
    let i = open + 1
    while (depth > 0 && i < source.length) {
      if (source[i] === '{') depth++
      if (source[i] === '}') depth--
      i++
    }
    return source.slice(open + 1, i - 1)
  }
  throw new Error(`rule ${selector} not found`)
}

describe('Printable report at phone width (#766)', () => {
  it('the action row is capped at its container so its buttons wrap', () => {
    expect(rule('.report-actions')).toMatch(/flex-wrap:\s*wrap/)
    expect(rule('.report-actions')).toMatch(/max-width:\s*100%/)
  })

  it('headline cards use shrinkable tracks and go two-up on a phone screen', () => {
    expect(rule('.report-kpis')).toMatch(/grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
    expect(css).toMatch(
      /@media screen and \(max-width: 640px\) \{\s*\.report-kpis \{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/,
    )
  })

  it('every section table on the report scrolls inside its own region', () => {
    const page = sheet('./ReportPage.tsx')
    const tables = page.match(/<table className="report-table[^"]*">/g) ?? []
    expect(tables.length).toBeGreaterThanOrEqual(8)
    // Each table opening is directly preceded by a ScrollRegion opening.
    const bare = page.match(/^(?!\s*<ScrollRegion\b).*\n\s*<table className="report-table/gm) ?? []
    expect(bare).toEqual([])
    expect(page.match(/className="report-table-wrap"/g)).toHaveLength(6)
    const wrap = rule('.report-table-wrap')
    expect(wrap).toMatch(/--scroll-cover:\s*var\(--bg\)/)
    expect(wrap).toMatch(/border:\s*0/)
    // The shared wrap paints its cue covers from that variable, surface by default.
    expect(rule('.year-table-wrap')).toMatch(/background:\s*var\(--scroll-cover, var\(--surface-1\)\)/)
    expect(rule('.year-table-wrap').match(/var\(--scroll-cover, var\(--surface-1\)\) 40%/g)).toHaveLength(2)
  })

  it('strategy labels come from the one formatter on both report surfaces', () => {
    for (const rel of ['./ReportPage.tsx', '../report/reportModel.ts']) {
      const source = sheet(rel)
      expect(source, rel).toContain("from '")
      expect(source, rel).toMatch(/rothConversionSummary\(plan\.strategies\.rothConversion\)/)
      expect(source, rel).toMatch(/withdrawalOrderSummary\(plan\.strategies\.withdrawalOrder\)/)
      expect(source, rel).not.toMatch(/\$\{rc\.target\}/)
    }
    expect(sheet('./assumptionsExport.ts')).not.toMatch(/\$\{rc\.target\}/)
  })
})

describe('Back links (#767)', () => {
  it('one name per back action and one link style', () => {
    const compare = sheet('./ComparePlansPage.tsx')
    expect(compare).not.toContain('Back to plans')
    expect(compare).toMatch(/<Link to="\/" className="page-back">\s*← \{homeLabel\}\s*<\/Link>/)
    const examples = sheet('./examples/ExamplesPage.tsx')
    expect(examples).toMatch(/<Link to="\/" className="page-back">\s*← \{homeLabel\}\s*<\/Link>/)
    const report = sheet('./ReportPage.tsx')
    expect(report).toMatch(/className="page-back no-print">\s*← Back to plan\s*<\/Link>/)
    expect(report).not.toMatch(/btn[^"]*">\s*Back to plan/)
    // The gray Examples override is gone; the shared rule is the gold one.
    expect(css).not.toContain('.examples-back a')
    expect(rule('.page-back')).toMatch(/color:\s*var\(--accent\)/)
  })

  it('the active rail pill keeps its resting gold under the pointer', () => {
    const resting = rule('.rail-link--active')
    const hovered = rule('.rail-link--active:hover')
    expect(hovered).toMatch(/color:\s*var\(--accent\)/)
    const tint = /background:\s*([^;]+);/
    expect(hovered.match(tint)?.[1]).toBe(resting.match(tint)?.[1])
    // Declared after the generic hover it overrides.
    expect(css.indexOf('.rail-link--active:hover')).toBeGreaterThan(css.indexOf('.rail-link:hover'))
  })
})

describe('JSX text joins (#777)', () => {
  it('no prose line runs into a following {startYearDollarsWord(...)} with no space', () => {
    const srcDir: string = fileURLToPath(new URL('..', import.meta.url))
    const files = (readdirSync(srcDir, { recursive: true }) as string[]).filter(
      (f) => f.endsWith('.tsx') && !f.includes('.test.'),
    )
    const joined: string[] = []
    for (const f of files) {
      const source = (readFileSync(`${srcDir}/${f}`, 'utf8') as string).replace(/\r\n/g, '\n')
      // JSX drops a line break between text and an expression: "Enter\n{year}" renders "Enter2026".
      for (const m of source.matchAll(/[A-Za-z]\n[ \t]+\{startYearDollarsWord(?:Capitalized)?\(/g)) joined.push(`${f}: ${m[0]}`)
    }
    expect(joined).toEqual([])
  })
})

describe('Household map text list (#778)', () => {
  it('the table floors its width inside the region and measures the long columns', () => {
    expect(rule('.map-details-table')).toMatch(/min-width:\s*52rem/)
    expect(rule('.map-details-table .map-details-relations')).toMatch(/min-width:\s*22rem/)
    expect(rule('.map-details-table .map-details-status')).toMatch(/min-width:\s*12rem/)
    expect(rule('.map-details-table .map-details-item')).toMatch(/min-width:\s*8rem/)
  })
})
