/**
 * Design-QA cluster I: the narrow-viewport layout defects (#559, #560, #562,
 * #565, #566, #573, #575). jsdom computes no layout, so what a chrome pin can
 * hold is the stylesheet rule that decides the geometry; the measurements that
 * chose each number were taken in a real browser at 375, 768 and 1024 and are
 * recorded in the comment above each pin. The markup half — the LTC table's
 * scroll region and the label/ⓘ adjacency the #573 selector depends on — is in
 * designQa.clusterI.markup.test.tsx.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

/** A sheet with LF line endings whatever the checkout wrote, so multi-line pins hold on Windows too. */
function sheet(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')
}

const css: string = sheet('./planner.css')

/**
 * Bodies of every rule whose selector list is exactly `selector`: the text must
 * be followed by `{` and preceded only by whitespace back to the start of the
 * sheet, a `}`, a `{` (a rule opening a media block) or the end of a comment —
 * so `.foo, .kpi-label {` never satisfies a pin for `.kpi-label`. Plain string
 * scanning, no dynamic RegExp. Returned in source order, because this cluster's
 * rules are appended overrides of selectors that already existed.
 */
function rules(selector: string, source = css): string[] {
  const found: string[] = []
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
    const prev = before < 0 ? '' : source[before]
    const boundary = before < 0 || prev === '}' || prev === '{' || source.slice(before - 1, before + 1) === '*/'
    if (!boundary) continue
    const open = source.indexOf('{', after)
    let depth = 1
    let i = open + 1
    while (depth > 0 && i < source.length) {
      if (source[i] === '{') depth++
      if (source[i] === '}') depth--
      i++
    }
    found.push(source.slice(open + 1, i - 1))
  }
  return found
}

/** The body of the `@media (...)` block that contains `needle`, so a pin names the breakpoint it means. */
function mediaBlockWith(query: string, needle: string): string {
  const header = `@media ${query} {`
  let from = 0
  while (from < css.length) {
    const at = css.indexOf(header, from)
    expect(at, `a ${header} block containing ${needle}`).toBeGreaterThanOrEqual(0)
    from = at + header.length
    const open = at + header.length - 1
    let depth = 1
    let i = open + 1
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') depth++
      if (css[i] === '}') depth--
      i++
    }
    const body = css.slice(open + 1, i - 1)
    if (body.includes(needle)) return body
  }
  throw new Error(`no @media ${query} block contains ${needle}`)
}

describe('cluster I: KPI labels cannot paint into the next KPI (#559)', () => {
  it('the narrow-viewport strip gives a KPI card room for the longest label the app writes', () => {
    // Measured at 768 (dark, Results): every card was 8.5rem = 136px while
    // "Ending net worth" measured 145px in the reporter's Chrome, so the label
    // ran to within 0.7px of the next card — no gap, no ellipsis. 10rem = 160px
    // clears that label with 15px to spare.
    const narrow = mediaBlockWith('(max-width: 880px)', '.kpi-bar')
    expect(narrow).toMatch(/grid-auto-columns:\s*minmax\(8\.5rem, 1fr\)/)
    // The later block widens it; the override has to come after the original.
    const strips = css.split('grid-auto-columns:')
    expect(strips.length, 'both the original strip rule and the cluster-I override').toBe(3)
    expect(strips[2]).toMatch(/^\s*minmax\(10rem, 1fr\)/)
    expect(css.lastIndexOf('minmax(10rem, 1fr)')).toBeGreaterThan(css.indexOf('minmax(8.5rem, 1fr)'))
  })

  it('a label wider than its card clips inside it instead of overflowing, in every theme and viewport', () => {
    // Unscoped by design: the fixed-width card is the narrow strip's, but a
    // font this app has never seen must not be able to overrun a desktop card
    // either. `nowrap` stays — the label is one line, it just stops at the edge.
    const label = rules('.kpi-label')
    expect(label, 'the original rule plus the cluster-I override').toHaveLength(2)
    expect(label[0]).toMatch(/white-space:\s*nowrap/)
    expect(label[1]).toMatch(/overflow:\s*hidden/)
    expect(label[1]).toMatch(/text-overflow:\s*ellipsis/)
  })
})

