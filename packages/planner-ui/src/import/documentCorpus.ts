/**
 * **The synthetic document corpus** for the WS5 document-parsing spike
 * (advisor-intake-and-migration-workbench). Every document the accuracy
 * benchmark scores is built here, byte by byte, from a declaration that also
 * states — as literals, in this file — which field values the document
 * contains and which page each one is on.
 *
 * **Why the corpus is hand-built.** The plan's risk section forbids bundled
 * proprietary samples: "accept user-provided documents only; no bundled
 * proprietary samples", and the repo commits no binary fixtures at all. More
 * importantly, [DOCS/testing.md](../../../../DOCS/testing.md) says the app is
 * never its own oracle. If the expected answers were produced by running the
 * extractor over some document, the benchmark would only prove the extractor
 * agrees with itself. Here the expected answers are written down first, by
 * hand, and the bytes are emitted to contain them — so `expected` is an
 * independent statement of truth and the benchmark can genuinely be wrong.
 *
 * **The subtler way that rule gets broken** is not deriving the oracle from a
 * run — it is quietly *editing* a declared value until it matches what the
 * reader emits. A page printing "Individual Brokerage" declared as the bare
 * "Brokerage", which is exactly the token the detector's closed vocabulary
 * produces, scores as a hit while describing a document that does not exist.
 * Every entry therefore states the value as printed, and
 * {@link CorpusDocument.pageSources} carries the authored text of each page
 * from the same declaration the bytes come from, so a test can check the
 * oracle against the document rather than against the extractor.
 *
 * **What the corpus is not.** These are clean, generator-produced PDFs with
 * a base-14 font and uncompressed content streams. They reproduce the layout
 * hazards a text extractor meets — columns, dot leaders, interleaved
 * two-column reading order, scanned inserts, distractor values that look like
 * the fields we want — but they do not reproduce a real custodian's font
 * subsetting, ligatures, or CID encodings. A number measured here is an upper
 * bound on the same number measured against a real statement, and the
 * findings note says so.
 *
 * Not published: like `pdfFixtures.ts`, this module is excluded from the
 * package's `files`, so the `./*` wildcard cannot reach it and no consumer
 * ever receives it. Only `documentText.ts` ships from this spike.
 */

import type { DocumentTextFailureReason } from './documentText'
import { buildSyntheticPdf, type SyntheticPdfLine, type SyntheticPdfSpec } from './pdfFixtures'

/**
 * The fields the benchmark scores. Deliberately small and cross-cutting: each
 * one appears on more than one document shape, so a per-field number means
 * something across the corpus rather than describing a single document.
 *
 * **The two money fields are separate on purpose.** A single `balance` field
 * used to hold both a custodian's account values and a 1040's dot-leader
 * amounts (W-2 wages, AGI, standard deduction, tax, withholding). A 1040
 * carries no account balances, so one precision/recall number for both was two
 * different detection problems averaged together and meant nothing on its own:
 *
 * - `account_balance` — the stated value OF a named account, the thing an
 *   import would actually write into a plan's `balance`.
 * - `form_amount` — a money amount printed on a numbered form line or a
 *   summary row that is NOT the value of an account: a 1040's line amounts,
 *   and a plan printout's projected total. Reading one of these is useful, but
 *   it is a different question, and it must not be allowed to flatter or
 *   depress the account-balance number.
 */
export type CorpusFieldName =
  | 'name'
  | 'account_number'
  | 'account_type'
  | 'account_balance'
  | 'form_amount'
  | 'date'

/** Every field name, in report order. */
export const CORPUS_FIELDS: readonly CorpusFieldName[] = [
  'name',
  'account_number',
  'account_type',
  'account_balance',
  'form_amount',
  'date',
]

/** The document shapes WS5 names, plus the failure shapes it must refuse. */
export type CorpusDocumentKind =
  | 'broker_statement'
  | 'old_plan'
  | 'form_1040'
  | 'scanned'
  | 'mixed_scan'
  | 'encrypted'
  | 'corrupt'
  | 'not_pdf'

/**
 * One planted value: this document contains `value` for `field`, on page
 * `page`. This is the oracle — it is asserted here, not derived from any run
 * of the extractor.
 */
export interface CorpusExpectedField {
  readonly field: CorpusFieldName
  /** The value exactly as a reader would copy it off the page. */
  readonly value: string
  /** 1-based page the value is printed on. */
  readonly page: number
}

