import { describe, expect, it } from 'vitest'

import type { DocumentPage } from './documentText'
import {
  MAX_MIGRATION_EVIDENCE_CHARS,
  MAX_MIGRATION_EVIDENCE_PER_VENDOR,
  MAX_MIGRATION_TEXT_CHARS,
  MIGRATION_ADAPTERS,
  MIGRATION_VENDORS,
  type MigrationIdentification,
  buildMigrationReview,
  identifyMigrationDocument,
  identifyMigrationExport,
} from './migrationSource'
import { MAX_IMPORT_JSON_CHARS } from './projectionLab'
import { parseImportProvenance, serializeImportProvenance } from './provenance'
import { type ImportReviewItem, reviewToProvenance } from './reviewChecklist'

/**
 * Every fixture here is written by hand from what a report of this kind plainly
 * says on its face — a title, who it was prepared for, the tool that generated
 * it. The repo bundles no proprietary sample and no binary fixture (the WS5
 * corpus rule), and these tests need neither: `DocumentPage` is a plain record,
 * so a document's extracted pages can be constructed directly.
 */
const docPage = (page: number, text: string): DocumentPage => ({ page, text, imageOnly: false, truncated: false })

const RIGHTCAPITAL_COVER = [
  'Retirement Analysis',
  'Prepared for Dale and Robin Nakamura',
  'Prepared by Juniper Wealth Partners, LLC',
  'Generated with RightCapital on March 14, 2026',
  'Page 1 of 12',
].join('\n')

const EMONEY_COVER = ['Client Presentation', 'Prepared using eMoney Advisor', 'For discussion purposes only'].join('\n')

const MONEYGUIDE_COVER = ['Financial Goal Plan', 'Prepared by MoneyGuidePro for the Alvarez household', 'April 2026'].join('\n')

/** A ProjectionLab data export, in the shape `mapProjectionLabExport` gates on. */
const projectionLabExport = (extra: Record<string, unknown> = {}): string =>
  JSON.stringify({
    ...extra,
    user: { birthYear: 1968 },
    currentFinances: {
      accounts: [
        { name: 'Joint brokerage', type: 'Taxable', balance: 412_000, costBasis: 305_000 },
        { name: 'Rollover IRA', type: 'Pre-tax', balance: 780_500 },
      ],
      incomeSources: [{ name: 'Salary', type: 'Employment', annualAmount: 186_000 }],
      expenses: [{ name: 'Household', annualAmount: 92_000 }],
    },
  })

/** Feeds a report through the real envelope, which is the only proof that matters. */
function roundTrip(items: ImportReviewItem[]): ReturnType<typeof parseImportProvenance> {
  const { mappings, unresolved } = reviewToProvenance(items)
  const json = serializeImportProvenance({
    planSchemaVersion: 7,
    engineVersion: '0.1.7',
    sources: [{ file: 'source.pdf', sha256: 'a'.repeat(64), bytes: 4096, mapper: 'migrationSource' }],
    mappings,
    unresolved,
  })
  return parseImportProvenance(json)
}

describe('the migration registry', () => {
  it('maps nothing for every vendor with no substantiated export format', () => {
    for (const vendor of MIGRATION_VENDORS) {
      const adapter = MIGRATION_ADAPTERS[vendor]
      expect(adapter.vendor).toBe(vendor)
      // The invariant the whole workstream turns on: an adapter claims mapped
      // fields exactly when a real mapper backs it. Three of the four do not.
      expect(adapter.maps.length > 0).toBe(adapter.mapper !== null)
      expect(adapter.limitations.length).toBeGreaterThan(0)
      expect(adapter.manualPath).not.toBe('')
    }
    expect(MIGRATION_ADAPTERS.projectionlab.mapper).toBe('projectionLab')
    expect(MIGRATION_ADAPTERS.rightcapital.mapper).toBeNull()
    expect(MIGRATION_ADAPTERS.emoney.mapper).toBeNull()
    expect(MIGRATION_ADAPTERS.moneyguide.mapper).toBeNull()
  })

  it('keeps its text cap equal to the ProjectionLab mapper it must not out-claim', () => {
    // The cap is duplicated rather than imported (see the constant's comment);
    // this is the guard that the duplication cannot drift.
    expect(MAX_MIGRATION_TEXT_CHARS).toBe(MAX_IMPORT_JSON_CHARS)
  })
})

