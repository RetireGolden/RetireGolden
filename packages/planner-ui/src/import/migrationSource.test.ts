import { describe, expect, it } from 'vitest'

import {
  MAX_DOCUMENT_PAGES,
  MAX_DOCUMENT_TEXT_CHARS,
  MAX_PAGE_TEXT_CHARS,
  type DocumentPage,
  type DocumentTextSummary,
} from './documentText'
import {
  MAX_MIGRATION_EVIDENCE_CHARS,
  MAX_MIGRATION_EVIDENCE_PER_VENDOR,
  MAX_MIGRATION_SOURCE_NAME_CHARS,
  MAX_MIGRATION_TEXT_CHARS,
  MIGRATION_ADAPTERS,
  MIGRATION_VENDORS,
  NO_FORMAT_MANUAL_PATH,
  type MigrationIdentification,
  type PageReadState,
  buildMigrationReview,
  classifyPage,
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
  return roundTripWithSources(items, 1)
}

/**
 * The same, with `count` source entries — a multi-source envelope bounds-checks
 * every `sourceIndex` it finds, so this is what proves an attribution is real
 * rather than merely present on the object.
 */
function roundTripWithSources(items: ImportReviewItem[], count: number): ReturnType<typeof parseImportProvenance> {
  const { mappings, unresolved } = reviewToProvenance(items)
  const json = serializeImportProvenance({
    planSchemaVersion: 7,
    engineVersion: '0.1.7',
    sources: Array.from({ length: count }, (_, i) => ({
      file: `source-${i}.pdf`,
      sha256: 'a'.repeat(64),
      bytes: 4096,
      mapper: 'migrationSource',
    })),
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

/**
 * THE STATE SPACE, enumerated.
 *
 * Every page-state defect in this module was found one cell at a time, by a
 * reviewer, because the code picked cases off with a filter each and nothing
 * asked whether the cases covered the space. Three signals make eight
 * combinations; this walks all eight. A ninth combination cannot appear without
 * a new field on `DocumentPage`, and if one does, `classifyPage` returning a
 * closed union means the compiler is involved rather than a bot.
 */
describe('nothing unbounded reaches the envelope', () => {
  it('bounds the file NAME, which is copied into every item', () => {
    // Not evidence, so no excerpt budget — but duplicated into the label and
    // locator note of nearly every item, so an unbounded one is multiplied
    // before it reaches the envelope. A megabyte of name could push a report
    // past the provenance limit and make serialization throw over a file whose
    // contents and excerpts had all respected their caps.
    const pages = [docPage(1, 'Generated with RightCapital')]
    const items = buildMigrationReview(identifyMigrationDocument(pages), `${'n'.repeat(1_000_000)}.pdf`, { pages })
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) expect(item.source.length).toBeLessThanOrEqual(MAX_MIGRATION_SOURCE_NAME_CHARS + 40)
    expect(roundTrip(items).ok).toBe(true)
  })

  it('does not expand a huge metadata value just to publish 160 characters of it', () => {
    // Sanitising EXPANDS: every zero-width joiner becomes an eight-character
    // <U+200D>. Expanding a permitted 10 MB value in full, to then clip it to
    // 160, is ~80 MB of intermediate string for a file that respected every
    // documented cap. The raw window is bounded first.
    //
    // Asserted by CONTENT, not by a clock. A timing bound is the obvious test
    // and it is a bad one \u2014 it passed with the fix reverted, because 400k
    // characters expand fast enough to beat any threshold loose enough not to
    // flake. This distinguishes the two behaviours exactly: whitespace collapses,
    // so a window of pure spaces sanitises to nothing at all, and the marker
    // sitting past the window can only appear in the output if the whole value
    // was read.
    // THE CONTENT SURVIVES A COLLAPSIBLE PREFIX. This assertion previously ran
    // the other way — it demanded the marker be ABSENT — which pinned a data
    // loss as if it were the bound working. Slicing the raw input first looks
    // like a bound and is not one, because sanitising CONTRACTS as well as
    // expanding: a window filled with whitespace collapses to nothing and takes
    // the content behind it with it. On a contradicting `meta.app` that is the
    // whole finding thrown away.
    const beyond = `${' '.repeat(MAX_MIGRATION_EVIDENCE_CHARS * 8 + 500)}eMoney`
    const found = identifyMigrationExport(projectionLabExport({ meta: { app: beyond } }))
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    const value = found.evidence.find((item) => item.locator.kind === 'jsonPath' && item.locator.path === 'meta.app')
    expect(value?.matched).toContain('eMoney')
    expect(value?.contradicts).toBe(true)

    // And the ordinary bound still holds on a value that survives the window.
    const long = identifyMigrationExport(projectionLabExport({ meta: { app: '\u200D'.repeat(50_000) } }))
    if (long?.outcome !== 'identified') throw new Error('expected an identification')
    const escaped = long.evidence.find((item) => item.locator.kind === 'jsonPath' && item.locator.path === 'meta.app')
    expect(escaped?.matched.length).toBeLessThanOrEqual(MAX_MIGRATION_EVIDENCE_CHARS)
  })
})

describe('published evidence contains only characters the file contained', () => {
  it('escapes a LONE surrogate, and leaves valid pairs alone', () => {
    // `Cs` is neither `Cc` nor `Cf`, so escaping only those let an unpaired
    // surrogate through — and JSON can legally decode one. A renderer shows it
    // as a replacement glyph, so evidence advertised as verbatim would display a
    // character that is not in the file and cannot be matched back to it. Same
    // failure as the clipping bug, arriving from the input side.
    const lone = String.fromCharCode(0xd800)
    const found = identifyMigrationExport(projectionLabExport({ meta: { app: `${lone}Acme 😀` } }))
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    const value = found.evidence.find((item) => item.locator.kind === 'jsonPath' && item.locator.path === 'meta.app')
    expect(value?.matched).toContain('<U+D800>')
    expect(value?.matched).toContain('😀')
    expect(value?.matched).not.toContain(lone)
  })

  it('escapes one in the file NAME too', () => {
    const pages = [docPage(1, 'Generated with RightCapital')]
    const items = buildMigrationReview(identifyMigrationDocument(pages), `${String.fromCharCode(0xdc00)}report.pdf`, { pages })
    expect(items[0]!.source).toContain('<U+DC00>')
  })
})

describe('an oversized export', () => {
  it('says it is too large rather than saying nothing, and still offers a way in', () => {
    // Two earlier answers were both wrong, in opposite directions. Scanning the
    // oversized body for names reported a file the ProjectionLab mapper had
    // refused ON SIZE as a file of unsubstantiated format — true sentence, wrong
    // problem. Then returning null produced no report at all, which made the
    // manual path for "the mapper would not take it" unreachable for the very
    // input that reaches it most.
    const huge = `{"currentFinances":{"accounts":[]},"pad":"${'x'.repeat(MAX_MIGRATION_TEXT_CHARS)}"}`
    const found = identifyMigrationExport(huge)
    expect(found?.outcome).toBe('too-large')

    const items = buildMigrationReview(found, 'big-export.json')
    expect(items).toHaveLength(1)
    // No vendor is claimed, because none was looked for.
    for (const vendor of MIGRATION_VENDORS) expect(items[0]!.detail).not.toContain(MIGRATION_ADAPTERS[vendor].displayName)
    expect(items[0]!.detail).toMatch(/nothing about it was examined/)
    expect(items[0]!.detail).toContain(NO_FORMAT_MANUAL_PATH)
    expect(roundTrip(items).ok).toBe(true)
  })
})

describe('multi-source envelopes', () => {
  it('attributes structural evidence to the right file when asked', () => {
    // The contract reads an omitted sourceIndex as sources[0], so in a session
    // combining several files every locator here silently pointed at the first
    // of them — evidence quoted from one file, filed against another.
    const identification = identifyMigrationExport(projectionLabExport())
    const items = buildMigrationReview(identification, 'second.json', { sourceIndex: 2 })
    const jsonLocators = items.map((item) => item.locator).filter((l) => l?.kind === 'jsonPath')
    expect(jsonLocators.length).toBeGreaterThan(0)
    for (const locator of jsonLocators) expect(locator).toMatchObject({ sourceIndex: 2 })
  })

  it('associates EVERY item with the source, including the identify-only vendors', () => {
    // The first version stamped only the evidence items, and only leaf locators.
    // But `none` is the majority of what this module emits — every page
    // citation, every limitation, every manual-path entry, and all name-tier
    // evidence — so for RightCapital, eMoney and MoneyGuide, which produce
    // nothing BUT `none`, the option did nothing whatever. It was added for
    // exactly those vendors.
    const pages = [docPage(3, 'Generated with RightCapital')]
    const items = buildMigrationReview(identifyMigrationDocument(pages), 'doc.pdf', { pages, sourceIndex: 2 })
    expect(items.length).toBeGreaterThan(3)
    // STRUCTURALLY, on every locator kind. The first attempt put "source 2" in
    // the free-text note of `none` locators, which reads as attribution to a
    // human and is none at all to a consumer — the contract still resolved the
    // omitted index to sources[0]. `./import-provenance` carries the field now.
    for (const item of items) {
      expect(item.locator).toBeDefined()
      expect(item.locator).toMatchObject({ sourceIndex: 2 })
      if (item.locator?.kind === 'none') expect(item.locator.note).not.toMatch(/source \d/)
    }
    // And it survives the real envelope, which bounds-checks every index it finds.
    const parsed = roundTripWithSources(items, 3)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      for (const entry of parsed.provenance.unresolved) expect(entry.locator).toMatchObject({ sourceIndex: 2 })
    }
  })

  it('names no source when no index was given', () => {
    const pages = [docPage(3, 'Generated with RightCapital')]
    const items = buildMigrationReview(identifyMigrationDocument(pages), 'doc.pdf', { pages })
    for (const item of items) expect(item.locator).not.toHaveProperty('sourceIndex')
  })
})

describe('classifyPage: all eight combinations of the three signals', () => {
  const CASES: ReadonlyArray<{ text: string; imageOnly: boolean; truncated: boolean; state: PageReadState }> = [
    { text: 'x', imageOnly: false, truncated: false, state: 'text' },
    { text: 'x', imageOnly: true, truncated: false, state: 'text' },
    { text: '', imageOnly: false, truncated: false, state: 'no-marks' },
    { text: '', imageOnly: true, truncated: false, state: 'image' },
    // `truncated` wins over everything: it is the only signal that says the
    // reader stopped partway, and a zero-character cap can empty a page that
    // really did hold text — so an empty truncated page is NOT a blank page.
    { text: 'x', imageOnly: false, truncated: true, state: 'clipped' },
    { text: 'x', imageOnly: true, truncated: true, state: 'clipped' },
    { text: '', imageOnly: false, truncated: true, state: 'clipped' },
    { text: '', imageOnly: true, truncated: true, state: 'clipped' },
  ]

  it('classifies every combination, and the table really is exhaustive', () => {
    expect(CASES).toHaveLength(8)
    expect(new Set(CASES.map((c) => `${c.text !== ''}|${c.imageOnly}|${c.truncated}`)).size).toBe(8)
    for (const c of CASES) {
      expect(classifyPage({ page: 1, text: c.text, imageOnly: c.imageOnly, truncated: c.truncated })).toBe(c.state)
    }
  })

  it('gives every state its own item, and every page lands in exactly one', () => {
    // One page per combination. Whatever the states are, no page may be silently
    // dropped from the report and none may be counted twice.
    const pages: DocumentPage[] = CASES.map((c, i) => ({
      page: i + 1,
      text: c.text,
      imageOnly: c.imageOnly,
      truncated: c.truncated,
    }))
    const withName: DocumentPage[] = [{ page: 99, text: 'Generated with RightCapital', imageOnly: false, truncated: false }, ...pages]
    const items = buildMigrationReview(identifyMigrationDocument(withName), 'all-states.pdf', { pages: withName })

    const cited = items
      .filter((item) => /— (text carried over|text cut short|an image the reader cannot read|nothing the reader could read)$/.test(item.source))
      .flatMap((item) => (item.detail.match(/\b\d+\b/g) ?? []).map(Number))
    for (const page of withName) expect(cited.filter((n) => n === page.page)).toHaveLength(1)
  })

  it('no page-state sentence claims more than its signal carries', () => {
    // The claims that were wrong were always interpretations laid over a signal:
    // `imageOnly` is set by ANY raster paint operation and measures no coverage,
    // and its absence says nothing about vector drawing. These assertions pin
    // the ceiling on what each sentence may assert.
    const page = (over: Partial<DocumentPage>): DocumentPage[] => [
      { page: 1, text: 'Generated with RightCapital', imageOnly: false, truncated: false },
      { page: 2, text: '', imageOnly: false, truncated: false, ...over },
    ]
    const detailFor = (over: Partial<DocumentPage>, fragment: string): string => {
      const pages = page(over)
      const items = buildMigrationReview(identifyMigrationDocument(pages), 'x.pdf', { pages })
      return items.find((item) => item.source.includes(fragment))?.detail ?? ''
    }

    // An image page may not assert it IS a scan, because a corner logo sets the
    // same flag.
    const image = detailFor({ imageOnly: true }, 'an image the reader cannot read')
    expect(image).toMatch(/logo or a watermark/)
    expect(image).not.toMatch(/\bis a scan\b/)

    // A textless page may not assert there is nothing to find, because outlined
    // text and vector drawing look identical to this reader.
    const none = detailFor({}, 'nothing the reader could read')
    expect(none).toMatch(/outlines/)
    expect(none).not.toMatch(/nothing to look for|genuinely empty\./)

    // A clipped page may not name which cap fired; both set the same boolean.
    const clipped = detailFor({ text: 'a', truncated: true }, 'text cut short')
    expect(clipped).not.toMatch(/per page/)
  })
})

/**
 * The other place case analysis kept being wrong: which pages never reached the
 * report. Three versions of that condition shipped, each wrong in a different
 * direction, so it is arithmetic now — and this enumerates the arithmetic.
 */
describe('omitted pages: counted, not case-analysed', () => {
  const summaryOf = (over: Partial<DocumentTextSummary>): DocumentTextSummary => ({
    totalPages: 1,
    pagesExtracted: 1,
    unreadablePages: [],
    imageOnlyPages: 0,
    noTextExtracted: false,
    totalTextChars: 10,
    truncated: false,
    truncatedBy: [],
    ...over,
  })

  const earlyStopFor = (summary: DocumentTextSummary): string | undefined => {
    const pages: DocumentPage[] = [{ page: 1, text: 'Generated with RightCapital', imageOnly: false, truncated: false }]
    const items = buildMigrationReview(identifyMigrationDocument(pages), 'x.pdf', { pages, summary })
    return items.find((item) => item.source.includes('stopped early'))?.detail
  }

  it('fires exactly when pages are unaccounted for, whatever the cause', () => {
    const CASES: ReadonlyArray<{ what: string; summary: DocumentTextSummary; fires: boolean }> = [
      { what: 'everything opened', summary: summaryOf({ totalPages: 3, pagesExtracted: 3 }), fires: false },
      // The over-fire: the cap clipped the LAST page, so it tripped while every
      // page had in fact been opened.
      { what: 'cap clipped the final page', summary: summaryOf({ totalPages: 1, pagesExtracted: 1, truncated: true, truncatedBy: ['document_text_cap'] }), fires: false },
      // The under-fire: one page failed, which used to silence the warning that
      // the other six were never reached at all.
      { what: 'one failed AND the rest never reached', summary: summaryOf({ totalPages: 9, pagesExtracted: 1, unreadablePages: [4] }), fires: true },
      // 1 extracted + 2 unreadable === 3 total: every page accounted for, so
      // there is no remainder to warn about even though two of them failed.
      { what: 'all accounted for as extracted or unreadable', summary: summaryOf({ totalPages: 3, pagesExtracted: 1, unreadablePages: [2, 3] }), fires: false },
      { what: 'pages missing with no cause recorded', summary: summaryOf({ totalPages: 5, pagesExtracted: 2 }), fires: true },
    ]
    for (const c of CASES) expect(`${c.what}: ${earlyStopFor(c.summary) !== undefined}`).toBe(`${c.what}: ${c.fires}`)
  })

  it('states the cause only when one was recorded', () => {
    // The count is what the arithmetic knows. Naming the text budget when
    // nothing recorded it is the same habit that made the condition wrong.
    const withCause = earlyStopFor(summaryOf({ totalPages: 9, pagesExtracted: 1, truncated: true, truncatedBy: ['document_text_cap'] }))
    expect(withCause).toMatch(/text budget/)
    const withoutCause = earlyStopFor(summaryOf({ totalPages: 9, pagesExtracted: 1 }))
    expect(withoutCause).toBeDefined()
    expect(withoutCause).not.toMatch(/text budget/)
  })
})

describe('identifyMigrationDocument', () => {
  it('refuses direct callers that bypass the document reader budgets', () => {
    expect(
      identifyMigrationDocument([
        docPage(1, `RightCapital${'x'.repeat(MAX_PAGE_TEXT_CHARS)}`),
      ]),
    ).toBeNull()

    const overTotal = Array.from({ length: Math.floor(MAX_DOCUMENT_TEXT_CHARS / MAX_PAGE_TEXT_CHARS) + 1 }, (_, index) =>
      docPage(index + 1, `${index === 0 ? 'eMoney' : ''}${'x'.repeat(MAX_PAGE_TEXT_CHARS - (index === 0 ? 6 : 0))}`),
    )
    expect(identifyMigrationDocument(overTotal)).toBeNull()

    const overPages = Array.from({ length: MAX_DOCUMENT_PAGES + 1 }, (_, index) =>
      docPage(index + 1, index === 0 ? 'MoneyGuidePro' : ''),
    )
    expect(identifyMigrationDocument(overPages)).toBeNull()
  })

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

  it('THE QUOTATION ALWAYS CONTAINS THE MATCH, whatever precedes it', () => {
    // The excerpt is assembled around the match rather than windowed and then
    // clipped, because sanitising happens after the window is chosen: thirty
    // control characters ahead of the name each expand to an eight-character
    // <U+0007>, and a clip from the right then cut off the very name being
    // quoted. An excerpt labelled "Matched:" that does not contain the match is
    // worse than no excerpt — it reads as if that is what the file says.
    const noisy = `${'\u0007'.repeat(30)}RightCapital retirement analysis`
    const found = identifyMigrationDocument([docPage(1, noisy)])
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    const matched = found.evidence[0]!.matched
    expect(matched).toContain('RightCapital')
    expect(matched.length).toBeLessThanOrEqual(MAX_MIGRATION_EVIDENCE_CHARS)
  })

  it('never splits a character at the CONTEXT boundary either', () => {
    // The clip at the end was made surrogate-safe first; the window boundaries
    // that select the context are computed the same way and were not. Two
    // padding characters put the left boundary inside an emoji rather than
    // between two — the excerpt then began with half a character, which renders
    // as a replacement character in evidence described as verbatim.
    const found = identifyMigrationDocument([docPage(1, `xx${'😀'.repeat(40)}RightCapital and more text after it`)])
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    const matched = found.evidence[0]!.matched
    const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
    expect(loneSurrogate.test(matched)).toBe(false)
    expect(matched).toContain('RightCapital')
  })

  it('keeps the spaces on either side of the match', () => {
    // Trimming each fragment separately glued the excerpt together —
    // "Generated withRightCapitalon March 14" — which stops it being verbatim at
    // the two positions a reader looks at first. Only the outer edges are
    // trimmed.
    const found = identifyMigrationDocument([docPage(1, 'Report generated with RightCapital on 14 March.')])
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    expect(found.evidence[0]!.matched).toContain('with RightCapital on')
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
    // Written as \u escapes, never as literal invisible characters. A literal one
    // is unreadable in review and unreadable in a diff — a BEL got into this file
    // exactly that way while these tests were being written, and nothing on
    // screen showed it. The escapes also name what each case is.
    const twins = [
      `Prepared using projectionlab\u200Doratory imaging equipment.`, // ZWJ
      `Report generated by eMoney\u00ADAdvisorSuite for the Smith household.`, // soft hyphen
      `Filed under projectionlab\u200Bs last spring.`, // zero-width space
      `See rightcapital\u200Eization of the trust corpus.`, // LRM — bidi mark
      `An eMoney\u2066Advisor engagement.`, // LRI — bidi isolate
      `The moneyguide\u202Epro handbook.`, // RLO — bidi override
      'The eMoneyübersicht was attached.', // ordinary non-ASCII letter
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

  it("reports a meta.app naming a DIFFERENT tool as evidence against, not for", () => {
    // A structurally matching file whose own label says "eMoney" was listing
    // that label among the evidence SUPPORTING a ProjectionLab identification —
    // corroboration of the opposite of what it says. The structural conclusion
    // stands (a shape is far harder to have by accident than a label) but the
    // contradiction is shown, because dropping it would leave a reviewer to find
    // it later as the one detail the report chose not to mention.
    const found = identifyMigrationExport(projectionLabExport({ meta: { app: 'eMoney' } }))
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    expect(found.vendor).toBe('projectionlab')
    const label = found.evidence.find((item) => item.locator.kind === 'jsonPath' && item.locator.path === 'meta.app')
    expect(label?.contradicts).toBe(true)

    const items = buildMigrationReview(found, 'export.json')
    expect(items.some((item) => item.detail.includes('does not name ProjectionLab'))).toBe(true)

    // A label that DOES name the tool is ordinary supporting evidence.
    const agreeing = identifyMigrationExport(projectionLabExport({ meta: { app: 'ProjectionLab' } }))
    if (agreeing?.outcome !== 'identified') throw new Error('expected an identification')
    expect(agreeing.evidence.every((item) => item.contradicts !== true)).toBe(true)
  })

  it('decides contradiction on the RAW label, before sanitising manufactures a boundary', () => {
    // Sanitising turns an invisible character into visible punctuation, and
    // punctuation is a legal name edge. So `ProjectionLab<ZWJ>oratory` — which
    // the raw pattern rejects for exactly the reason it rejects
    // `ProjectionLaboratory` — became `ProjectionLab<U+200D>oratory` and matched,
    // and a label naming a different product was published as SUPPORTING the
    // identification. The display transform was manufacturing the boundary the
    // check then found.
    const found = identifyMigrationExport(projectionLabExport({ meta: { app: 'ProjectionLab\u200Doratory' } }))
    if (found?.outcome !== 'identified') throw new Error('expected an identification')
    const label = found.evidence.find((item) => item.locator.kind === 'jsonPath' && item.locator.path === 'meta.app')
    expect(label?.contradicts).toBe(true)
    // And the reader can see WHY, because the escape is rendered.
    expect(label?.matched).toContain('<U+200D>')
  })

  it('offers a way forward when the ProjectionLab mapper ran and refused the file', () => {
    // The manual path is reached both when no mapper ran and when one ran and
    // failed — its own size cap, or a draft that fails plan validation. It used
    // to assume the first and tell the second to run the import that had just
    // failed, offering the broker/spreadsheet fallback only to PDFs.
    const path = MIGRATION_ADAPTERS.projectionlab.manualPath
    expect(path).toMatch(/already been tried/)
    expect(path).toMatch(/broker CSV or spreadsheet import/)
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
    const nasty = identifyMigrationExport(projectionLabExport({ meta: { app: 'Line1\nLine2\u0007 “quote”' } }))
    if (nasty?.outcome !== 'identified') throw new Error('expected an identification')
    expect(nasty.evidence[1]!.matched).toBe('Line1 Line2<U+0007> “quote”')
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
    // Past the cap the file is neither parsed nor scanned, so no vendor can be
    // claimed — but the answer is `too-large` rather than `null`, because "we
    // did not look" is a different fact from "we looked and found nothing", and
    // only the first still owes the reader a way in. See the oversized-export
    // suite for the report it produces.
    expect(identifyMigrationExport('x'.repeat(MAX_MIGRATION_TEXT_CHARS + 1))?.outcome).toBe('too-large')
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
    // NOTHING, not a shorter report. Every status in this vocabulary means
    // something: mapped/defaulted claim a value landed, unmapped/skipped file
    // under `unresolved`. An identification note is neither — no value landed,
    // and nothing is outstanding — so emitting it as `unmapped` put it under the
    // checklist's "Not imported — add by hand" heading and recorded it in the
    // envelope as an unresolved import problem, contradicting its own text. The
    // vocabulary has no informational status, so when a real mapper handled the
    // file, ITS checklist is the report and this module has nothing to add.
    const items = buildMigrationReview(identifyMigrationExport(projectionLabExport()), 'projectionlab-export.json', {
      mapped: true,
    })
    expect(items).toEqual([])
  })

  it('a CONTRADICTION survives a successful map, because nothing else would raise it', () => {
    // The mapped path emits nothing — except this. `projectionLab.ts` never
    // reads `meta.app`, so a file whose SHAPE says ProjectionLab and whose own
    // LABEL says eMoney would otherwise be mapped with nobody told about the
    // conflict: the mapper's checklist cannot supply a warning about a field it
    // does not look at. `unmapped` is the right status here, unlike the plain
    // identification note — this is a question the reviewer has to answer.
    const found = identifyMigrationExport(projectionLabExport({ meta: { app: 'eMoney' } }))
    const items = buildMigrationReview(found, 'export.json', { mapped: true })
    expect(items).toHaveLength(1)
    expect(items[0]!.detail).toContain('does not name ProjectionLab')
    expect(items[0]!.detail).toMatch(/never reads this field/)
    expect(roundTrip(items).ok).toBe(true)

    // A mapped file with NO conflict still says nothing at all.
    const clean = identifyMigrationExport(projectionLabExport({ meta: { app: 'ProjectionLab' } }))
    expect(buildMigrationReview(clean, 'export.json', { mapped: true })).toEqual([])
  })

  it('THE CLAIM MUST BE EARNED: recognising the shape is not evidence the mapper ran', () => {
    // Nothing in this module invokes a mapper. A host can identify a file and
    // build the report without ever calling mapProjectionLabExport, and that
    // mapper can also REFUSE a file it recognises — its own size cap, or a draft
    // that fails plan validation. Claiming "mapped by the projectionLab import"
    // on a structural match alone pointed the reader at a checklist that did not
    // exist, and returned early, withholding the limitations and the manual path
    // from the one user who most needed them: the one whose import just failed.
    const identification = identifyMigrationExport(projectionLabExport())
    const unclaimed = buildMigrationReview(identification, 'projectionlab-export.json')
    const details = unclaimed.map((item) => item.detail)
    expect(details.every((detail) => !detail.includes('mapped by the projectionLab import'))).toBe(true)
    expect(details).toContain(MIGRATION_ADAPTERS.projectionlab.manualPath)
    expect(unclaimed.length).toBeGreaterThan(1)
    // Saying so explicitly is the only thing that shortens the report.
    expect(buildMigrationReview(identification, 'projectionlab-export.json', { mapped: false })).toEqual(unclaimed)
    expect(buildMigrationReview(identification, 'projectionlab-export.json', { mapped: true })).toEqual([])
  })

  it('reports a scanned page and a clipped page as their own states, never as text that came across', () => {
    // extractDocumentText returns three kinds of page and they mean three
    // different things to somebody about to retype values by hand. Listed
    // together under "text was read and carried over as-is", a scan carrying no
    // text and a page clipped at the reader's cap both read as complete — hiding
    // the OCR case WS5 declined to scope, and hiding missing values on a page
    // that looks whole.
    // FOUR states, and `text === ''` alone names none of them: a page with no
    // text is a SCAN when imageOnly says so and genuinely EMPTY when it does
    // not, and the remediation is opposite. Sending a reader hunting for figures
    // on a blank page is the same defect as letting a scan read as blank, just
    // pointed the other way.
    const pages: DocumentPage[] = [
      { page: 1, text: 'Prepared using eMoney Advisor', imageOnly: false, truncated: false },
      { page: 2, text: '', imageOnly: true, truncated: false },
      { page: 3, text: 'Holdings detail continues', imageOnly: false, truncated: true },
      { page: 4, text: '', imageOnly: false, truncated: false },
    ]
    const items = buildMigrationReview(identifyMigrationDocument(pages), 'emoney-report.pdf', { pages })
    const find = (fragment: string): ImportReviewItem | undefined => items.find((item) => item.source.includes(fragment))

    const carried = find('text carried over')
    expect(carried?.detail).toContain('page 1')
    for (const absent of ['2', '3', '4']) expect(carried?.detail).not.toContain(absent)

    // Must not blame the PER-PAGE cap: `truncated` is set by that cap and by the
    // document-wide budget running out partway through a page, and the page
    // cannot tell them apart — so naming one would be a guess, wrong on exactly
    // the long documents where it matters. The remedy is the same either way.
    // The report NAMES pages worth reading; it does not carry their text. It
    // used to say the text was "carried over as-is", which a consumer of
    // buildMigrationReview cannot act on — page text never enters an
    // ImportReviewItem, only the capped evidence excerpts do.
    expect(carried).toBeDefined()
    expect(carried?.detail).not.toMatch(/carried over as-is/)
    expect(carried?.detail).toMatch(/does not carry|names those pages/)

    expect(find('text cut short')?.detail).toContain('3')
    expect(find('text cut short')?.detail).not.toMatch(/per page/)
    expect(find('an image the reader cannot read')?.detail).toMatch(/OCR/)
    // Neither sentence may out-claim `imageOnly`, which is set by ANY raster
    // paint operation and measures no page coverage: it cannot tell a full-page
    // scan from a corner logo, and it says nothing at all about vector drawing.
    // So the image page must not assert "this is a scan", and the textless page
    // must not assert "there is nothing here" — a report whose text was
    // converted to outlines looks identical to a blank page from where the
    // reader stands.
    expect(find('an image the reader cannot read')?.detail).toMatch(/logo or a watermark/)
    expect(find('nothing the reader could read')?.detail).toMatch(/outlines/)
    expect(find('nothing the reader could read')?.detail).not.toMatch(/OCR/)
    expect(roundTrip(items).ok).toBe(true)
  })

  it('names the pages that never reached the report at all', () => {
    // A page pdfjs failed on is ABSENT from `pages`, and so is every page beyond
    // a document-wide cap. "A page that could not be extracted is simply missing
    // from the list" was true and useless — it told a reader something might be
    // absent without telling them what to go and open.
    const pages: DocumentPage[] = [{ page: 1, text: 'Generated with RightCapital', imageOnly: false, truncated: false }]
    const summary: DocumentTextSummary = {
      totalPages: 9,
      pagesExtracted: 1,
      unreadablePages: [4, 6],
      imageOnlyPages: 0,
      noTextExtracted: false,
      totalTextChars: 27,
      truncated: true,
      truncatedBy: ['document_text_cap'],
    }
    const items = buildMigrationReview(identifyMigrationDocument(pages), 'rc.pdf', { pages, summary })
    const unreadable = items.find((item) => item.source.includes('could not be read'))
    expect(unreadable?.detail).toContain('4, 6')
    // An unreadable page is UNCLASSIFIED. pdfjs threw before anything could be
    // learned, so the report may not rule out a scan — doing so steers a reader
    // away from OCR on the one page where nothing at all is known.
    expect(unreadable?.detail).not.toMatch(/not a scan|not blank/)
    expect(unreadable?.detail).toMatch(/whether OCR would help/)
    // BOTH, together. Deciding early stopping from the page counts required zero
    // unreadable pages, so a single failed page anywhere silenced the warning
    // that every LATER page was never opened at all — the report then named the
    // one failure and said nothing about the rest of the document.
    expect(items.find((item) => item.source.includes('stopped early'))).toBeDefined()
    expect(roundTrip(items).ok).toBe(true)

    const stopped = buildMigrationReview(identifyMigrationDocument(pages), 'rc.pdf', {
      pages,
      summary: { ...summary, unreadablePages: [] },
    })
    expect(stopped.find((item) => item.source.includes('stopped early'))?.detail).toContain('1 of 9 pages')

    // ...but NOT when the cap clipped the last page and every page was opened.
    // `truncatedBy` trips in that case too, and the item then announced a
    // remainder that does not exist ("1 of 1 pages were opened, and the rest
    // were never looked at"). The clipped-page item already reports what was
    // lost off the end of that page. This condition has now been wrong in both
    // directions — inferring from page counts under-fired, `truncatedBy` alone
    // over-fires — so it takes both.
    const clippedLastPage = buildMigrationReview(identifyMigrationDocument(pages), 'rc.pdf', {
      pages,
      summary: { ...summary, totalPages: 1, pagesExtracted: 1, unreadablePages: [] },
    })
    expect(clippedLastPage.find((item) => item.source.includes('stopped early'))).toBeUndefined()
  })

  it('sanitises the FILE NAME as well as the file contents', () => {
    // The name is attacker-controlled in exactly the sense the contents are — a
    // browser hands over whatever the file is called — and it is interpolated
    // into every label and locator note. A bidi override in it reorders the
    // displayed evidence line; a newline fractures exported provenance text.
    const items = buildMigrationReview(
      identifyMigrationDocument([docPage(1, 'Generated with RightCapital')]),
      'statement\u202Efdp.pdf\nSECOND LINE',
      {},
    )
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.source).not.toMatch(/[\p{Cc}\p{Cf}]/u)
      expect(item.source).toContain('<U+202E>')
    }
    expect(roundTrip(items).ok).toBe(true)
  })

  it('never clips an evidence excerpt through the middle of a character', () => {
    // slice() counts UTF-16 code units and every astral character is two of
    // them, so a cut between the halves leaves a lone surrogate that renders as
    // a replacement character — a character this module invented, published as a
    // verbatim quotation of the file.
    const long = identifyMigrationExport(projectionLabExport({ meta: { app: '😀'.repeat(200) } }))
    if (long?.outcome !== 'identified') throw new Error('expected an identification')
    const matched = long.evidence[1]!.matched
    expect(matched.length).toBeLessThanOrEqual(MAX_MIGRATION_EVIDENCE_CHARS)
    // A LONE surrogate, not any surrogate — every emoji here is a well-formed
    // pair of them, so testing for surrogates at all would fail on correct output.
    const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
    expect(loneSurrogate.test(matched)).toBe(false)
    expect([...matched].every((ch) => ch === '😀' || ch === '…')).toBe(true)
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