/** A corpus entry: the bytes, and everything true about them. */
export interface CorpusDocument {
  readonly id: string
  readonly kind: CorpusDocumentKind
  /** One line for the report, saying what a human would see. */
  readonly label: string
  /** The document's bytes. */
  readonly bytes: Uint8Array
  /**
   * What is AUTHORED on each page, taken from the same declaration the bytes
   * are emitted from — never from any extraction. This is what lets a test
   * check the oracle against the document instead of against the reader: a
   * planted value must appear in its page's authored text, so a declaration
   * quietly trimmed to whatever a detector happens to emit (the bare
   * `Brokerage` for a page printing `Individual Brokerage`) fails the suite.
   * Empty for a page with no text layer — the scanned pages, whose planted
   * values are on the paper and deliberately in no source line.
   */
  readonly pageSources: readonly string[]
  /**
   * What extraction should return: `'ok'`, or the failure reason the document
   * must be refused with. A wrong reason is as much a failure as a crash —
   * "unsupported documents fail honestly" is the acceptance criterion.
   */
  readonly expectedOutcome: 'ok' | DocumentTextFailureReason
  /** Pages that carry no text layer but do paint a raster. */
  readonly expectedImageOnlyPages: readonly number[]
  /** Every planted value. Empty for the documents that must be refused. */
  readonly expected: readonly CorpusExpectedField[]
}

/**
 * Emit a document's bytes AND the text its declaration says is on each page,
 * from that one declaration. Runs on a line are joined with a space because
 * that is how a reader reads a row of columns; the extractor's own spacing
 * decisions are a separate matter and are exactly what the benchmark measures.
 */
function renderSpec(spec: SyntheticPdfSpec): { bytes: Uint8Array; pageSources: readonly string[] } {
  const pageSources = spec.pages.map((page) => {
    const parts: string[] = []
    if (page.text) parts.push(page.text)
    for (const line of page.lines ?? []) {
      parts.push(typeof line === 'string' ? line : line.map((run) => run.text).join(' '))
    }
    return parts.join('\n')
  })
  return { bytes: buildSyntheticPdf(spec), pageSources }
}

/** Column x positions, in points; the page is 612 wide with a 72pt margin. */
const COL = { left: 72, mid: 250, right: 380, far: 470 } as const

/**
 * A holdings row set tight enough that the value column abuts the description
 * column. Real statements do this; pdfjs inserts a space between two runs only
 * when the horizontal gap warrants one, so a tight table is where two cells
 * come back run together.
 */
function tightRow(description: string, quantity: string, value: string): SyntheticPdfLine {
  return [
    { x: COL.left, text: description },
    { x: 236, text: quantity },
    { x: 292, text: value },
  ]
}

// ---------------------------------------------------------------------------
// 1. Broker statement — the "statements" shape, four pages.
// ---------------------------------------------------------------------------

const brokerStatementPages: readonly (readonly SyntheticPdfLine[])[] = [
  // Page 1 — cover and summary for the first account.
  [
    'Northgate Securities LLC',
    'Client Statement',
    '',
    'Statement period: 04/01/2026 through 06/30/2026',
    'Prepared for: MARGARET T ALVAREZ',
    '',
    [
      { x: COL.left, text: 'Account number' },
      { x: COL.right, text: '****4417' },
    ],
    [
      { x: COL.left, text: 'Account type' },
      { x: COL.right, text: 'Roth IRA' },
    ],
    [
      { x: COL.left, text: 'Total account value' },
      { x: COL.right, text: '$128,450.22' },
    ],
    [
      { x: COL.left, text: 'Change this period' },
      { x: COL.right, text: '$3,912.08' },
    ],
    '',
    'Reference 884120997. Questions? Call 800-555-0142.',
  ],
  // Page 2 — the second account on the same statement, with a tight table.
  [
    [
      { x: COL.left, text: 'Account number' },
      { x: COL.right, text: '****9203' },
    ],
    [
      { x: COL.left, text: 'Account type' },
      { x: COL.right, text: 'Individual Brokerage' },
    ],
    [
      { x: COL.left, text: 'Total account value' },
      { x: COL.right, text: '$47,309.55' },
    ],
    '',
    'Holdings',
    tightRow('Description', 'Quantity', 'Market value'),
    tightRow('Total Stock Market Index Fund', '412.118', '$26,204.19'),
    tightRow('Total Bond Market Index Fund', '980.442', '$14,105.36'),
    tightRow('Cash and equivalents', '', '$7,000.00'),
  ],
  // Page 3 — a blank separator page. Not scanned; nothing on it at all.
  [],
  // Page 4 — disclosures. No planted fields; everything here is a distractor.
  [
    'Important disclosures',
    'Northgate Securities LLC is a member FINRA/SIPC. Accounts are protected up to',
    '$500,000.00 including a $250,000.00 limit for cash. A $25.00 fee applies to',
    'paper statements. Roth IRA and Traditional IRA contribution limits are set',
    'annually by the IRS. Please report any change of name or address in writing.',
    'Northgate Securities LLC',
    'Form NS-1099 Rev. 03/2025. Copyright 2026 Northgate Securities LLC.',
  ],
]

