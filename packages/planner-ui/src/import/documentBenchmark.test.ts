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
        // A page with no text layer prints nothing; its values are on the paper
        // and are covered by the next spec.
        if (source === '') continue
        expect(
          collapse(source),
          `${entry.id} page ${planted.page} must print ${planted.field} "${planted.value}" verbatim`,
        ).toContain(collapse(planted.value))
      }
    }
  })

  it('declares the scanned pages values that are on the paper and in no source line', () => {
    // The other half: the OCR gap is only a real measurement if those values
    // genuinely are not in any text layer. A value planted on an image-only
    // page must appear in no authored source at all.
    for (const entry of buildDocumentCorpus()) {
      for (const planted of entry.expected) {
        if (!entry.expectedImageOnlyPages.includes(planted.page)) continue
        expect(entry.pageSources[planted.page - 1] ?? '', `${entry.id} page ${planted.page} is scanned`).toBe('')
        for (const source of entry.pageSources) {
          expect(collapse(source), `${entry.id}: ${planted.value} must be on the paper only`).not.toContain(
            collapse(planted.value),
          )
        }
      }
    }
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
   * Three of these moved DOWN when the benchmark was made honest, and the
   * lower numbers are the correct ones:
   *  - `account_type` (was 66.7%/85.7%) — page 2 of the statement prints
   *    "Individual Brokerage" and the corpus had declared the bare "Brokerage",
   *    which is exactly the token the detector's vocabulary emits. Stated as
   *    printed, it is a miss.
   *  - `account_balance` / `form_amount` replace a single `balance` field that
   *    averaged a custodian's account values together with a 1040's line
   *    amounts. One money scanner feeds both, so a wrong amount is charged to
   *    both — the honest cost of a detector that cannot tell them apart.
   */
  const FLOORS: Record<CorpusFieldName, { precision: number; recall: number }> = {
    name: { precision: 0.75, recall: 0.6 },
    account_number: { precision: 0.71, recall: 0.83 },
    account_type: { precision: 0.55, recall: 0.71 },
    account_balance: { precision: 0.16, recall: 0.5 },
    form_amount: { precision: 0.44, recall: 1 },
    date: { precision: 0.57, recall: 0.66 },
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

  it('records honestly that a scanned document yields nothing at all', async () => {
    const result = await report()
    const scanned = document(result, 'scanned-statement')
    // Not a floor to improve on without OCR: zero is the true value, and the
    // corpus deliberately declares the six values printed on that paper so
    // the size of the gap is a number rather than an omission.
    expect(scanned.recall).toBe(0)
    expect(scanned.expected).toBe(6)
    expect(scanned.truePositives).toBe(0)
    expect(scanned.missesTextAbsent).toBe(6)
    expect(scanned.missesTextPresent).toBe(0)
  })

  it('records the two misses that a text layer was present for', async () => {
    const result = await report()
    // 1. The mixed-scan cover page sets the account holder against a page
    //    counter with no gap, so pdfjs returns "…BRENNANPage 1 of 2" and the
    //    name detector's end-of-line anchor fails.
    const mixed = document(result, 'mixed-scan-statement')
    expect(mixed.misses.find((miss) => miss.field === 'name')?.textPresent).toBe(true)
    // 2. The statement's second account is an "Individual Brokerage"; the
    //    detector's closed vocabulary can only ever emit "Brokerage". The
    //    characters are all there, so this is a mapper gap, not an OCR gap —
    //    and it is only visible because the corpus states the printed value
    //    instead of the token the detector happens to produce.
    const statement = document(result, 'broker-statement')
    const typeMiss = statement.misses.find((miss) => miss.field === 'account_type')
    expect(typeMiss?.value).toBe('Individual Brokerage')
    expect(typeMiss?.textPresent).toBe(true)

    expect(result.aggregate.missesTextPresent).toBe(2)
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

  it('splits recall by whether the page had a text layer at all', async () => {
    const result = await report()
    const all = result.recallBySurface.find((row) => row.field === 'all fields')!
    // The whole OCR argument in two numbers: near-total recall where a text
    // layer exists, and exactly nothing where one does not.
    expect(all.textLayerRecall!).toBeGreaterThanOrEqual(0.93)
    expect(all.noTextLayerRecall).toBe(0)
    expect(all.noTextLayerExpected).toBeGreaterThan(0)
    expect(result.recallBySurface.map((row) => row.field)).toEqual([...CORPUS_FIELDS, 'all fields'])
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
    expect(text).toContain('no text layer — OCR gap')
    expect(text).toContain('text present — detector gap')
  })
})

describe('the scorer can report a failure — otherwise it measures nothing', () => {
  /** A two-page document whose values the test states independently. */
  const oneOff = (overrides: Partial<CorpusDocument>): CorpusDocument => ({
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
