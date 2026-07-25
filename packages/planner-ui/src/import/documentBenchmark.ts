/**
 * **The WS5 accuracy benchmark.** Runs {@link extractDocumentText} over the
 * hand-built corpus in `documentCorpus.ts` and reports, per field, how much of
 * the planted data a naive field reader recovers from the extracted text —
 * precision, recall, and whether each recovered value was attributed to the
 * page it is actually printed on.
 *
 * **Why precision needs a detector.** Recall alone can be measured by asking
 * "does this string appear anywhere in the extracted text", and that is a
 * comfortable question, because the answer is almost always yes. It is also
 * the wrong question: what a downstream mapper has to do is *pick* the account
 * number out of a page that also contains a reference number and a phone
 * number, and the balance out of a page that also lists three positions and a
 * $25.00 fee. So the benchmark runs a small, deliberately general set of field
 * detectors over the extracted text, and scores their output:
 *
 * - **true positive** — a detected value that matches a planted value for the
 *   same field (page checked separately, see below);
 * - **false positive** — a detected value that matches no planted value;
 * - **false negative** — a planted value no detector produced.
 *
 * The detectors are written to be the kind of thing a first-cut mapper would
 * write — a currency pattern, a masked-account pattern, a closed vocabulary of
 * account types, a labelled-name pattern. They are NOT tuned to the corpus. If
 * they were, precision would be 1.0 by construction and the benchmark would
 * measure nothing. Their false positives are the honest cost of reading a page
 * of prose that happens to contain numbers.
 *
 * **Page citation is scored separately from recall**, because they answer
 * different questions. A value found on the wrong page was still extracted —
 * that is a citation defect, not an extraction defect — so it counts as a true
 * positive and as a citation error. `citationAccuracy` is therefore "of the
 * values we found, how many did we attribute to the right page". Attribution is
 * strict first-occurrence (see {@link scoreField}); a scorer that got to look
 * for the planted page first could not report a citation defect for any value
 * printed twice, and a number that cannot fall is not a measurement.
 *
 * **Every miss is diagnosed**, because "we did not get the value" has two very
 * different causes. A planted value that IS in the extracted text but that no
 * detector produced (`missesTextPresent`) is a selection defect — the
 * characters arrived and the mapper failed. A planted value that does not
 * appear in the extracted text at all (`missesTextAbsent`) is an extraction
 * defect — the characters were authored on the page and did not survive.
 * Reporting a single "accuracy" number would blur these together, which is
 * exactly the mistake the plan forbids: "no launch claim based only on
 * aggregate accuracy".
 *
 * **Neither of those is an OCR number, and this benchmark does not produce
 * one.** It used to: image-only pages were declared to carry values, those
 * values were counted as misses, and the total was reported as "the OCR gap".
 * Nothing was printed on those pages — the corpus paints a featureless raster —
 * so the count measured the absence of values from a document that never held
 * them. Values are now planted only on pages the corpus renders, `coverage`
 * asserts that invariant against what extraction actually returned, and what
 * the scanned documents contribute is `imageOnly`: an image-only page is
 * detected as such rather than reported as an empty success. **OCR
 * recoverability is not measured here and cannot be** without real scanned
 * documents, which the plan's risk section forbids bundling.
 *
 * Not published: this module, the corpus and the PDF emitter are excluded from
 * the package's `files`, so the `./*` wildcard cannot reach them and no
 * consumer receives ~55 kB of test instrumentation. Only `documentText.ts`
 * ships from this spike. Run in-repo by
 * `npm run benchmark:documents -w @retiregolden/planner-ui` and pinned by
 * `documentBenchmark.test.ts`.
 */

import {
  CORPUS_FIELDS,
  buildDocumentCorpus,
  type CorpusDocument,
  type CorpusDocumentKind,
  type CorpusExpectedField,
  type CorpusFieldName,
} from './documentCorpus'
import { extractDocumentText, type DocumentTextFailureReason } from './documentText'

/** A value some detector proposed, and the page it was proposed from. */
export interface DetectedField {
  readonly field: CorpusFieldName
  readonly value: string
  readonly page: number
}