describe('identifyMigrationDocument', () => {
  it('identifies each incumbent tool from its own cover page', () => {
    const cases: [string, string][] = [
      [RIGHTCAPITAL_COVER, 'rightcapital'],
      [EMONEY_COVER, 'emoney'],
      [MONEYGUIDE_COVER, 'moneyguide'],
    ]
    for (const [cover, vendor] of cases) {
      const found = identifyMigrationDocument([docPage(1, cover)])
      expect(found?.outcome).toBe('identified')
      if (found?.outcome !== 'identified') throw new Error('expected an identification')
      expect(found.vendor).toBe(vendor)
      expect(found.adapter.displayName).toBe(MIGRATION_ADAPTERS[found.vendor].displayName)
      // A document can only ever produce the weaker tier — a PDF has no
      // parseable export shape — and the evidence must quote the source.
      expect(found.evidence.every((item) => item.strength === 'name')).toBe(true)
      expect(found.evidence[0]!.locator).toEqual({ kind: 'none', note: 'page 1' })
    }
  })

  it('matches MoneyGuidePro, whose product name would defeat a bare word boundary', () => {
    const found = identifyMigrationDocument([docPage(1, 'Generated by MoneyGuidePro')])
    expect(found?.outcome === 'identified' && found.vendor).toBe('moneyguide')
  })

  it('cites the page numbers the extractor reported, not array positions', () => {
    // Pages 2, 3, 5 and 6 failed extraction, so they are ABSENT from `pages`
    // (they would be listed in summary.unreadablePages). Page numbers are
    // therefore non-contiguous and pages[i] is not page i + 1 — the citation
    // must come from page.page or every footnote in the report is wrong.
    const found = identifyMigrationDocument([
      docPage(1, 'Retirement Analysis\nPrepared for the Nakamura household'),
      docPage(4, 'Cash flow detail\nGenerated with RightCapital'),
      docPage(7, 'Appendix: assumptions\nRightCapital default return assumptions were used'),
    ])
    expect(found?.outcome).toBe('identified')
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    expect(found.vendor).toBe('rightcapital')
    expect(found.evidence.map((item) => item.locator)).toEqual([
      { kind: 'none', note: 'page 4' },
      { kind: 'none', note: 'page 7' },
    ])
  })

  it('quotes the matched text verbatim, bounded, with the surrounding context', () => {
    const found = identifyMigrationDocument([docPage(4, RIGHTCAPITAL_COVER)])
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    const matched = found.evidence[0]!.matched
    expect(matched).toContain('Generated with RightCapital on March 14, 2026')
    expect(matched.length).toBeLessThanOrEqual(MAX_MIGRATION_EVIDENCE_CHARS)
  })

  it('bounds how many excerpts one vendor may contribute', () => {
    const pages = Array.from({ length: 40 }, (_, index) => docPage(index + 1, 'eMoney Advisor — page footer'))
    const found = identifyMigrationDocument(pages)
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    expect(found.evidence).toHaveLength(MAX_MIGRATION_EVIDENCE_PER_VENDOR)
  })

  it('returns null for a document that matches nothing, and for no pages at all', () => {
    expect(identifyMigrationDocument([docPage(1, 'Annual statement\nAccount ending 4471\nTotal value $312,004.19')])).toBeNull()
    expect(identifyMigrationDocument([])).toBeNull()
  })

  it('does not fire on a product name buried inside a longer word', () => {
    // The WS5 false-positive rate is the whole reason for the word boundary:
    // a substring match is not evidence of anything.
    const decoys = [
      'Our projectionlabs run every weekend',
      'rightcapitalization of the trust corpus',
      'the telemoneyguidepro handbook',
      'emoneyed the settlement in 2019',
      'a money guide for new retirees',
    ]
    for (const decoy of decoys) {
      expect(identifyMigrationDocument([docPage(1, decoy)])).toBeNull()
      expect(identifyMigrationExport(decoy)).toBeNull()
    }
  })

  it('THE TWIN: a decoy that RENDERS identically is rejected identically', () => {
    // Every decoy above is ASCII, which is why they all passed while the guard
    // was `\b` — a construct defined over ASCII `\w` alone, so any non-ASCII or
    // zero-width neighbour manufactures a boundary and defeats it.
    //
    // These strings print character-for-character like the plain decoys beside
    // them. The zero-width joiner is the demonstration: `projectionlaboratory` is
    // rejected above, this renders as `projectionlaboratory`, and it used to
    // produce a full identification — so a reviewer checking the published
    // evidence would have been shown the innocuous word with no way to see why
    // it matched. The soft hyphen is the case that needs no attacker at all:
    // PDF text layers carry U+00AD wherever a word was hyphenated.
    const twins = [
      'Prepared using projectionlab‍oratory imaging equipment.',
      'Report generated by eMoney­AdvisorSuite for the Smith household.',
      'The eMoneyübersicht was attached.',
      'Filed under projectionlab​s last spring.',
    ]
    for (const twin of twins) {
      expect(identifyMigrationDocument([docPage(1, twin)])).toBeNull()
      expect(identifyMigrationExport(twin)).toBeNull()
    }
  })

  it('still fires on a real mention sitting beside non-Latin script', () => {
    // The guard must reject glued-on neighbours without rejecting a genuine
    // mention that merely sits next to non-ASCII text or punctuation.
    const real = identifyMigrationDocument([docPage(1, 'データ元: RightCapital（2026年）')])
    expect(real?.outcome).toBe('identified')
    if (real?.outcome !== 'identified') throw new Error('expected an identification')
    expect(real.vendor).toBe('rightcapital')
  })
})