describe('cluster I: the compare table stops scrolling under its own sticky column (#560)', () => {
  it('below the rail breakpoint the four columns share the wrap instead of forcing 52rem of inline scroll', () => {
    // Measured at 768: wrap 711px, table 832px (52rem) → 121px of inline
    // scroll, and the 12rem sticky Metric column then covered the first 9.4px
    // of Plan A ("Depletes in 2051" read as "epletes in 2051"). With the floor
    // released the table is 711px, scrollWidth === clientWidth, nothing scrolls
    // under the sticky column at all.
    const base = rules('.year-table.compare-table')
    expect(base[0]).toMatch(/min-width:\s*52rem/)
    expect(base[0]).toMatch(/table-layout:\s*fixed/)
    const narrow = mediaBlockWith('(max-width: 880px)', '.year-table.compare-table')
    expect(narrow).toMatch(/min-width:\s*0/)
    // Releasing the floor is only safe because the cells may wrap: a fixed
    // layout with `white-space: nowrap` would spill each cell over the next.
    expect(narrow).toMatch(/white-space:\s*normal/)
    // The floor still exists for the widths #384 wrote it for.
    expect(css.indexOf('min-width: 52rem')).toBeLessThan(css.lastIndexOf('.year-table.compare-table'))
  })
})

describe('cluster I: the import page never scrolls the document sideways (#562)', () => {
  it('the wizard grid and its items may shrink, so the mapping table scrolls in its own region', () => {
    // Measured at 1024 with an 8-column sheet: `.import-page` scrollWidth 1690
    // vs clientWidth 969 — a grid item's automatic minimum size is its
    // min-content, so the card holding the table refused to shrink and the
    // single track grew with it. After: page scrollWidth 969 === clientWidth,
    // and the ScrollRegion around the table scrolls 925 → 1646 internally.
    const page = rules('.import-page')
    expect(page[0]).toMatch(/display:\s*grid/)
    expect(page[page.length - 1]).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(rules('.import-page > *')).toHaveLength(1)
    expect(rules('.import-page > *')[0]).toMatch(/min-width:\s*0/)
  })
})

describe('cluster I: the plan workspace header survives a phone (#565)', () => {
  it('the title block carries a basis, so the actions wrap instead of squeezing the plan name to one letter', () => {
    // Measured at 375: `.workspace-head-main` 68px wide, `.plan-name-input`
    // clientWidth 66 vs scrollWidth 184 — "Example couple" showed as "E", and
    // the breadcrumb overflowed its 68px nav. With a 16rem basis the actions
    // wrap to their own row and the title block takes the full 335px, with the
    // name's scrollWidth equal to its clientWidth.
    const main = rules('.workspace-head-main')
    expect(main, 'the original rule plus the cluster-I override').toHaveLength(2)
    // min-width: 0 has to stay: the basis decides when the row wraps, the
    // zero minimum is what lets the name's ellipsis do its job below that.
    expect(main[0]).toMatch(/min-width:\s*0/)
    expect(main[1]).toMatch(/flex:\s*1 1 16rem/)
    // The same shape the report head already uses for the same defect (#474).
    expect(rules('.report-head-title')[0]).toMatch(/flex:\s*1 1 16rem/)
    expect(css.lastIndexOf('.workspace-head-main')).toBeGreaterThan(css.indexOf('.workspace-head'))
  })
})