/** A planted value nothing found, with the reason it was missed. */
export interface BenchmarkMiss {
  readonly field: CorpusFieldName
  readonly value: string
  readonly page: number
  /**
   * True when the value is present in the extracted text and only the detector
   * failed — a selection defect. False means the characters were authored on
   * the page and did not survive extraction — an extraction defect. It is NOT
   * a statement about OCR: every planted value is on a page the corpus renders,
   * so an image-only page can produce neither kind of miss.
   */
  readonly textPresent: boolean
}

/** One cell of every table in the report. */
export interface ScoreTotals {
  readonly expected: number
  readonly detected: number
  readonly truePositives: number
  readonly falsePositives: number
  readonly falseNegatives: number
  /** `null` when nothing was detected — 0/0 is not zero precision. */
  readonly precision: number | null
  /** `null` when nothing was expected. */
  readonly recall: number | null
  /** Values found, and so eligible for a page-citation check. */
  readonly citationsChecked: number
  readonly citationsCorrect: number
  readonly citationAccuracy: number | null
  /** Misses whose characters arrived and the detector failed — a selection gap. */
  readonly missesTextPresent: number
  /** Misses whose characters were authored but did not survive extraction. */
  readonly missesTextAbsent: number
}

/** Totals for one field, across whatever slice of the corpus is being scored. */
export interface FieldScore extends ScoreTotals {
  readonly field: CorpusFieldName
}

/** Totals for one document shape. */
export interface KindScore extends ScoreTotals {
  readonly kind: CorpusDocumentKind
}

/** Everything the benchmark learned about one document. */
export interface DocumentScore extends ScoreTotals {
  readonly id: string
  readonly kind: CorpusDocumentKind
  readonly label: string
  readonly expectedOutcome: 'ok' | DocumentTextFailureReason
  readonly actualOutcome: 'ok' | DocumentTextFailureReason
  readonly outcomeMatches: boolean
  readonly expectedImageOnlyPages: readonly number[]
  readonly actualImageOnlyPages: readonly number[]
  readonly fields: readonly FieldScore[]
  readonly misses: readonly BenchmarkMiss[]
  /** Restated from the corpus so the report can slice it without the corpus. */
  readonly expectedFields: readonly CorpusExpectedField[]
  /** 1-based pages that came back with a readable text layer. */
  readonly textLayerPages: readonly number[]
}

/**
 * What surface the planted values actually live on — the guard that keeps every
 * other number in this report honest.
 *
 * There used to be a `recallBySurface` table here instead, splitting recall into
 * "where a text layer exists" and "where none does" and presenting the second
 * column as the OCR decision. Its denominator was eight values declared on
 * image-only pages that contain no glyphs at all, so `0/8` was the corpus
 * failing to find things it had never written down. **Recall is only defined
 * over pages that carry text**, this block asserts that it is measured over
 * exactly those, and {@link DocumentBenchmarkReport.imageOnly} carries what the
 * scanned documents can honestly say.
 *
 * `onPagesWithoutTextLayer` is computed from what extraction RETURNED, not from
 * the corpus's own `expectedImageOnlyPages`, so it also catches a value planted
 * on a page that failed to read or was never reached.
 */
export interface PlantedValueCoverage {
  readonly plantedValues: number
  /** Planted on a page extraction returned a readable text layer for. */
  readonly onTextLayerPages: number
  /** Planted where no text layer came back. Must be 0; a test pins it. */
  readonly onPagesWithoutTextLayer: number
}

/** The whole run. */
export interface DocumentBenchmarkReport {
  readonly documents: readonly DocumentScore[]
  readonly fields: readonly FieldScore[]
  readonly byKind: readonly KindScore[]
  /** Where the planted values live — the precondition for reading `fields`. */
  readonly coverage: PlantedValueCoverage
  readonly aggregate: ScoreTotals
  /** Did every document that must be refused get refused for the right reason? */
  readonly outcomes: {
    readonly documentsChecked: number
    readonly asExpected: number
    readonly mismatches: readonly string[]
  }
  /**
   * Did image-only detection agree with what was planted? This is the ONLY
   * thing the scanned documents in this corpus measure, and it is a real
   * measurement: it can fail in both directions, and one of its cases is the
   * statement's blank separator page, which must NOT be called scanned.
   */
  readonly imageOnly: {
    readonly pagesExpected: number
    readonly pagesDetected: number
    readonly falsePositives: number
    readonly falseNegatives: number
  }
}

// ---------------------------------------------------------------------------
// Detectors. General patterns a first-cut mapper would write, not corpus-fitted.
// ---------------------------------------------------------------------------

