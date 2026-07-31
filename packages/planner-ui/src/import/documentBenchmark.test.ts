/**
 * Pins the WS5 accuracy benchmark.
 *
 * Two different kinds of assertion live here and the difference matters:
 *
 *  - The corpus checks and the honest-refusal checks are **oracle** tests. The
 *    expected values were written by hand in `documentCorpus.ts` before any
 *    extraction ran, so they can genuinely disagree with the app.
 *  - The precision/recall floors are **characterization**. They record what
 *    this implementation achieves today so a regression is caught; they are
 *    not a promise, and the spike has not shipped one. Where extraction is
 *    poor the number is asserted at its poor value with a comment saying so —
 *    weakening an assertion to make a bad result pass would defeat the whole
 *    point of measuring.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

import {
  CORPUS_FIELDS,
  buildDocumentCorpus,
  type CorpusDocument,
  type CorpusFieldName,
} from './documentCorpus'
import {
  detectFields,
  formatDocumentBenchmarkReport,
  runDocumentBenchmark,
  type DocumentBenchmarkReport,
} from './documentBenchmark'
import { buildSyntheticPdf } from './pdfFixtures'

/** One run for the whole file; the corpus is fixed, so the report is too. */
let cached: Promise<DocumentBenchmarkReport> | undefined
const report = (): Promise<DocumentBenchmarkReport> => (cached ??= runDocumentBenchmark())

const field = (result: DocumentBenchmarkReport, name: CorpusFieldName) =>
  result.fields.find((entry) => entry.field === name)!

const document = (result: DocumentBenchmarkReport, id: string) =>
  result.documents.find((entry) => entry.id === id)!

/** Whitespace-insensitive comparison; a line's runs are joined with a space. */
const collapse = (value: string): string => value.replace(/\s+/g, ' ').trim()

/**
 * A two-page throwaway document whose values the caller states independently.
 * Used to prove the scorer and the formatter can report failures the real
 * corpus does not contain — including a value the document never prints, which
 * a corpus document is forbidden to declare.
 */
const oneOffProbe = (overrides: Partial<CorpusDocument>): CorpusDocument => ({
  id: 'probe',
  kind: 'broker_statement',
  label: 'probe',
  bytes: buildSyntheticPdf({
    pages: [{ lines: ['Account number ****1111'], fontSize: 10 }, { lines: ['Nothing here'], fontSize: 10 }],
  }),
  pageSources: ['Account number ****1111', 'Nothing here'],
  expectedOutcome: 'ok',
  expectedImageOnlyPages: [],
  expected: [],
  ...overrides,
})