describe('identifyMigrationExport', () => {
  it('identifies a ProjectionLab export structurally, with no version field present', () => {
    const found = identifyMigrationExport(projectionLabExport())
    expect(found?.outcome).toBe('identified')
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    expect(found.vendor).toBe('projectionlab')
    expect(found.evidence).toEqual([
      { strength: 'structure', matched: 'currentFinances.accounts', locator: { kind: 'jsonPath', path: 'currentFinances.accounts' } },
    ])
  })

  it('reports meta.app and meta.exportVersion as evidence without gating on them', () => {
    // The existing mapper never reads either field, though real exports carry
    // them. An UNKNOWN version is still ProjectionLab — the mapper's own
    // structural refusal is the backstop, so nothing here gates on a version
    // string this project has never seen.
    const found = identifyMigrationExport(projectionLabExport({ meta: { app: 'ProjectionLab', exportVersion: '2.11.0' } }))
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    expect(found.vendor).toBe('projectionlab')
    expect(found.evidence.map((item) => [item.matched, item.locator])).toEqual([
      ['currentFinances.accounts', { kind: 'jsonPath', path: 'currentFinances.accounts' }],
      ['ProjectionLab', { kind: 'jsonPath', path: 'meta.app' }],
      ['2.11.0', { kind: 'jsonPath', path: 'meta.exportVersion' }],
    ])

    const unheardOf = identifyMigrationExport(projectionLabExport({ meta: { exportVersion: '99.0.0-canary' } }))
    expect(unheardOf?.outcome === 'identified' && unheardOf.vendor).toBe('projectionlab')
    if (unheardOf?.outcome !== 'identified') throw new Error('expected an identification')
    expect(unheardOf.evidence[1]!.matched).toBe('99.0.0-canary')
  })

  it('published evidence never misrepresents itself: no silent truncation, no invented version string', () => {
    // The whole safety argument of this module is "we identify, we show you the
    // evidence, you judge". Evidence that quietly lies about its own extent or
    // its own type breaks that argument more thoroughly than a missed match.

    // A value longer than the bound must SAY it was cut. It was being clipped at
    // the bound with no marker, so a truncated version read as the whole of it.
    const long = identifyMigrationExport(projectionLabExport({ meta: { app: 'Q'.repeat(300) } }))
    if (long?.outcome !== 'identified') throw new Error('expected an identification')
    const app = long.evidence[1]!.matched
    expect(app.length).toBeLessThanOrEqual(MAX_MIGRATION_EVIDENCE_CHARS)
    expect(app.endsWith('…')).toBe(true)

    // `JSON.parse` has already discarded the token by the time this runs, so a
    // numeric 2.0 is indistinguishable from 2 and cannot be quoted verbatim.
    // Publishing a bare "2" sends a reviewer looking for a string the file does
    // not contain, so the evidence says where the number came from instead.
    const numeric = identifyMigrationExport(projectionLabExport({ meta: { exportVersion: 2.0 } }))
    if (numeric?.outcome !== 'identified') throw new Error('expected an identification')
    expect(numeric.evidence[1]!.matched).toBe('2 (a number in the file, not text)')

    // Control characters and newlines out of someone else's file must not reach
    // the quoted detail of a review item and fracture what a reviewer reads.
    const nasty = identifyMigrationExport(projectionLabExport({ meta: { app: 'Line1\nLine2 “quote”' } }))
    if (nasty?.outcome !== 'identified') throw new Error('expected an identification')
    expect(nasty.evidence[1]!.matched).toBe('Line1 Line2 “quote”')
    expect(nasty.evidence[1]!.matched).not.toContain('\n')
  })

  it('a name excerpt keeps its trailing marker exactly when the right edge was clipped', () => {
    // The bound used to be applied to the FINISHED string, so it ate the closing
    // ellipsis precisely when the right edge had been clipped — the one case the
    // marker exists for. Sweeping the padding walks the excerpt across that
    // boundary rather than guessing where it sits.
    for (let pad = 60; pad <= 100; pad++) {
      // The trailing space is load-bearing: without it the name is glued to the
      // padding and the edge guard correctly refuses to match at all.
      const text = `${'a '.repeat(pad)}RightCapital ${'b '.repeat(pad)}`
      const found = identifyMigrationDocument([docPage(1, text)])
      if (found?.outcome !== 'identified') throw new Error(`expected an identification at pad ${pad}`)
      const matched = found.evidence[0]!.matched
      expect(matched.length).toBeLessThanOrEqual(MAX_MIGRATION_EVIDENCE_CHARS)
      // Both edges are far from the excerpt window at every pad in this sweep,
      // so both markers must be present at every one of them.
      expect(`${pad}:${matched.startsWith('…')}`).toBe(`${pad}:true`)
      expect(`${pad}:${matched.endsWith('…')}`).toBe(`${pad}:true`)
    }
  })

  it('lets a structural match end the scan, so a name in the data cannot make it ambiguous', () => {
    // A real export can hold a competitor's name in an account label or a note.
    // The file's SHAPE is evidence about the file; a name in its text is
    // evidence about the file's subject.
    const withRival = JSON.parse(projectionLabExport()) as { currentFinances: { accounts: { name: string }[] } }
    withRival.currentFinances.accounts[0]!.name = 'Balances copied from our old eMoney plan'
    const found = identifyMigrationExport(JSON.stringify(withRival))
    expect(found?.outcome === 'identified' && found.vendor).toBe('projectionlab')
  })

  it('falls back to name matching for text that is not a parseable export', () => {
    const found = identifyMigrationExport('account,balance\n# exported from RightCapital\nBrokerage,412000\n')
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    expect(found.vendor).toBe('rightcapital')
    expect(found.evidence[0]!.strength).toBe('name')
    expect(found.evidence[0]!.locator).toEqual({ kind: 'none', note: 'the export text' })
  })

  it('refuses to choose when a file names more than one tool', () => {
    const comparison = [
      'Platform comparison for the retirement committee',
      'RightCapital: strongest tax-planning visuals',
      'eMoney: strongest aggregation',
      'Both quoted at the enterprise tier',
    ].join('\n')
    const found = identifyMigrationExport(comparison)
    expect(found?.outcome).toBe('ambiguous')
    if (found?.outcome !== 'ambiguous') throw new Error('expected ambiguity')
    expect(found.candidates.map((candidate) => candidate.vendor)).toEqual(['rightcapital', 'emoney'])
  })

  it('returns null for JSON that is not a ProjectionLab export', () => {
    expect(identifyMigrationExport('{"accounts":[{"name":"Brokerage"}]}')).toBeNull()
    expect(identifyMigrationExport('[1,2,3]')).toBeNull()
    expect(identifyMigrationExport('{"currentFinances":{"accounts":"not an array"}}')).toBeNull()
    expect(identifyMigrationExport('')).toBeNull()
  })

  it('does not throw on hostile or malformed input', () => {
    expect(() => identifyMigrationExport('{"currentFinances":')).not.toThrow()
    expect(identifyMigrationExport(`{"currentFinances":{"accounts":[]}} ${'x'.repeat(10)}`)).toBeNull()
    // Past the cap, the file is not parsed at all — identification must not
    // claim a file the mapper would refuse on size alone.
    expect(identifyMigrationExport('x'.repeat(MAX_MIGRATION_TEXT_CHARS + 1))).toBeNull()
  })
})