describe('cluster I: the KPI bar does not hold the top of a phone screen (#566)', () => {
  it('the bar stays sticky where the viewport can afford it and scrolls away on a phone', () => {
    // Measured at 375 on Household, scrolled to y=900: the sticky bar occupied
    // y 0–78 and four controls sat inside that band — the Name label and input
    // and the Date of birth label and input, exactly what the report names.
    // Static at the same scroll position: nothing is behind it.
    expect(rules('.kpi-bar')[0]).toMatch(/position:\s*sticky/)
    const phone = mediaBlockWith('(max-width: 640px)', '.kpi-bar')
    expect(phone).toMatch(/\.kpi-bar \{\s*position: static;/)
    // The anchor/focus offset existed only to clear the sticky bar; with the
    // bar in flow it would push every jump 8rem down a phone screen for nothing.
    expect(rules('html:has(.kpi-bar)')[0]).toMatch(/scroll-padding-top:\s*8rem/)
    expect(phone).toMatch(/html:has\(\.kpi-bar\) \{\s*scroll-padding-top: 1rem;/)
  })

  it('DESIGN.md says so too, and keeps the two narrow-viewport steps apart (r1-2, r1-5)', () => {
    const design: string = sheet('../../../../DESIGN.md')
    expect(design).toContain('stops sticking')
    expect(design).toContain('Stickiness is the rule wherever the viewport can afford it')
    // The scroll row and the unstick are different breakpoints; the doc has to
    // say both, or a reader takes the 880px layout for the 640px behaviour.
    expect(design).toMatch(/under 880px[\s\S]*?still sticky/)
    expect(design).toMatch(/under 640px[\s\S]*?stops sticking/)
    // And the HelpTip clamp cannot still call that edge unconditional, since
    // on a phone the bar scrolls off and the clamp falls back to the margin.
    // Read the bullet as one line, since the doc hard-wraps mid-sentence.
    const tip = design.slice(design.indexOf('**Help bubbles**'), design.indexOf('### The KPI Bar')).replace(/\s+/g, ' ')
    expect(tip).not.toContain("the sticky KPI bar's bottom edge as the top inside a plan;")
    expect(tip).toContain('while the bar is holding that edge')
  })
})

describe('cluster I: the help ⓘ never widows onto its own line (#573)', () => {
  it('the label reserves the icon room inside its own inline box and the icon is pulled back into it', () => {
    // Measured at 1024 on Strategy with Itemize on: at ≤175px of label room
    // the SALT text stayed on one line and the ⓘ dropped alone to a second,
    // adding 24px to the label row. After, the text reflows to two lines and
    // the ⓘ follows its last word, 4.8px after the final glyph — the same gap
    // the 0.3rem margin drew before.
    const reserved = rules('.field-label-row > .field-label:has(+ .help-tip)')
    expect(reserved).toHaveLength(1)
    // The room is exactly the icon (1rem, from .help-tip > button) plus the
    // gap the label used to draw with margin-right (0.3rem); the icon's own
    // negative margin is the icon width, so what is left over is that gap.
    expect(rules('.help-tip > button')[0]).toMatch(/width:\s*1rem/)
    expect(rules('.field-label-row > .field-label')[0]).toMatch(/margin-right:\s*0\.3rem/)
    expect(reserved[0]).toMatch(/padding-right:\s*1\.3rem/)
    expect(reserved[0]).toMatch(/margin-right:\s*0;/)
    // The pull-back names the label that reserved the room, so it can only
    // apply where the reservation did, and both sit behind one feature query:
    // without :has() the pair drops together and the original 0.3rem margin
    // stands, rather than the icon sliding over the label text (r1-4).
    const pull = rules('.field-label-row > .field-label:has(+ .help-tip) + .help-tip')
    expect(pull).toHaveLength(1)
    expect(pull[0]).toMatch(/margin-left:\s*-1rem/)
    expect(rules('.field-label-row > .help-tip')[0]).not.toMatch(/margin-left/)
    const gated = css.slice(css.indexOf('@supports selector(:has(*))'))
    expect(css).toContain('@supports selector(:has(*))')
    expect(gated.indexOf('padding-right: 1.3rem')).toBeGreaterThan(0)
    expect(gated.indexOf('margin-left: -1rem')).toBeGreaterThan(0)
    // The label row stays inline formatting: flex would park the icon at the
    // cell's far edge instead of after the last word (#470, #471).
    expect(rules('.field-label-row')[0]).toMatch(/display:\s*block/)
  })
})

describe('cluster I: the LTC stress table is contained like every other wide table (#575)', () => {
  it('the scenario table is a named scroll region, not a bare table in a card', () => {
    // Measured at 375: the bare `.compare-table` rendered 343px wide with its
    // right edge 30px past the viewport, so the document scrolled sideways.
    // Wrapped, the page has no overflowing box and the region scrolls 251 → 343.
    const section: string = sheet('./sections/InsuranceSection.tsx')
    expect(section).toContain("import { ScrollRegion } from '../ScrollRegion'")
    expect(section).toMatch(
      /<ScrollRegion label="LTC stress test scenarios" grow style=\{\{ border: 'none' \}\}>\s*<table className="compare-table">/,
    )
    expect(section).toContain('</ScrollRegion>')
    // The first column's 12rem floor is what makes three scenarios overflow a
    // phone; it is the reason the wrap is needed, so it is pinned here too.
    expect(rules('.compare-table th:first-child')[0]).toMatch(/min-width:\s*12rem/)
  })
})

describe('Design-QA pin hygiene', () => {
  it('reads every file through a CRLF-normalising helper, so the pins hold on a Windows checkout', () => {
    const self = sheet('./designQa.clusterI.test.ts')
    const reads = self.split('\n').filter((line: string) => line.includes('readFileSync' + '('))
    expect(reads.length).toBeGreaterThan(0)
    for (const line of reads) expect(line, line.trim()).toContain(".replace(/\\r\\n/g, '\\n')")
  })
})