const brokerStatement: CorpusDocument = {
  id: 'broker-statement',
  kind: 'broker_statement',
  label: 'Quarterly brokerage statement, two accounts, blank separator, disclosures (4 pages)',
  ...renderSpec({
    pages: brokerStatementPages.map((lines, index) => (index === 2 ? {} : { lines, fontSize: 10 })),
  }),
  expectedOutcome: 'ok',
  expectedImageOnlyPages: [],
  expected: [
    { field: 'name', value: 'MARGARET T ALVAREZ', page: 1 },
    { field: 'account_number', value: '****4417', page: 1 },
    { field: 'account_type', value: 'Roth IRA', page: 1 },
    { field: 'account_balance', value: '$128,450.22', page: 1 },
    { field: 'date', value: '06/30/2026', page: 1 },
    { field: 'account_number', value: '****9203', page: 2 },
    // The page prints "Individual Brokerage", so that is what the document
    // contains. It was declared as the bare "Brokerage" — which happens to be
    // exactly the token the detector's closed vocabulary emits — and that is
    // the oracle being adjusted to match the reader. testing.md: the app is
    // never its own oracle. Stated correctly, this value is now a miss, and
    // the score says so.
    { field: 'account_type', value: 'Individual Brokerage', page: 2 },
    { field: 'account_balance', value: '$47,309.55', page: 2 },
  ],
}

// ---------------------------------------------------------------------------
// 2. Old plan printout — the "old plans" shape, two pages, two-column body.
// ---------------------------------------------------------------------------

const oldPlanPrintout: CorpusDocument = {
  id: 'old-plan-printout',
  kind: 'old_plan',
  label: 'Retirement plan printout from another tool, two-column assumptions page (2 pages)',
  ...renderSpec({
    pages: [
      {
        fontSize: 11,
        lines: [
          'Silver Oak Planning',
          'Retirement Plan Summary',
          '',
          'Prepared for: DAVID R OKONKWO',
          'Prepared on: March 14, 2026',
          '',
          [
            { x: COL.left, text: 'Projected value at retirement' },
            { x: COL.far, text: '$1,284,900.00' },
          ],
          [
            { x: COL.left, text: 'Target retirement age' },
            { x: COL.far, text: '67' },
          ],
        ],
      },
      {
        fontSize: 10,
        // Two blocks side by side, the way a printout sets assumptions next to
        // an account list. pdfjs reads content-stream order, so each baseline
        // comes back with the left block's text followed by the right block's.
        lines: [
          [
            { x: COL.left, text: 'Assumptions' },
            { x: COL.right, text: 'Accounts' },
          ],
          [
            { x: COL.left, text: 'Inflation 2.50%' },
            { x: COL.right, text: 'Traditional IRA' },
            { x: COL.far, text: '****7781' },
          ],
          [
            { x: COL.left, text: 'Expected return 5.75%' },
            { x: COL.right, text: '401(k)' },
            { x: COL.far, text: '****2290' },
          ],
          [
            { x: COL.left, text: 'Tax rate 22.00%' },
            { x: COL.right, text: 'Taxable' },
            { x: COL.far, text: '$92,400.00' },
          ],
        ],
      },
    ],
  }),
  expectedOutcome: 'ok',
  expectedImageOnlyPages: [],
  expected: [
    { field: 'name', value: 'DAVID R OKONKWO', page: 1 },
    { field: 'date', value: 'March 14, 2026', page: 1 },
    // A projected total for the whole plan, not the value of any account —
    // so it is a form/summary amount, not an account balance.
    { field: 'form_amount', value: '$1,284,900.00', page: 1 },
    { field: 'account_type', value: 'Traditional IRA', page: 2 },
    { field: 'account_number', value: '****7781', page: 2 },
    { field: 'account_type', value: '401(k)', page: 2 },
    { field: 'account_number', value: '****2290', page: 2 },
    { field: 'account_type', value: 'Taxable', page: 2 },
    // Printed in the accounts column against "Taxable": the value of an account.
    { field: 'account_balance', value: '$92,400.00', page: 2 },
  ],
}