/**
 * Masked or long account identifiers. Also matches a long reference number,
 * which is the point: a page carries several long digit strings and only one
 * of them is the account.
 */
const ACCOUNT_NUMBER_PATTERN = /(?:[*xX]{2,}[-\s]?\d{3,6}|\b\d{4}[-\s]\d{4,}\b|\b\d{8,12}\b)/g

/**
 * The account-type vocabulary, longest form first so "Roth IRA" wins over the
 * bare "IRA" inside it. This mirrors how `brokerCsv.ts` guesses a type from an
 * account label — a closed keyword list, not a classifier.
 */
const ACCOUNT_TYPE_PATTERN =
  /\b(?:Roth IRA|Rollover IRA|Traditional IRA|SEP IRA|SIMPLE IRA|401\(k\)|403\(b\)|457\(b\)|HSA|IRA|Brokerage|Taxable)/gi

/**
 * A money amount: `$`-prefixed, or a bare number carrying a thousands
 * separator. The second form is what a Form 1040 prints — its amount lines
 * have no currency sign — and it is also why a share count like `412.118` is
 * not a candidate but a `2,000` in a disclosure paragraph is.
 *
 * **One pattern feeds BOTH money fields**, and that is deliberate. The corpus
 * splits its money oracle in two (`account_balance` — the value of a named
 * account; `form_amount` — a 1040 line or a printout's projected total),
 * because one number for both described two detection problems at once. The
 * DETECTOR is not split to match, for the same reason the oracle may not be
 * fitted to the detector: on this corpus any signal that separates the two
 * classes (a currency sign, a leading form-line number) separates them
 * perfectly, so a split detector would score near 100% and prove nothing. A
 * naive money scanner genuinely cannot tell an account balance from a tax-form
 * amount, so it proposes every amount for both fields and is charged for both
 * wrong answers. Those are two real errors — asked for the balance it answers
 * `$25.00`, asked for the form amount it answers `$25.00` — and the low
 * precision on both fields is exactly the selection problem the spike found.
 */
const MONEY_PATTERN = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b/g

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December'

/**
 * A date. Slash form first so `04/02/2026` is consumed whole rather than
 * yielding a bare `2026`; the bare-year form last, because a tax year really
 * is the date a 1040 carries, and a copyright year really is the noise that
 * comes with accepting it.
 */
const DATE_PATTERN = new RegExp(
  `\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b|\\b(?:${MONTHS})\\s+\\d{1,2},\\s+\\d{4}\\b|\\b(?:19|20)\\d{2}\\b`,
  'g',
)

/** Labels that introduce a person's name on the documents this corpus covers. */
const NAME_LABEL = /(?:account holder|prepared for|taxpayer|policy ?holder|client|name)/i

/** `Prepared for: MARGARET T ALVAREZ` — label and value on one line. */
const NAME_INLINE = new RegExp(
  `${NAME_LABEL.source}\\s*:?\\s*([A-Z][A-Za-z.'-]*(?:\\s+[A-Z][A-Za-z.'-]*){1,3})\\s*$`,
  'i',
)

/** A line that is nothing but a name — the value under a `Last name` header. */
const NAME_ALONE = /^[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){1,3}$/

/**
 * Names, in two passes, because forms and statements label them differently:
 * a statement puts `Prepared for:` on the same line as the value, and a 1040
 * puts `Your first name … Last name` on the line *above* it. Accepting the
 * next line is what makes the 1040 readable; it is also what lets a sentence
 * mentioning "change of name or address" pull in whatever follows it. That
 * trade is measured, not assumed.
 */
function detectNames(lines: readonly string[]): string[] {
  const found: string[] = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const inline = NAME_INLINE.exec(line)
    if (inline?.[1]) {
      found.push(inline[1])
      continue
    }
    if (!NAME_LABEL.test(line)) continue
    const next = lines[index + 1]?.trim()
    if (next && NAME_ALONE.test(next)) found.push(next)
  }
  return found
}

function matchAll(text: string, pattern: RegExp): string[] {
  // `String.prototype.matchAll` clones the regex, so the module-level /g
  // patterns are safe to share across calls — their `lastIndex` never moves.
  return [...text.matchAll(pattern)].map((match) => match[0])
}

/**
 * Every candidate value on one page's text, by field. Exported so the pinning
 * test can exercise a detector directly rather than only through a score.
 */