describe('the corpus is an independent oracle', () => {
  it('covers the document shapes WS5 names and the failure shapes it must refuse', () => {
    const kinds = buildDocumentCorpus().map((entry) => entry.kind)
    for (const required of [
      'broker_statement',
      'old_plan',
      'form_1040',
      'scanned',
      'mixed_scan',
      'encrypted',
      'corrupt',
      'not_pdf',
    ]) {
      expect(kinds, `the corpus must contain a ${required} document`).toContain(required)
    }
  })

  it('plants every expected value on a page the document actually has', () => {
    for (const entry of buildDocumentCorpus()) {
      const ids = new Set(entry.expected.map((value) => `${value.field}/${value.value}/${value.page}`))
      expect(ids.size, `${entry.id} declares a duplicate expectation`).toBe(entry.expected.length)
      for (const value of entry.expected) {
        expect(Number.isInteger(value.page)).toBe(true)
        expect(value.page, `${entry.id}: page numbers are 1-based`).toBeGreaterThanOrEqual(1)
        expect(value.value.length, `${entry.id}: an expected value may not be empty`).toBeGreaterThan(0)
        expect(CORPUS_FIELDS).toContain(value.field)
      }
    }
  })

  it('gives every document unique bytes and a unique id', () => {
    const corpus = buildDocumentCorpus()
    expect(new Set(corpus.map((entry) => entry.id)).size).toBe(corpus.length)
    const shapes = corpus.map((entry) => `${entry.bytes.length}`)
    // Not a strict uniqueness claim — just that nothing is a zero-length stub.
    for (const shape of shapes) expect(Number(shape)).toBeGreaterThan(0)
  })

  it('states every planted value as its page PRINTS it, not as a detector emits it', () => {
    // The guard against the way this oracle actually gets corrupted: not by
    // deriving it from a run, but by trimming a declared value until it matches
    // what the reader happens to say. `Individual Brokerage` declared as the
    // bare `Brokerage` — the exact token the detector's closed vocabulary
    // produces — scored as a hit while describing a page that says something
    // else. `pageSources` comes from the same declaration the bytes do, so this
    // compares the oracle against the DOCUMENT, never against the extractor.
    for (const entry of buildDocumentCorpus()) {
      for (const planted of entry.expected) {
        const source = entry.pageSources[planted.page - 1] ?? ''
        expect(
          collapse(source),
          `${entry.id} page ${planted.page} must print ${planted.field} "${planted.value}" verbatim`,
        ).toContain(collapse(planted.value))
      }
    }
  })

  it('plants NO value on a page the corpus does not render', () => {
    // The other way the oracle got corrupted, and the more damaging one: values
    // were declared on image-only pages on the theory that they were "on the
    // paper". `buildSyntheticPdf`'s `image: true` paints a 1x1 constant-grey
    // sample stretched over the page — there is no glyph in those bytes at all.
    // Counting `ELEANOR J WHITFIELD` as a false negative measured its ABSENCE
    // from a document that never held it, and the resulting eight "OCR gaps"
    // were quoted as the size of the OCR opportunity. A planted value must sit
    // on a page that authors text.
    for (const entry of buildDocumentCorpus()) {
      for (const planted of entry.expected) {
        expect(
          entry.expectedImageOnlyPages,
          `${entry.id}: ${planted.field} "${planted.value}" is planted on image-only page ${planted.page}`,
        ).not.toContain(planted.page)
        expect(
          entry.pageSources[planted.page - 1] ?? '',
          `${entry.id} page ${planted.page} authors nothing, so it can hold no value`,
        ).not.toBe('')
      }
    }
  })

  it('keeps the scanned documents, because image-only DETECTION is still a real measurement', () => {
    // Removing the phantom values must not quietly remove the documents. A
    // fully scanned document and a typed cover page in front of a scanned
    // insert are the two shapes that prove a page is reported as scanned rather
    // than as an empty success — the signal a UI routes manual entry from.
    const corpus = buildDocumentCorpus()
    const scanned = corpus.find((entry) => entry.id === 'scanned-statement')!
    expect(scanned.expectedOutcome).toBe('ok')
    expect(scanned.expectedImageOnlyPages).toEqual([1, 2])
    expect(scanned.expected).toEqual([])

    const mixed = corpus.find((entry) => entry.id === 'mixed-scan-statement')!
    expect(mixed.expectedImageOnlyPages).toEqual([2])
    // The cover page still carries values; only the insert stopped claiming any.
    expect(mixed.expected.map((planted) => planted.page)).toEqual([1, 1, 1])
  })

  it('expects nothing from the documents that must be refused', () => {
    for (const entry of buildDocumentCorpus()) {
      if (entry.expectedOutcome === 'ok') continue
      expect(entry.expected, `${entry.id} is refused, so it can have no readable fields`).toEqual([])
    }
  })
})

describe('unsupported documents fail honestly — the WS5 acceptance criterion', () => {
  it('refuses every unreadable document for the reason the corpus declares', async () => {
    const result = await report()
    expect(result.outcomes.mismatches).toEqual([])
    expect(result.outcomes.asExpected).toBe(result.outcomes.documentsChecked)
    expect(result.outcomes.documentsChecked).toBe(8)
  })

  it('names the three refusal reasons a user can act on', async () => {
    const result = await report()
    expect(document(result, 'encrypted-statement').actualOutcome).toBe('encrypted')
    expect(document(result, 'corrupt-statement').actualOutcome).toBe('corrupt')
    expect(document(result, 'broker-positions-csv').actualOutcome).toBe('not_pdf')
  })

  it('finds every scanned page and invents none', async () => {
    const result = await report()
    expect(result.imageOnly.pagesExpected).toBe(3)
    expect(result.imageOnly.pagesDetected).toBe(3)
    expect(result.imageOnly.falsePositives).toBe(0)
    expect(result.imageOnly.falseNegatives).toBe(0)
    // The statement's blank separator page must NOT be called scanned: sending
    // a user to OCR over an empty page is the failure this guards.
    expect(document(result, 'broker-statement').actualImageOnlyPages).toEqual([])
  })
})