// ---------------------------------------------------------------------------
// 3. Form 1040 — the richest seed document, two pages, dot leaders, no "$".
// ---------------------------------------------------------------------------

/** A 1040 amount line: label, dot leader, right-aligned amount, no currency sign. */
function taxLine(label: string, amount: string): SyntheticPdfLine {
  return [
    { x: COL.left, text: `${label} ${'. '.repeat(14)}` },
    { x: COL.far, text: amount },
  ]
}

const formTenForty: CorpusDocument = {
  id: 'form-1040',
  kind: 'form_1040',
  label: 'Form 1040 print-out, label-above-value name block and dot-leader amounts (2 pages)',
  ...renderSpec({
    pages: [
      {
        fontSize: 10,
        lines: [
          'Form 1040 U.S. Individual Income Tax Return 2025',
          'Department of the Treasury - Internal Revenue Service',
          '',
          [
            { x: COL.left, text: 'Your first name and middle initial' },
            { x: COL.mid, text: 'Last name' },
          ],
          [
            { x: COL.left, text: 'PRIYA' },
            { x: COL.mid, text: 'NARAYANAN' },
          ],
          [
            { x: COL.left, text: 'Your social security number' },
            { x: COL.far, text: '***-**-6620' },
          ],
          'Filing status: Married filing jointly',
          '',
          taxLine('1a Total amount from Form(s) W-2, box 1', '142,880'),
          taxLine('11 Adjusted gross income', '149,315'),
          taxLine('12 Standard deduction', '30,000'),
          taxLine('15 Taxable income', '119,315'),
        ],
      },
      {
        fontSize: 10,
        lines: [
          taxLine('16 Tax', '17,204'),
          taxLine('24 Total tax', '17,204'),
          taxLine('25a Federal income tax withheld from Form(s) W-2', '19,880'),
          taxLine('34 Amount overpaid', '2,676'),
          '',
          'Sign here',
          [
            { x: COL.left, text: 'Your signature' },
            { x: COL.right, text: 'Date' },
            { x: COL.far, text: '04/02/2026' },
          ],
          'Paid preparer use only. PTIN P00551209. Firm EIN 47-0000000.',
        ],
      },
    ],
  }),
  expectedOutcome: 'ok',
  expectedImageOnlyPages: [],
  expected: [
    { field: 'name', value: 'PRIYA NARAYANAN', page: 1 },
    { field: 'date', value: '2025', page: 1 },
    // Every amount on this document is a numbered form line — W-2 wages, AGI,
    // the standard deduction, taxable income, tax, withholding, the
    // overpayment. Not one of them is an account balance, and counting them as
    // such was what made the old single money field mean two things at once.
    { field: 'form_amount', value: '142,880', page: 1 },
    { field: 'form_amount', value: '149,315', page: 1 },
    { field: 'form_amount', value: '30,000', page: 1 },
    { field: 'form_amount', value: '119,315', page: 1 },
    { field: 'form_amount', value: '17,204', page: 2 },
    { field: 'form_amount', value: '19,880', page: 2 },
    { field: 'form_amount', value: '2,676', page: 2 },
    { field: 'date', value: '04/02/2026', page: 2 },
  ],
}

// ---------------------------------------------------------------------------
// 4-5. Scanned documents — the OCR question, stated as data.
// ---------------------------------------------------------------------------

/**
 * A fully scanned statement. The values below are genuinely printed on the
 * paper; they are declared here precisely so the benchmark records them as
 * missed. Silently leaving them out would hide the size of the OCR gap, which
 * is the number this spike exists to produce.
 */
const scannedStatement: CorpusDocument = {
  id: 'scanned-statement',
  kind: 'scanned',
  label: 'Statement scanned to image, no text layer on any page (2 pages)',
  ...renderSpec({ pages: [{ image: true }, { image: true }] }),
  expectedOutcome: 'ok',
  expectedImageOnlyPages: [1, 2],
  expected: [
    { field: 'name', value: 'ELEANOR J WHITFIELD', page: 1 },
    { field: 'account_number', value: '****3358', page: 1 },
    { field: 'account_type', value: 'Rollover IRA', page: 1 },
    { field: 'account_balance', value: '$214,006.71', page: 1 },
    { field: 'date', value: '12/31/2025', page: 1 },
    { field: 'account_balance', value: '$18,220.40', page: 2 },
  ],
}