export function detectFields(pageText: string): Record<CorpusFieldName, readonly string[]> {
  const lines = pageText.split('\n').map((line) => line.trim())
  const money = matchAll(pageText, MONEY_PATTERN)
  return {
    name: detectNames(lines),
    account_number: matchAll(pageText, ACCOUNT_NUMBER_PATTERN),
    account_type: matchAll(pageText, ACCOUNT_TYPE_PATTERN),
    // The same candidates for both money fields — see MONEY_PATTERN.
    account_balance: money,
    form_amount: money,
    date: matchAll(pageText, DATE_PATTERN),
  }
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

const collapse = (value: string): string => value.replace(/\s+/g, ' ').trim()

/**
 * How a detected value and a planted value are compared, per field. Only
 * formatting is normalised away — a different number is a different value.
 */
const NORMALIZE: Record<CorpusFieldName, (value: string) => string> = {
  name: (value) => collapse(value).toUpperCase(),
  account_number: (value) => collapse(value).replace(/[\s-]/g, '').toUpperCase(),
  account_type: (value) => collapse(value).toLowerCase(),
  account_balance: (value) => collapse(value).replace(/[$\s]/g, ''),
  form_amount: (value) => collapse(value).replace(/[$\s]/g, ''),
  date: (value) => collapse(value).toUpperCase(),
}

/**
 * The looser comparison used ONLY to diagnose a miss: strip everything but
 * letters and digits, so a value that survived extraction but came back with
 * different spacing still counts as "the text was there". Diagnosis has to be
 * generous in exactly the direction that makes the OCR case harder to claim.
 */
const loose = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '')

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

/** Running counts, before the ratios are derived. */
interface Tally {
  expected: number
  detected: number
  truePositives: number
  falsePositives: number
  falseNegatives: number
  citationsChecked: number
  citationsCorrect: number
  missesTextPresent: number
  missesTextAbsent: number
}

const newTally = (): Tally => ({
  expected: 0,
  detected: 0,
  truePositives: 0,
  falsePositives: 0,
  falseNegatives: 0,
  citationsChecked: 0,
  citationsCorrect: 0,
  missesTextPresent: 0,
  missesTextAbsent: 0,
})

function add(into: Tally, from: Tally): void {
  into.expected += from.expected
  into.detected += from.detected
  into.truePositives += from.truePositives
  into.falsePositives += from.falsePositives
  into.falseNegatives += from.falseNegatives
  into.citationsChecked += from.citationsChecked
  into.citationsCorrect += from.citationsCorrect
  into.missesTextPresent += from.missesTextPresent
  into.missesTextAbsent += from.missesTextAbsent
}

function totals(tally: Tally): ScoreTotals {
  return {
    ...tally,
    precision: ratio(tally.truePositives, tally.truePositives + tally.falsePositives),
    recall: ratio(tally.truePositives, tally.truePositives + tally.falseNegatives),
    citationAccuracy: ratio(tally.citationsCorrect, tally.citationsChecked),
  }
}

/**
 * Score one field within one document.
 *
 * **Attribution is strict and first-occurrence.** Each planted value claims the
 * FIRST unclaimed detection of that value in page order, and the citation is
 * correct only if that detection's page is the planted page. There used to be a
 * same-page pass ahead of the value-only pass, which meant a value appearing on
 * both its planted page and somewhere else was credited to the planted page by
 * construction — so citation accuracy could not fall below 100% for any
 * duplicated value, and the headline citation number was close to unfalsifiable.
 * Matching what a real mapper does — take the first occurrence and cite where it
 * found it — is what makes the number a measurement.
 */