describe('the floor today (characterization — measurements, not guarantees)', () => {
  /**
   * Measured 2026-07-25 against pdfjs-dist 6.1.200. Precision is poor and is
   * recorded at its poor values on purpose. `date` at 57% precision means a
   * naive date scan proposes roughly two wrong dates for every three right
   * ones — that is the finding, and softening the assertion would erase it.
   *
   * **Every recall floor moved UP when the phantom values were removed, and
   * none of it is an improvement in the extractor.** The corpus used to declare
   * eight values on image-only pages that paint a featureless raster and hold no
   * glyphs; all eight scored as false negatives, dragging five of the six recall
   * numbers down. They were never in the documents. Removing them is a
   * correction to the oracle — not one line of extraction changed — and the
   * recalls below are what this extractor was achieving all along:
   *  - `name` 60.0% → 75.0%, `account_number` 83.3% → 100%,
   *    `account_type` 71.4% → 83.3%, `account_balance` 50.0% → 100%,
   *    `date` 66.7% → 100%. `form_amount` was already 100%.
   *  - **No precision moved at all** (75.0 / 71.4 / 55.6 / 16.7 / 44.4 / 57.1).
   *    A value nothing detected claimed no detection, so removing it changed no
   *    numerator and no denominator on that side. Selection is still the
   *    bottleneck, exactly as before.
   *
   * Precision here is still lower than an earlier revision reported, for two
   * reasons that stand: `account_type` at 55.6% because the statement's page 2
   * prints "Individual Brokerage" where the corpus once declared the bare
   * "Brokerage" (the token the detector emits); and `account_balance` /
   * `form_amount` because they replaced a single `balance` field that averaged
   * a custodian's account values with a 1040's line amounts, and one money
   * scanner feeds both, so a wrong amount is charged to both.
   */
  const FLOORS: Record<CorpusFieldName, { precision: number; recall: number }> = {
    name: { precision: 0.75, recall: 0.75 },
    account_number: { precision: 0.71, recall: 1 },
    account_type: { precision: 0.55, recall: 0.83 },
    account_balance: { precision: 0.16, recall: 1 },
    form_amount: { precision: 0.44, recall: 1 },
    date: { precision: 0.57, recall: 1 },
  }

  it('reports precision AND recall for every field — never one without the other', async () => {
    const result = await report()
    expect(result.fields.map((entry) => entry.field)).toEqual([...CORPUS_FIELDS])
    for (const entry of result.fields) {
      expect(entry.expected, `${entry.field} must be planted somewhere`).toBeGreaterThan(0)
      expect(entry.precision, `${entry.field} precision`).not.toBeNull()
      expect(entry.recall, `${entry.field} recall`).not.toBeNull()
    }
  })

  it('holds the per-field floor', async () => {
    const result = await report()
    for (const name of CORPUS_FIELDS) {
      const entry = field(result, name)
      expect(entry.precision!, `${name} precision regressed`).toBeGreaterThanOrEqual(FLOORS[name].precision)
      expect(entry.recall!, `${name} recall regressed`).toBeGreaterThanOrEqual(FLOORS[name].recall)
    }
  })

  it('scores no field on a scanned document, and reports n/a rather than a zero', async () => {
    const result = await report()
    const scanned = document(result, 'scanned-statement')
    // The document is still in the corpus and still read. It just makes no
    // field claim, because there is nothing on it to claim: `recall` is null
    // (0/0 is not zero recall) rather than the 0% an empty oracle would have
    // produced, and there are no misses to explain.
    expect(scanned.expected).toBe(0)
    expect(scanned.recall).toBeNull()
    expect(scanned.precision).toBeNull()
    expect(scanned.misses).toEqual([])
    expect(scanned.truePositives).toBe(0)
    expect(scanned.falsePositives).toBe(0)
    // Its whole contribution is that both pages came back image-only, and
    // neither came back as a page with a text layer.
    expect(scanned.actualImageOnlyPages).toEqual([1, 2])
    expect(scanned.textLayerPages).toEqual([])
  })

  it('reads the typed half of a mixed document and flags the scanned half', async () => {
    const result = await report()
    const mixed = document(result, 'mixed-scan-statement')
    // Page 1 carries all three planted values; page 2 carries none and is
    // reported image-only. The per-page answer is the product requirement.
    expect(mixed.expected).toBe(3)
    expect(mixed.textLayerPages).toEqual([1])
    expect(mixed.actualImageOnlyPages).toEqual([2])
    // The one miss is the abutted name on the TYPED page — a selection defect
    // over text that extracted perfectly, which no OCR engine would touch.
    expect(mixed.misses.map((miss) => miss.field)).toEqual(['name'])
    expect(mixed.misses[0]!.textPresent).toBe(true)
  })

  it('has exactly two misses in the whole corpus, and both are selection defects', async () => {
    const result = await report()
    // 1. The mixed-scan cover page sets the account holder against a page
    //    counter with no gap, so pdfjs returns "…BRENNANPage 1 of 2" and the
    //    name detector's end-of-line anchor fails.
    const mixed = document(result, 'mixed-scan-statement')
    expect(mixed.misses.find((miss) => miss.field === 'name')?.textPresent).toBe(true)
    // 2. The statement's second account is an "Individual Brokerage"; the
    //    detector's closed vocabulary can only ever emit "Brokerage". The
    //    characters are all there, so this is a selection gap —
    //    and it is only visible because the corpus states the printed value
    //    instead of the token the detector happens to produce.
    const statement = document(result, 'broker-statement')
    const typeMiss = statement.misses.find((miss) => miss.field === 'account_type')
    expect(typeMiss?.value).toBe('Individual Brokerage')
    expect(typeMiss?.textPresent).toBe(true)

    // And that is the lot. Every miss in this corpus is a value whose
    // characters extracted perfectly and whose selection failed. Nothing is
    // missed for want of OCR, because nothing is planted where OCR would be the
    // question — the eight that used to be were never in the documents.
    expect(result.aggregate.falseNegatives).toBe(2)
    expect(result.aggregate.missesTextPresent).toBe(2)
    expect(result.aggregate.missesTextAbsent).toBe(0)
  })

  it('attributes every value it does find to the right page', async () => {
    const result = await report()
    expect(result.aggregate.citationsChecked).toBeGreaterThan(20)
    expect(result.aggregate.citationAccuracy).toBe(1)
    for (const entry of result.fields) {
      if (entry.citationsChecked === 0) continue
      expect(entry.citationAccuracy, `${entry.field} page citation`).toBe(1)
    }
  })

  it('exercises page citation on exactly one duplicated value — which is what 100% here means', () => {
    // The honest scope of the citation number. Attribution is strict
    // first-occurrence, so a value printed on a page other than the one it was
    // planted on WOULD be reported as mis-cited (proved by the scorer specs
    // below). But this corpus prints only ONE planted value on more than one
    // page — "Roth IRA", on the statement's page 1 and again in its page-4
    // disclosures — and there the first occurrence and the planted page agree.
    // So 100% means "nothing was attributed to a page it is not on", NOT "the
    // attribution is robust when a document repeats a value". The findings note
    // says exactly this; if this list ever changes, that prose is stale.
    const repeats: string[] = []
    for (const entry of buildDocumentCorpus()) {
      for (const planted of entry.expected) {
        const pagesPrinting = entry.pageSources.filter((source) =>
          collapse(source).includes(collapse(planted.value)),
        ).length
        if (pagesPrinting > 1) repeats.push(`${entry.id}: ${planted.field} ${planted.value}`)
      }
    }
    expect(repeats).toEqual(['broker-statement: account_type Roth IRA'])
  })

  it('measures recall only over pages extraction returned a text layer for', async () => {
    const result = await report()
    // The invariant that replaced the old "recall by surface" table. That table
    // reported 0/8 in a "no text layer" column and the spike quoted it as the
    // OCR gap; the eight were never printed on anything. Recall is meaningful
    // only where text exists, so the corpus plants values only there — and this
    // is checked against what extraction RETURNED, not against the corpus's own
    // `expectedImageOnlyPages`, so it also catches a value planted on a page
    // that failed to read or was never reached.
    expect(result.coverage.onPagesWithoutTextLayer).toBe(0)
    expect(result.coverage.onTextLayerPages).toBe(result.coverage.plantedValues)
    expect(result.coverage.plantedValues).toBe(30)
    // …and the aggregate recall is now a plain text-layer recall, needing no
    // column to qualify it.
    expect(result.aggregate.expected).toBe(30)
    expect(result.aggregate.recall!).toBeGreaterThanOrEqual(0.93)
  })

  it('still detects every image-only page — the one thing the scanned documents prove', async () => {
    const result = await report()
    // Deliberately restated inside the floor block: when the phantom values
    // came out, this became the entire measured contribution of the two scanned
    // documents, and it must not be allowed to drift away unnoticed.
    expect(result.imageOnly).toEqual({
      pagesExpected: 3,
      pagesDetected: 3,
      falsePositives: 0,
      falseNegatives: 0,
    })
  })
})