describe('buildMigrationReview', () => {
  const pages = [docPage(1, RIGHTCAPITAL_COVER), docPage(4, 'Cash flow detail\nGenerated with RightCapital')]

  it('produces no claims at all when nothing was identified', () => {
    expect(buildMigrationReview(null, 'mystery.pdf')).toEqual([])
  })

  it('emits only unmapped items, with no target and unmapped confidence', () => {
    const items = buildMigrationReview(identifyMigrationDocument(pages), 'nakamura-analysis.pdf', { pages })
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.status).toBe('unmapped')
      expect(item.confidence).toBe('unmapped')
      expect(item.target).toBeUndefined()
    }
  })

  it('lands every item under `unresolved` in a real provenance envelope', () => {
    // The proof is the round trip, not an eyeball check of the fields:
    // `serializeImportProvenance` THROWS unless an unresolved entry is graded
    // 'unmapped' and claims no plan destination.
    const items = buildMigrationReview(identifyMigrationDocument(pages), 'nakamura-analysis.pdf', { pages })
    const { mappings, unresolved } = reviewToProvenance(items)
    expect(mappings).toEqual([])
    expect(unresolved).toHaveLength(items.length)

    const parsed = roundTrip(items)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(`expected a readable envelope, got ${parsed.reason}`)
    expect(parsed.provenance.mappings).toEqual([])
    expect(parsed.provenance.unresolved).toHaveLength(items.length)
    for (const entry of parsed.provenance.unresolved) {
      expect(entry.confidence).toBe('unmapped')
      expect(entry.target).toBeUndefined()
    }
  })

  it('publishes the vendor limitations and the manual path when nothing maps', () => {
    const items = buildMigrationReview(identifyMigrationDocument(pages), 'nakamura-analysis.pdf', { pages })
    const details = items.map((item) => item.detail)
    for (const limitation of MIGRATION_ADAPTERS.rightcapital.limitations) expect(details).toContain(limitation)
    expect(details).toContain(MIGRATION_ADAPTERS.rightcapital.manualPath)
    expect(details.some((detail) => detail.includes('Nothing was mapped from it'))).toBe(true)
  })

  it('cites the pages whose text came across, using the document’s own numbers', () => {
    const items = buildMigrationReview(identifyMigrationDocument(pages), 'nakamura-analysis.pdf', { pages })
    const carried = items.find((item) => item.source.endsWith('text carried over'))
    expect(carried?.detail).toContain('pages 1, 4')
    expect(carried?.locator).toEqual({ kind: 'none', note: 'pages 1, 4' })
  })

  it('adds only the identification for a mapped ProjectionLab export, never a second copy of its checklist', () => {
    // mapProjectionLabExport already pushes unmapped items for the
    // categorically non-transferable tail; repeating them here would double
    // every line in the wizard.
    const items = buildMigrationReview(identifyMigrationExport(projectionLabExport()), 'projectionlab-export.json')
    expect(items).toHaveLength(1)
    expect(items[0]!.detail).toContain('mapped by the projectionLab import')
    const details = items.map((item) => item.detail)
    for (const limitation of MIGRATION_ADAPTERS.projectionlab.limitations) expect(details).not.toContain(limitation)
    expect(roundTrip(items).ok).toBe(true)
  })

  it('gives a name-only ProjectionLab file the full report, because no mapper ran on it', () => {
    const printed = identifyMigrationDocument([docPage(2, 'Plan summary printed from ProjectionLab')])
    const items = buildMigrationReview(printed, 'projectionlab-summary.pdf')
    const details = items.map((item) => item.detail)
    expect(details.some((detail) => detail.includes('Nothing was mapped from it'))).toBe(true)
    expect(details).toContain(MIGRATION_ADAPTERS.projectionlab.manualPath)
    expect(details.every((detail) => !detail.includes('mapped by the projectionLab import'))).toBe(true)
  })

  it('says plainly that no tool was claimed for an ambiguous file, and still round-trips', () => {
    const ambiguous = identifyMigrationDocument([
      docPage(1, 'Platform comparison'),
      docPage(2, 'RightCapital pricing'),
      docPage(3, 'eMoney pricing'),
    ]) as MigrationIdentification
    expect(ambiguous.outcome).toBe('ambiguous')
    const items = buildMigrationReview(ambiguous, 'comparison.pdf')
    expect(items[0]!.detail).toContain('names more than one planning tool (RightCapital, eMoney)')
    // Both candidates' evidence survives into the report, with its own page.
    expect(items.map((item) => item.locator)).toContainEqual({ kind: 'none', note: 'page 2' })
    expect(items.map((item) => item.locator)).toContainEqual({ kind: 'none', note: 'page 3' })
    // No vendor was claimed, so no vendor's limitations may be published.
    const details = items.map((item) => item.detail)
    for (const limitation of MIGRATION_ADAPTERS.emoney.limitations) expect(details).not.toContain(limitation)
    expect(roundTrip(items).ok).toBe(true)
  })
})