function scoreField(
  field: CorpusFieldName,
  expected: readonly CorpusExpectedField[],
  detected: readonly DetectedField[],
  documentText: string,
): { tally: Tally; misses: BenchmarkMiss[] } {
  const normalize = NORMALIZE[field]
  const tally = newTally()
  tally.expected = expected.length
  tally.detected = detected.length

  const claimed = new Array<boolean>(detected.length).fill(false)
  const matched = new Array<boolean>(expected.length).fill(false)

  for (let e = 0; e < expected.length; e++) {
    const want = normalize(expected[e]!.value)
    for (let d = 0; d < detected.length; d++) {
      if (claimed[d]) continue
      if (normalize(detected[d]!.value) !== want) continue
      claimed[d] = true
      matched[e] = true
      tally.truePositives += 1
      tally.citationsChecked += 1
      if (detected[d]!.page === expected[e]!.page) tally.citationsCorrect += 1
      break
    }
  }

  const misses: BenchmarkMiss[] = []
  const looseText = loose(documentText)
  for (let e = 0; e < expected.length; e++) {
    if (matched[e]) continue
    const entry = expected[e]!
    const textPresent = looseText.includes(loose(entry.value))
    misses.push({ field, value: entry.value, page: entry.page, textPresent })
    tally.falseNegatives += 1
    if (textPresent) tally.missesTextPresent += 1
    else tally.missesTextAbsent += 1
  }
  tally.falsePositives = claimed.filter((used) => !used).length

  return { tally, misses }
}

/**
 * Collapse repeats of the same value on the same page. A detector proposing
 * `17,204` twice because a 1040 prints "Tax" and "Total tax" the same is not a
 * false positive a mapper would ever ship; counting it as one would inflate
 * the pessimism of the number without describing a real defect. Repeats across
 * *different* pages are kept, because those are a real citation question.
 */
function dedupe(field: CorpusFieldName, detected: readonly DetectedField[]): DetectedField[] {
  const normalize = NORMALIZE[field]
  // One set of values PER PAGE rather than one composite string key. A key built
  // by concatenating a page number and a value needs a separator no value can
  // contain, and the usual answer — a raw NUL — makes the source file itself
  // hard to read and git treat it as binary. Nesting the maps needs no separator
  // at all, so there is nothing for a value to collide with.
  const seenByPage = new Map<number, Set<string>>()
  const kept: DetectedField[] = []
  for (const item of detected) {
    let seen = seenByPage.get(item.page)
    if (!seen) {
      seen = new Set<string>()
      seenByPage.set(item.page, seen)
    }
    const value = normalize(item.value)
    if (seen.has(value)) continue
    seen.add(value)
    kept.push(item)
  }
  return kept
}

async function scoreDocument(document: CorpusDocument): Promise<DocumentScore> {
  const result = await extractDocumentText(document.bytes)
  const actualOutcome = result.ok ? 'ok' : result.reason
  const pages = result.ok ? result.pages : []
  const documentText = pages.map((page) => page.text).join('\n')

  const detected: DetectedField[] = []
  for (const page of pages) {
    const candidates = detectFields(page.text)
    for (const field of CORPUS_FIELDS) {
      for (const value of candidates[field]) detected.push({ field, value, page: page.page })
    }
  }

  const fields: FieldScore[] = []
  const misses: BenchmarkMiss[] = []
  const documentTally = newTally()
  for (const field of CORPUS_FIELDS) {
    const scored = scoreField(
      field,
      document.expected.filter((entry) => entry.field === field),
      dedupe(
        field,
        detected.filter((entry) => entry.field === field),
      ),
      documentText,
    )
    fields.push({ field, ...totals(scored.tally) })
    misses.push(...scored.misses)
    add(documentTally, scored.tally)
  }

  return {
    id: document.id,
    kind: document.kind,
    label: document.label,
    expectedOutcome: document.expectedOutcome,
    actualOutcome,
    outcomeMatches: actualOutcome === document.expectedOutcome,
    expectedImageOnlyPages: document.expectedImageOnlyPages,
    actualImageOnlyPages: pages.filter((page) => page.imageOnly).map((page) => page.page),
    fields,
    misses,
    expectedFields: document.expected,
    // A blank page still has a text layer — it just has nothing in it. Only a
    // page that paints a raster instead, or that was never reached, is a page
    // OCR could add anything to.
    textLayerPages: pages.filter((page) => !page.imageOnly).map((page) => page.page),
    ...totals(documentTally),
  }
}

/**
 * Check every planted value against the surface it was planted on, using what
 * extraction actually returned. A non-zero `onPagesWithoutTextLayer` means the
 * oracle is claiming a value lives somewhere the reader found no text — which
 * is either a corpus defect (a value declared on a page nothing renders) or an
 * extraction defect, and in both cases every recall number below it is
 * describing something other than what it says.
 */