describe('the report cannot be quoted as a single number', () => {
  it('never renders the corpus total without the per-field table above it', async () => {
    const text = formatDocumentBenchmarkReport(await report())
    expect(text).toContain('PER FIELD')
    for (const name of CORPUS_FIELDS) expect(text).toContain(name)
    // The plan: "no launch claim based only on aggregate accuracy". The
    // formatter is the only renderer, and it puts the breakdown first.
    expect(text.indexOf('PER FIELD')).toBeLessThan(text.indexOf('CORPUS TOTAL'))
    expect(text).toMatch(/not quotable on its own/)
  })

  it('names every miss with the page it was expected on', async () => {
    const text = formatDocumentBenchmarkReport(await report())
    expect(text).toContain('text present: selection gap')
    // Both surviving misses, named with their page.
    expect(text).toContain('p2 Individual Brokerage')
    expect(text).toContain('p1 SAMUEL O BRENNAN')
  })

  it('refuses to present anything in it as an OCR measurement', async () => {
    const text = formatDocumentBenchmarkReport(await report())
    // The report used to carry a "RECALL BY SURFACE — the OCR decision" table
    // whose second column, 0/8, counted values declared on pages that paint a
    // featureless raster and print nothing. A reader could quote that as the
    // size of the OCR opportunity, and the spike did. It is gone, and the
    // report now says outright what it cannot tell you.
    expect(text).not.toContain('the OCR decision')
    expect(text).not.toContain('OCR gap')
    expect(text).toContain('LIMITATION: OCR recoverability is NOT measured here')
    expect(text).toContain('Neither is an OCR number.')
    // What DOES survive about scanned pages, stated as the measurement it is.
    expect(text).toContain('IMAGE-ONLY PAGE DETECTION')
    expect(text).toContain('planted 3, detected 3, false positives 0, false negatives 0')
    // And the precondition every recall number above it depends on.
    expect(text).toContain('30 on a page extraction returned a text layer for; 0 on a page it did not.')
  })

  it('can still render an extraction gap when there is one to render', async () => {
    // `miss:ext` is zero on the real corpus, so the wording would rot unseen.
    // A probe that plants a value the document does not print exercises the
    // branch. (It deliberately breaks the corpus rule — a corpus document may
    // only plant what its page authors — which is why it lives here and not
    // there.)
    const text = formatDocumentBenchmarkReport(
      await runDocumentBenchmark([
        oneOffProbe({ expected: [{ field: 'account_number', value: '****9999', page: 1 }] }),
      ]),
    )
    expect(text).toContain('text lost: extraction gap')
    expect(text).toContain('miss:ext')
  })
})