/**
 * The common real shape: a typed cover page in front of scanned inserts. Half
 * the fields are readable and half are not, which is the case a UI has to be
 * able to describe page by page rather than document by document.
 */
const mixedScanStatement: CorpusDocument = {
  id: 'mixed-scan-statement',
  kind: 'mixed_scan',
  label: 'Typed cover page followed by a scanned insert (2 pages)',
  ...renderSpec({
    pages: [
      {
        fontSize: 10,
        lines: [
          'Harborline Trust Company',
          'Annual Account Summary',
          '',
          // The header line abuts the page counter in the right margin. pdfjs
          // inserts a space between two runs only when the horizontal gap
          // warrants one, so an over-tight header really does come back as
          // "…BRENNANPage 1 of 2". This is not a contrived case: statements
          // routinely set a right-aligned page counter against a variable-width
          // header, and it is the one artifact in this corpus that costs a
          // field WITHOUT costing the text — the distinction the OCR
          // recommendation turns on.
          [
            { x: COL.left, text: 'Account holder: SAMUEL O BRENNAN' },
            { x: 222, text: 'Page 1 of 2' },
          ],
          [
            { x: COL.left, text: 'Account number' },
            { x: COL.right, text: '****6104' },
          ],
          [
            { x: COL.left, text: 'Account type' },
            { x: COL.right, text: 'Traditional IRA' },
          ],
          '',
          'Detail for the period is attached.',
        ],
      },
      { image: true },
    ],
  }),
  expectedOutcome: 'ok',
  expectedImageOnlyPages: [2],
  expected: [
    { field: 'name', value: 'SAMUEL O BRENNAN', page: 1 },
    { field: 'account_number', value: '****6104', page: 1 },
    { field: 'account_type', value: 'Traditional IRA', page: 1 },
    // Printed on the scanned insert: on the paper, not in any text layer.
    { field: 'account_balance', value: '$76,540.18', page: 2 },
    { field: 'date', value: '12/31/2025', page: 2 },
  ],
}

// ---------------------------------------------------------------------------
// 6-8. The documents that must be refused, and refused for the right reason.
// ---------------------------------------------------------------------------

const encryptedStatement: CorpusDocument = {
  id: 'encrypted-statement',
  kind: 'encrypted',
  label: 'Password-protected statement, the way a custodian emails one',
  ...renderSpec({
    pages: [{ lines: ['Account number ****5512', 'Total value $63,880.00'], fontSize: 10 }],
    encrypted: true,
  }),
  expectedOutcome: 'encrypted',
  expectedImageOnlyPages: [],
  expected: [],
}

const corruptStatement: CorpusDocument = {
  id: 'corrupt-statement',
  kind: 'corrupt',
  label: 'PDF header over a body that is not a PDF structure (a half-finished download)',
  bytes: new TextEncoder().encode(
    '%PDF-1.7\nThis file began downloading and then stopped. Nothing here is an object.\n',
  ),
  // Not a parseable document at all: it has no pages to author anything on.
  pageSources: [],
  expectedOutcome: 'corrupt',
  expectedImageOnlyPages: [],
  expected: [],
}

const brokerPositionsCsv: CorpusDocument = {
  id: 'broker-positions-csv',
  kind: 'not_pdf',
  label: 'A broker positions CSV picked by mistake in the PDF field',
  bytes: new TextEncoder().encode(
    'Account Name,Symbol,Quantity,Current Value\nRoth IRA ****4417,VTSAX,412.118,$26204.19\n',
  ),
  pageSources: [],
  expectedOutcome: 'not_pdf',
  expectedImageOnlyPages: [],
  expected: [],
}

/**
 * The corpus, in report order: the three document shapes WS5 names, then the
 * two scanned shapes, then the three that must be refused.
 */
export function buildDocumentCorpus(): readonly CorpusDocument[] {
  return [
    brokerStatement,
    oldPlanPrintout,
    formTenForty,
    scannedStatement,
    mixedScanStatement,
    encryptedStatement,
    corruptStatement,
    brokerPositionsCsv,
  ]
}