function plantedValueCoverage(documents: readonly DocumentScore[]): PlantedValueCoverage {
  let plantedValues = 0
  let onTextLayerPages = 0
  for (const document of documents) {
    const withText = new Set(document.textLayerPages)
    for (const entry of document.expectedFields) {
      plantedValues += 1
      if (withText.has(entry.page)) onTextLayerPages += 1
    }
  }
  return {
    plantedValues,
    onTextLayerPages,
    onPagesWithoutTextLayer: plantedValues - onTextLayerPages,
  }
}

/** Run the whole corpus and score it. */
export async function runDocumentBenchmark(
  corpus: readonly CorpusDocument[] = buildDocumentCorpus(),
): Promise<DocumentBenchmarkReport> {
  const documents: DocumentScore[] = []
  for (const document of corpus) documents.push(await scoreDocument(document))

  const asTally = (score: ScoreTotals): Tally => ({
    expected: score.expected,
    detected: score.detected,
    truePositives: score.truePositives,
    falsePositives: score.falsePositives,
    falseNegatives: score.falseNegatives,
    citationsChecked: score.citationsChecked,
    citationsCorrect: score.citationsCorrect,
    missesTextPresent: score.missesTextPresent,
    missesTextAbsent: score.missesTextAbsent,
  })

  const fields: FieldScore[] = CORPUS_FIELDS.map((field) => {
    const tally = newTally()
    for (const document of documents) {
      const entry = document.fields.find((candidate) => candidate.field === field)
      if (entry) add(tally, asTally(entry))
    }
    return { field, ...totals(tally) }
  })

  const kinds = [...new Set(documents.map((document) => document.kind))]
  const byKind: KindScore[] = kinds.map((kind) => {
    const tally = newTally()
    for (const document of documents.filter((candidate) => candidate.kind === kind)) {
      add(tally, asTally(document))
    }
    return { kind, ...totals(tally) }
  })

  const aggregateTally = newTally()
  for (const document of documents) add(aggregateTally, asTally(document))

  const mismatches = documents
    .filter((document) => !document.outcomeMatches)
    .map((document) => `${document.id}: expected ${document.expectedOutcome}, got ${document.actualOutcome}`)

  let pagesExpected = 0
  let pagesDetected = 0
  let imageOnlyFalsePositives = 0
  let imageOnlyFalseNegatives = 0
  for (const document of documents) {
    const expectedPages = new Set(document.expectedImageOnlyPages)
    const actualPages = new Set(document.actualImageOnlyPages)
    pagesExpected += expectedPages.size
    pagesDetected += actualPages.size
    for (const page of actualPages) if (!expectedPages.has(page)) imageOnlyFalsePositives += 1
    for (const page of expectedPages) if (!actualPages.has(page)) imageOnlyFalseNegatives += 1
  }

  return {
    documents,
    fields,
    byKind,
    coverage: plantedValueCoverage(documents),
    aggregate: totals(aggregateTally),
    outcomes: {
      documentsChecked: documents.length,
      asExpected: documents.filter((document) => document.outcomeMatches).length,
      mismatches,
    },
    imageOnly: {
      pagesExpected,
      pagesDetected,
      falsePositives: imageOnlyFalsePositives,
      falseNegatives: imageOnlyFalseNegatives,
    },
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const percent = (value: number | null): string => (value === null ? '   n/a' : `${(value * 100).toFixed(1)}%`)
const pad = (value: string, width: number): string => value.padEnd(width)
const padStart = (value: string, width: number): string => value.padStart(width)

function scoreRow(label: string, width: number, score: ScoreTotals): string {
  return [
    pad(label, width),
    padStart(String(score.expected), 4),
    padStart(String(score.truePositives), 4),
    padStart(String(score.falsePositives), 4),
    padStart(String(score.falseNegatives), 4),
    padStart(percent(score.precision), 8),
    padStart(percent(score.recall), 8),
    padStart(percent(score.citationAccuracy), 10),
    padStart(String(score.missesTextPresent), 8),
    padStart(String(score.missesTextAbsent), 8),
  ].join(' ')
}

function header(label: string, width: number): string {
  return [
    pad(label, width),
    padStart('exp', 4),
    padStart('TP', 4),
    padStart('FP', 4),
    padStart('FN', 4),
    padStart('prec', 8),
    padStart('recall', 8),
    padStart('cite acc', 10),
    padStart('miss:sel', 8),
    padStart('miss:ext', 8),
  ].join(' ')
}

/**
 * Render the report as text.
 *
 * The per-field table is printed *before* any corpus-wide number and in the
 * same call, so there is no way to obtain the aggregate from this module
 * without the breakdown that qualifies it. The plan's test section requires
 * that: "Accuracy benchmark reports precision/recall by field; no launch claim
 * based only on aggregate accuracy."
 */
export function formatDocumentBenchmarkReport(report: DocumentBenchmarkReport): string {
  const out: string[] = []
  const width = 26

  out.push('RetireGolden — WS5 document-parsing accuracy benchmark')
  out.push('Synthetic corpus, hand-built; expected values are declared in documentCorpus.ts.')
  out.push('')
  out.push('miss:sel = value WAS in the extracted text and no detector produced it (a selection gap).')
  out.push('miss:ext = value was authored on the page and did not survive extraction.')
  out.push('Neither is an OCR number. This benchmark does not measure OCR — see LIMITATION below.')
  out.push('')

  out.push('PER FIELD')
  out.push(header('field', width))
  for (const field of report.fields) out.push(scoreRow(field.field, width, field))
  out.push('')

  out.push('PER DOCUMENT SHAPE')
  out.push(header('kind', width))
  for (const kind of report.byKind) out.push(scoreRow(kind.kind, width, kind))
  out.push('')

  out.push('PER DOCUMENT')
  out.push(header('document', width))
  for (const document of report.documents) out.push(scoreRow(document.id, width, document))
  out.push('')

  out.push('MISSES')
  const misses = report.documents.flatMap((document) =>
    document.misses.map((miss) => ({ document: document.id, ...miss })),
  )
  if (misses.length === 0) out.push('  (none)')
  for (const miss of misses) {
    out.push(
      `  ${pad(miss.document, 24)} ${pad(miss.field, 16)} p${miss.page} ${pad(miss.value, 22)} ` +
        `${miss.textPresent ? 'text present — selection gap' : 'text lost — extraction gap'}`,
    )
  }
  out.push('')

  out.push('HONEST REFUSAL')
  out.push(
    `  ${report.outcomes.asExpected}/${report.outcomes.documentsChecked} documents produced the expected outcome.`,
  )
  for (const mismatch of report.outcomes.mismatches) out.push(`  MISMATCH ${mismatch}`)
  for (const document of report.documents) {
    out.push(`  ${pad(document.id, 24)} expected ${pad(document.expectedOutcome, 18)} got ${document.actualOutcome}`)
  }
  out.push('')

  out.push('WHERE THE PLANTED VALUES LIVE — the precondition for every recall number above')
  out.push(
    `  ${report.coverage.plantedValues} planted; ${report.coverage.onTextLayerPages} on a page extraction ` +
      `returned a text layer for; ${report.coverage.onPagesWithoutTextLayer} on a page it did not.`,
  )
  out.push(
    '  The second number must equal the first. Recall is defined only over pages that carry text;',
  )
  out.push(
    '  a value declared where no text exists would be scored as missed without ever having been there.',
  )
  out.push('')

  out.push('IMAGE-ONLY PAGE DETECTION — what the scanned documents in this corpus measure')
  out.push(
    `  planted ${report.imageOnly.pagesExpected}, detected ${report.imageOnly.pagesDetected}, ` +
      `false positives ${report.imageOnly.falsePositives}, false negatives ${report.imageOnly.falseNegatives}`,
  )
  out.push(
    '  A page reported image-only lets a UI say "this page is a scanned image — type these values in"',
  )
  out.push('  instead of showing an empty result. A blank page must not be reported this way.')
  out.push('')

  out.push('LIMITATION — OCR recoverability is NOT measured here')
  out.push(
    '  Image-only pages in this corpus paint a featureless raster and carry no glyphs, so no value is',
  )
  out.push(
    '  planted on one. How much of a REAL scan an OCR engine could recover is therefore unmeasured, and',
  )
  out.push(
    '  it cannot be measured from generator-built bytes: a crude bitmap font would give a noise-free,',
  )
  out.push(
    '  skew-free raster whose difficulty resembles no real scan, producing an optimistic number that is',
  )
  out.push(
    '  worse than none. Measuring it needs real scanned documents, which the plan forbids bundling.',
  )
  out.push('')

  out.push('CORPUS TOTAL — not quotable on its own; the per-field table above is the result.')
  out.push(header('all fields', width))
  out.push(scoreRow('corpus', width, report.aggregate))

  return out.join('\n')
}