describe('the scorer can report a failure — otherwise it measures nothing', () => {
  const oneOff = oneOffProbe

  it('counts a wrong-page hit as found but mis-cited', async () => {
    // The value IS on page 1; the corpus claims page 2. Extraction did its job
    // and the citation did not, and the report has to be able to say so — if
    // citation accuracy could only ever be 100% it would not be a measurement.
    const result = await runDocumentBenchmark([
      oneOff({ expected: [{ field: 'account_number', value: '****1111', page: 2 }] }),
    ])
    const score = document(result, 'probe')
    expect(score.truePositives).toBe(1)
    expect(score.falseNegatives).toBe(0)
    expect(score.citationsChecked).toBe(1)
    expect(score.citationsCorrect).toBe(0)
    expect(score.citationAccuracy).toBe(0)
  })

  it('credits the FIRST occurrence of a repeated value, so a later-page plant is mis-cited', async () => {
    // The falsifier for the citation number. `****1111` is printed on BOTH
    // pages; the corpus claims page 2. A scorer that looked for the planted
    // page first would silently match the page-2 copy and report 100% — which
    // is why it could not report a citation defect for any repeated value at
    // all. Strict first-occurrence attribution takes the page-1 copy and says
    // the citation is wrong.
    const result = await runDocumentBenchmark([
      oneOff({
        bytes: buildSyntheticPdf({
          pages: [
            { lines: ['Account number ****1111'], fontSize: 10 },
            { lines: ['Account number ****1111 continued'], fontSize: 10 },
          ],
        }),
        pageSources: ['Account number ****1111', 'Account number ****1111 continued'],
        expected: [{ field: 'account_number', value: '****1111', page: 2 }],
      }),
    ])
    const score = document(result, 'probe')
    expect(score.truePositives).toBe(1)
    expect(score.citationsChecked).toBe(1)
    expect(score.citationsCorrect).toBe(0)
    expect(score.citationAccuracy).toBe(0)
    // The page-2 copy is then an unclaimed detection. Strictness costs a false
    // positive; the alternative was a number that could not move.
    expect(score.falsePositives).toBe(1)
  })

  it('counts a value that is simply not there as a miss with the text absent', async () => {
    // The extraction-gap branch. The real corpus can no longer produce one —
    // every planted value is on a page that authors it — so this probe is the
    // only thing keeping `missesTextAbsent` from being dead code, and it plants
    // a value the document does not print on purpose.
    const result = await runDocumentBenchmark([
      oneOff({ expected: [{ field: 'account_number', value: '****9999', page: 1 }] }),
    ])
    const score = document(result, 'probe')
    expect(score.recall).toBe(0)
    expect(score.missesTextAbsent).toBe(1)
    // …and the value that WAS on the page is a false positive, because nothing
    // asked for it. Precision is only meaningful if unwanted output costs.
    expect(score.falsePositives).toBe(1)
    expect(score.precision).toBe(0)
  })

  it('reports a mismatched outcome instead of scoring around it', async () => {
    const result = await runDocumentBenchmark([oneOff({ expectedOutcome: 'encrypted' })])
    expect(result.outcomes.mismatches).toEqual(['probe: expected encrypted, got ok'])
    expect(result.outcomes.asExpected).toBe(0)
  })
})

