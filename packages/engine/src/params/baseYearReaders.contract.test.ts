/**
 * No engine source reads the base pack's year to scale a figure, outside a
 * list of reads that are not a publisher's figures being scaled
 * (decision D-2027-ROLLOVER; PR #768 review issues 1 and 7, 2026-09-29).
 *
 * The base pack's year (`packForYear(year).pack.year`, `ctx.params.year`,
 * LATEST_PACK_YEAR) stays at the base pack's, 2026, however many publishers
 * land a later year. Each publisher's figures grow from that publisher's own
 * latest year (`componentScale`, `componentPackView`), and the income-tax
 * factor is 1 in a year the IRS is loaded for. A reader that scaled a
 * publisher's figures from the base pack's year read them wrong from the
 * first landing on, and no test saw it while every publisher was at 2026: the
 * review found three such readers (the widow's-penalty, law-pack and IRMAA
 * tier-edge detectors) and `indexingScaleFor`'s LATEST_PACK_YEAR default, all
 * moved in the same change as this test.
 *
 * The scan reads every non-test `.ts` file under `src`, with comments and
 * quoted strings removed, for `LATEST_PACK_YEAR`, `<something>pack.year` and
 * `<something>params.year`. Each file that matches must be listed below with
 * its count and the reason its reads are not a publisher's figures scaled
 * from the base pack's year. A new read fails here until someone decides
 * which it is: move it to its publisher (`componentScale`,
 * `componentPackView`), or list it with a reason. A reader that scales by the
 * wrong publisher's factor (the optimizer LP's IRMAA scale was one) names no
 * base year and is not a scan's to find: `landing.readers.test.ts` lands each
 * publisher to hold the readers that moved.
 */
import { describe, expect, it } from 'vitest'

// Every engine source file, as text, keyed by its path from `src` (the glob
// names this directory's own files `./x.ts`). It includes the tests, which
// the scan leaves out.
const SOURCES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)
    .filter(([path]) => !path.endsWith('.test.ts') && !path.endsWith('.d.ts'))
    .map(([path, text]) => [path.startsWith('./') ? `params/${path.slice('./'.length)}` : path.slice('../'.length), text]),
)

const ALLOWED: Readonly<Record<string, { readonly count: number; readonly reason: string }>> = {
  'params/index.ts': {
    count: 6,
    reason:
      'the definitions: LATEST_PACK_YEAR and packForYear choose the base pack; componentPackView gives a component its own year; the IRMAA top-tier rule reads the year of the Medicare view it is handed (its callers pass componentPackView(..., "cmsMedicare"))',
  },
  'params/state/index.ts': {
    count: 1,
    reason: "the state figures' own pack year (params/state), which the enacted state years are layered on; not the federal base pack",
  },
  'projection/internal/annualHealthcareExpenses.ts': {
    count: 3,
    reason: 'input.pack is the Medicare component view simulate.ts builds (componentPackView(yearParameters, "cmsMedicare")), so its year is CMS\'s',
  },
  'projection/simulate.ts': {
    count: 1,
    reason: "the HSA limits' own year table (hsaLimitsFor, hsaLimitYears.ts), whose block year is the IRS's HSA publication",
  },
  'tax/federalTax.ts': {
    count: 1,
    reason:
      "saltCapForYear: the SALT cap is a statute figure no publisher overlays, stepped 1% a year from the base pack's amount under IRC 164(b)(7) for 2027 to 2029; the base pack's year is that amount's year",
  },
  'insights/detectors/stalePlanData.ts': {
    count: 1,
    reason: "a floor on the planning year a save stamp is compared with, not a figure: the start year governs for every start year from the base pack's on",
  },
}

/** The source with comments and single- or double-quoted strings blanked; template literals are kept. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/(^|[^:\\])\/\/.*$/gmu, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/gu, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/gu, '""')
}

const BASE_YEAR_READ = /\b(?:LATEST_PACK_YEAR|\w*[pP]ack\.year|\w*[pP]arams\.year)\b/gu

function baseYearReads(): Record<string, number> {
  const reads: Record<string, number> = {}
  for (const [file, text] of Object.entries(SOURCES)) {
    const matches = code(text).match(BASE_YEAR_READ)
    if (matches) reads[file] = matches.length
  }
  return reads
}

describe('reads of the base pack year in engine source', () => {
  it('are only the listed ones, each with its reason', () => {
    expect(Object.keys(SOURCES)).toContain('params/components.ts')
    const listed = Object.fromEntries(Object.entries(ALLOWED).map(([file, entry]) => [file, entry.count]))
    expect(baseYearReads()).toEqual(listed)
  })

  it('find a read the list does not name, and not one in a comment or a string', () => {
    expect(code('const scale = factor(ctx.params.year, year) // ctx.params.year').match(BASE_YEAR_READ)).toEqual(['params.year'])
    expect(code('indexingScaleFor(LATEST_PACK_YEAR, year, path)').match(BASE_YEAR_READ)).toEqual(['LATEST_PACK_YEAR'])
    expect(code('grow(publishedPack.year)').match(BASE_YEAR_READ)).toEqual(['publishedPack.year'])
    expect(code("const label = 'pack.year'").match(BASE_YEAR_READ)).toBeNull()
  })
})