describe('the benchmark is test instrumentation, not published surface', () => {
  it('is excluded from the published tarball the way src/report/goldens is', () => {
    // Only the extraction module was ever meant to be on the published surface.
    // The `./*` wildcard would otherwise let a consumer import the scorer, the
    // corpus and the PDF emitter — tens of kilobytes of instrumentation with no
    // stability promise, shipped to every host that installs the package. The
    // `files` deny-entries are the fix, and this is what keeps them there.
    const packageJson = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
    ) as { files: string[] }

    for (const module of ['documentBenchmark', 'documentCorpus', 'pdfFixtures']) {
      expect(packageJson.files, `${module}.ts must not ship`).toContain(`!src/import/${module}.ts`)
    }
    // …while the module that IS published stays published.
    expect(packageJson.files).not.toContain('!src/import/documentText.ts')
  })
})

describe('the detectors are general, not fitted to the corpus', () => {
  it('finds fields in text the corpus never contains', () => {
    const found = detectFields(
      ['Account holder: RUTH M CALLOWAY', 'Account number ****0091', 'Rollover IRA', 'Value $8,412.00 on 01/15/2024'].join(
        '\n',
      ),
    )
    expect(found.name).toContain('RUTH M CALLOWAY')
    expect(found.account_number).toContain('****0091')
    expect(found.account_type).toContain('Rollover IRA')
    expect(found.account_balance).toContain('$8,412.00')
    expect(found.date).toContain('01/15/2024')
  })

  it('proposes wrong answers too — which is why precision is worth measuring', () => {
    const found = detectFields('A $25.00 fee applies. Roth IRA limits change annually. Copyright 2026.')
    expect(found.account_balance).toContain('$25.00')
    expect(found.account_type).toContain('Roth IRA')
    expect(found.date).toContain('2026')
  })

  it('cannot tell an account balance from a form amount, and says so by proposing both', () => {
    // The corpus splits its money oracle in two; the detector is deliberately
    // NOT split to match, because on this corpus any separating signal (a
    // currency sign, a leading form-line number) separates perfectly and would
    // score ~100% while proving nothing. One money scanner, charged for both
    // wrong answers — that ambiguity IS the selection problem the spike found.
    const found = detectFields('Total account value $47,309.55\n15 Taxable income . . . 119,315')
    expect(found.account_balance).toEqual(found.form_amount)
    expect(found.account_balance).toContain('$47,309.55')
    expect(found.account_balance).toContain('119,315')
  })

  it('returns nothing for a page with no text', () => {
    const found = detectFields('')
    for (const name of CORPUS_FIELDS) expect(found[name]).toEqual([])
  })
})
