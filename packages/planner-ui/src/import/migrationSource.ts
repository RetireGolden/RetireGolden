/**
 * **Migration source identification** (advisor-intake-and-migration-workbench,
 * WS6). Says WHICH incumbent planning tool a user-provided file came from,
 * publishes what can and cannot be brought over from it, and emits the
 * mandatory unmapped report. It maps no fields itself, and it deliberately
 * never will for three of the four vendors it knows about.
 *
 * **Why this module maps almost nothing, on purpose.** ProjectionLab publishes
 * a user-accessible JSON data export, and the sibling `projectionLab.ts` maps
 * it — that mapper is the only field mapping in this migration surface, it is
 * reused unchanged, and nothing here duplicates it. RightCapital, eMoney and
 * MoneyGuide are different: RetireGolden has no substantiated machine-readable
 * export from any of them, the plan forbids bundling proprietary samples, and
 * inventing column names or JSON shapes for a format nobody here has seen is
 * precisely the bad-mapping risk the plan calls non-negotiable. So those three
 * get identification, published limitations, and the manual path. A field
 * selector for one of them does not belong in this file.
 *
 * **Why identification is conservative.** The WS5 document benchmark measured
 * field *selection* on extracted document text at 17–75% precision — 35 false
 * positives against 28 selections. Deciding "this is an eMoney report" from the
 * same text has the same hazard, so this module: requires a word-boundary match
 * on a product name (a substring inside a longer word cannot trigger it),
 * carries the surrounding text VERBATIM as evidence so a human can judge the
 * claim rather than trust it, grades a structural format match as a strictly
 * stronger claim than a name mention, and refuses to choose when a file names
 * more than one tool.
 *
 * **Why a page citation is a `none` locator.** `SourceLocator` has exactly five
 * kinds — `csvRow`, `jsonPath`, `form1040`, `derived`, `none` — and downstream
 * consumers validate it with a closed switch over those five, rejecting the
 * whole payload on anything else. There is no page kind (the WS5 spike did not
 * earn one). A page citation therefore rides as `{ kind: 'none', note: 'page
 * 4' }`, which is honest — "no precise coordinate in the provenance vocabulary,
 * here is where to look" — rather than a sixth kind nobody can read.
 *
 * Every item this module emits is `status: 'unmapped'`, `confidence:
 * 'unmapped'`, and carries **no** `target`, because nothing lands in a plan.
 * That is not a style choice: `serializeImportProvenance` throws unless an
 * unresolved entry is graded `'unmapped'` and claims no plan destination, and
 * `reviewToProvenance` files exactly `'unmapped'`/`'skipped'` items under
 * `unresolved`. The colocated tests prove the round trip rather than eyeballing
 * the fields.
 *
 * Browser-free (no DOM, no Web Crypto) like the rest of the provenance surface,
 * and published as the `@retiregolden/planner-ui/migration-source` subpath.
 */

import type { DocumentPage } from './documentText'
import { jsonPathLocator as jsonPath, type SourceLocator } from './provenance'
import type { ImportReviewItem } from './reviewChecklist'

/**
 * Longest text this module will try to parse as an export. Deliberately equal
 * to `projectionLab.ts`'s `MAX_IMPORT_JSON_CHARS`, so identification cannot
 * claim a file the mapper would refuse to read on size alone — declared here
 * rather than imported because importing it would pull the whole engine plan
 * model into this subpath for one number. The colocated test asserts the two
 * stay equal, so the duplication cannot drift.
 */
export const MAX_MIGRATION_TEXT_CHARS = 10_000_000

/** The incumbent planning tools this module can recognize. */
export type MigrationVendor = 'projectionlab' | 'rightcapital' | 'emoney' | 'moneyguide'

/** Registry order — also the order candidates are reported in, so output is deterministic. */
export const MIGRATION_VENDORS: readonly MigrationVendor[] = ['projectionlab', 'rightcapital', 'emoney', 'moneyguide']

/**
 * How strong the claim behind one piece of evidence is. Two tiers, and they are
 * not close:
 *
 * - `'structure'` — the file is SHAPED like a format we can parse (the same
 *   shape check the mapper itself gates on). A file cannot accidentally have a
 *   `currentFinances.accounts` array.
 * - `'name'` — the text merely NAMES the product. A comparison spreadsheet, a
 *   cover letter, an advisor's meeting notes, or a screenshot caption all name
 *   products they are not. This tier is a lead, not a conclusion.
 */
export type MigrationEvidenceStrength = 'structure' | 'name'

/** What each strength actually claims, in words a review UI can show verbatim. */
export const MIGRATION_EVIDENCE_CLAIM: Record<MigrationEvidenceStrength, string> = {
  structure: "the file's structure matches this tool's export format, which is a format check rather than a name match",
  name: 'the text names this tool — which is all a comparison sheet, a cover letter, or a screenshot caption would also do',
}

/**
 * Longest evidence excerpt published, in characters. Bounded because the
 * excerpt is copied into a review item and a provenance report: an unbounded
 * one would let a hostile (or merely enormous) document push arbitrary text
 * through the report envelope.
 */
export const MAX_MIGRATION_EVIDENCE_CHARS = 160

/**
 * How many excerpts one vendor may contribute. A 300-page report that says
 * "eMoney" in every footer proves nothing more on page 300 than it did on page
 * 1, and 300 review items would bury the checklist.
 */
export const MAX_MIGRATION_EVIDENCE_PER_VENDOR = 3

/** One thing that matched, quoted rather than summarized, plus where it was. */
export interface MigrationEvidence {
  strength: MigrationEvidenceStrength
  /**
   * What matched, VERBATIM from the source and clipped to
   * {@link MAX_MIGRATION_EVIDENCE_CHARS}. For a `'name'` match this is the
   * product name in its surrounding text (with runs of whitespace collapsed to
   * single spaces, so a PDF's layout padding does not eat the excerpt, and
   * `…` marking a clipped edge — no other character is altered). For a
   * `'structure'` match it is the path or the field value that matched; the
   * locator says which.
   */
  matched: string
  locator: SourceLocator
}

/**
 * What one incumbent tool's migration story is: what a mapper brings over
 * today (nothing, for three of the four), what it cannot, and what to do
 * instead.
 */
export interface MigrationAdapter {
  vendor: MigrationVendor
  displayName: string
  /**
   * The mapper module that maps this vendor's export today, or `null` when
   * RetireGolden has no substantiated format for it and therefore maps nothing.
   */
  mapper: string | null
  /** What a mapped import brings over. Empty whenever `mapper` is null. */
  maps: readonly string[]
  /** Published limitations, as prose a human reads — not codes. */
  limitations: readonly string[]
  /** The manual path, for everything the adapter does not map. */
  manualPath: string
}

/**
 * The manual path for every vendor RetireGolden has no substantiated format
 * for — one string, because the answer genuinely does not vary by vendor. It
 * is also what an ambiguous file gets, since no vendor was claimed for it.
 */
export const NO_FORMAT_MANUAL_PATH =
  'Bring balances over with the broker CSV or spreadsheet import, and seed income and taxes from last year’s Form 1040; everything else is typed on the planner screens.'

/**
 * The published limitations of an identify-only vendor. Shared rather than
 * copied three times: the reason nothing maps is the same reason each time, and
 * three near-identical copies would drift into three subtly different claims.
 */
function noFormatLimitations(displayName: string): readonly string[] {
  return [
    `Nothing is mapped automatically. RetireGolden has no substantiated ${displayName} export format — no documented machine-readable export this project holds a real sample of — and it does not bundle proprietary samples, so there is no format to sniff and no field mapping that could be justified.`,
    'A mapping invented from a format nobody here has seen is the failure mode that matters: it would land wrong numbers in a plan while looking like a successful import. Identification without mapping is the honest position, not a placeholder.',
    'What IS brought across is the document itself: it is identified, and its text is carried over with page citations, so the values can be retyped beside the planner screens with the source in view. The data is not unimportant — the format is unsubstantiated.',
    `What would change this: a real ${displayName} export from a trial account, checked in as a substantiated format with its own fixtures and version sniffing. Then — and only then — is field mapping in scope.`,
  ]
}

/**
 * The published, honest, deliberately lopsided migration surface: one mapper,
 * three identifications.
 */
export const MIGRATION_ADAPTERS: Record<MigrationVendor, MigrationAdapter> = {
  projectionlab: {
    vendor: 'projectionlab',
    displayName: 'ProjectionLab',
    mapper: 'projectionLab',
    maps: [
      'Accounts and balances, typed by keyword (cash, taxable, traditional, Roth, HSA, property, debt)',
      'Taxable cost basis where the export carries it',
      'Income sources — wages-like streams as wages, the rest as recurring ordinary income',
      'Expenses, summed into baseline annual spending',
      'Birth year, as a July-1 date of birth',
      'A retirement milestone age',
    ],
    limitations: [
      'Withdrawal strategy, Roth conversions, market assumptions and scenarios do not transfer between planning tools — they are modeling choices, not data, and RetireGolden models them differently.',
      'Social Security is deferred to the Social Security screen on purpose: RetireGolden needs a claim age and a benefit basis, not the dollar figure another tool projected.',
      'Filing status and state are not in the export and are defaulted, so both need setting on the Household screen.',
      'Account types the keyword map does not recognize (crypto, collectibles, business interests) are reported unmapped rather than guessed into the nearest bucket.',
    ],
    manualPath:
      'The JSON data export is the file that maps — run it through the ProjectionLab import. A PDF or printed report from ProjectionLab maps nothing; bring balances over with the broker CSV or spreadsheet import instead.',
  },
  rightcapital: {
    vendor: 'rightcapital',
    displayName: 'RightCapital',
    mapper: null,
    maps: [],
    limitations: noFormatLimitations('RightCapital'),
    manualPath: NO_FORMAT_MANUAL_PATH,
  },
  emoney: {
    vendor: 'emoney',
    displayName: 'eMoney',
    mapper: null,
    maps: [],
    limitations: noFormatLimitations('eMoney'),
    manualPath: NO_FORMAT_MANUAL_PATH,
  },
  moneyguide: {
    vendor: 'moneyguide',
    displayName: 'MoneyGuide',
    mapper: null,
    maps: [],
    limitations: noFormatLimitations('MoneyGuide'),
    manualPath: NO_FORMAT_MANUAL_PATH,
  },
}

/** One tool the file might have come from, with everything that pointed at it. */
export interface MigrationCandidate {
  vendor: MigrationVendor
  adapter: MigrationAdapter
  evidence: readonly MigrationEvidence[]
}

/**
 * What a scan concluded. Deliberately a union rather than a nullable vendor:
 *
 * A file that names TWO tools is a real, ordinary document — a comparison
 * sheet, a transition memo, an advisor's side-by-side. Picking the first match,
 * the most matches, or the one nearest the top would all be guesses dressed as
 * answers, and the guess is invisible to whoever reads the report. So this
 * module refuses: it reports `'ambiguous'` with every candidate and its
 * evidence, claims no vendor, and the review report says so in as many words.
 * (`classifyRefresh` reaches the same conclusion for the same reason when two
 * plan accounts match one file row.) The one asymmetry is deliberate: a
 * STRUCTURAL match ends the scan outright, so a competitor's name inside a
 * ProjectionLab export cannot make that export ambiguous — a file's shape is
 * evidence about the file, a name in its text is evidence about its subject.
 */
export type MigrationIdentification =
  | ({ outcome: 'identified' } & MigrationCandidate)
  | { outcome: 'ambiguous'; candidates: readonly MigrationCandidate[] }

/**
 * A page citation as the provenance contract can express it. See the module
 * header: `SourceLocator` has no page kind, and a sixth kind would be rejected
 * wholesale by consumers validating with a closed switch.
 */
export function migrationPageLocator(page: number): SourceLocator {
  return { kind: 'none', note: `page ${page}` }
}

/**
 * Product-name patterns, held as source strings so every scan builds its own
 * `RegExp` — a shared global regex carries `lastIndex` between calls and would
 * make results depend on call order.
 *
 * The edge guard is the false-positive protection the WS5 numbers demand: it is
 * what keeps `projectionlabs-are-fun` or `telemoneyguide` from identifying a
 * file. `moneyguide(?:pro)?` is spelled out because MoneyGuidePro is the actual
 * product name and a guard placed straight after `moneyguide` would reject it;
 * the space-separated "MoneyGuide Pro" is already matched by the bare
 * alternative. No stitching across line breaks or hyphenation: a PDF that split
 * a name across two lines goes unidentified, which is the direction that costs
 * a user nothing.
 *
 * NOT `\b`, and {@link NAME_EDGE} exists for exactly that reason. JavaScript's
 * `\b` is defined over ASCII `\w` alone, so ANY non-ASCII or zero-width
 * neighbour manufactures a boundary and defeats the guard. `projectionlab` +
 * U+200D + `oratory` renders on screen character-for-character as
 * `projectionlaboratory` — the decoy this guard is written to reject — and
 * produced a full identification. What makes that serious rather than untidy is
 * how it compounds: the evidence a reviewer is told to check would display as
 * the innocuous word, so nothing on screen could explain why it matched. Soft
 * hyphen (U+00AD) is the case that arrives with no attacker at all, since PDF
 * text layers carry it wherever a word was hyphenated.
 */
const NAME_EDGE = '[\\p{L}\\p{N}\\p{M}_\\u00AD\\u200B-\\u200D\\u2060\\uFEFF]'
const VENDOR_NAME_PATTERN: Record<MigrationVendor, string> = {
  projectionlab: `(?<!${NAME_EDGE})projectionlab(?!${NAME_EDGE})`,
  rightcapital: `(?<!${NAME_EDGE})rightcapital(?!${NAME_EDGE})`,
  emoney: `(?<!${NAME_EDGE})emoney(?!${NAME_EDGE})`,
  moneyguide: `(?<!${NAME_EDGE})moneyguide(?:pro)?(?!${NAME_EDGE})`,
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/**
 * The matched name in its surrounding text, verbatim, clipped to the published
 * bound. Whitespace runs collapse to single spaces — PDF text layers are full
 * of layout padding, and an excerpt that is 90% spaces shows a human nothing.
 */
function excerptAround(text: string, index: number, length: number): string {
  const context = Math.max(0, Math.floor((MAX_MIGRATION_EVIDENCE_CHARS - length) / 2))
  const start = Math.max(0, index - context)
  const end = Math.min(text.length, index + length + context)
  const collapsed = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return clipWithMarkers(collapsed, start > 0, end < text.length)
}

/**
 * Put the published bound and the truncation markers in the right order.
 *
 * The markers are budgeted for BEFORE the body is clipped, because clipping the
 * finished string is self-defeating: it eats the trailing `…` precisely when the
 * right edge was clipped and the marker is the only thing saying so. The bug
 * that produced this function published an excerpt that read as though it ran to
 * the end of the source, in the one case where it did not.
 */
function clipWithMarkers(body: string, leading: boolean, trailing: boolean): string {
  const lead = leading ? 1 : 0
  let room = MAX_MIGRATION_EVIDENCE_CHARS - lead - (trailing ? 1 : 0)
  let marked = trailing
  // A body this bound is about to cut needs a marker whether or not the SLICE
  // was cut — and the marker has to be budgeted for before the cut, or the
  // published string comes out one character over the promise.
  if (body.length > room) {
    marked = true
    room = MAX_MIGRATION_EVIDENCE_CHARS - lead - 1
  }
  const clipped = body.length > room ? body.slice(0, Math.max(0, room)) : body
  return `${leading ? '…' : ''}${clipped}${marked ? '…' : ''}`
}

/**
 * Scan one chunk of text for every vendor name, appending to `found`. The
 * caller supplies the locator because only it knows where the text came from
 * (page N of a document, or an export's body).
 */
function collectNameEvidence(text: string, locator: SourceLocator, found: Map<MigrationVendor, MigrationEvidence[]>): void {
  if (text === '') return
  for (const vendor of MIGRATION_VENDORS) {
    const evidence = found.get(vendor) ?? []
    if (evidence.length >= MAX_MIGRATION_EVIDENCE_PER_VENDOR) continue
    // `u` is REQUIRED, not decorative: `\p{L}` and friends in NAME_EDGE are
    // only property escapes under it. Without the flag they degrade silently
    // into a class of literal `p`, `{`, `L`, `}` characters — a guard that looks
    // right and blocks nothing it was written to block.
    const pattern = new RegExp(VENDOR_NAME_PATTERN[vendor], 'giu')
    for (const match of text.matchAll(pattern)) {
      if (evidence.length >= MAX_MIGRATION_EVIDENCE_PER_VENDOR) break
      evidence.push({ strength: 'name', matched: excerptAround(text, match.index, match[0].length), locator })
    }
    if (evidence.length > 0) found.set(vendor, evidence)
  }
}

function resolve(found: Map<MigrationVendor, MigrationEvidence[]>): MigrationIdentification | null {
  const candidates: MigrationCandidate[] = []
  for (const vendor of MIGRATION_VENDORS) {
    const evidence = found.get(vendor)
    if (evidence !== undefined && evidence.length > 0) candidates.push({ vendor, adapter: MIGRATION_ADAPTERS[vendor], evidence })
  }
  if (candidates.length === 0) return null
  if (candidates.length === 1) {
    const only = candidates[0]!
    return { outcome: 'identified', vendor: only.vendor, adapter: only.adapter, evidence: only.evidence }
  }
  return { outcome: 'ambiguous', candidates }
}

/**
 * Identify the tool a decoded text or JSON export came from.
 *
 * ProjectionLab is identified STRUCTURALLY here, by the same root-object /
 * `currentFinances.accounts` array shape `mapProjectionLabExport` gates on, so
 * identification and mapping cannot disagree about what the file is. When the
 * export carries `meta.app` / `meta.exportVersion` those are published as extra
 * evidence — the existing mapper never reads them, though real exports carry
 * them — but nothing is GATED on a version string this project has never seen.
 * An unrecognized version is still ProjectionLab; the mapper's own structural
 * refusal is the backstop if the shape has actually moved.
 *
 * Everything else falls through to conservative name matching over the raw
 * text. Returns `null` when nothing matched — no vendor, no claims.
 */
export function identifyMigrationExport(text: string): MigrationIdentification | null {
  const structural = projectionLabStructure(text)
  if (structural !== null) {
    // A structural match ends the scan: see `MigrationIdentification` on why a
    // competitor named inside a real ProjectionLab export is not ambiguity.
    return { outcome: 'identified', vendor: 'projectionlab', adapter: MIGRATION_ADAPTERS.projectionlab, evidence: structural }
  }
  const found = new Map<MigrationVendor, MigrationEvidence[]>()
  collectNameEvidence(text, { kind: 'none', note: 'the export text' }, found)
  return resolve(found)
}

/**
 * The ProjectionLab shape check, mirroring `mapProjectionLabExport`'s own: a
 * root object carrying a `currentFinances.accounts` array. Returns the evidence
 * for a match, or `null` — never throws on hostile input.
 */
function projectionLabStructure(text: string): MigrationEvidence[] | null {
  if (text.length > MAX_MIGRATION_TEXT_CHARS) return null
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  const root = asRecord(raw)
  if (root === null) return null
  const currentFinances = asRecord(root['currentFinances'])
  if (currentFinances === null || !Array.isArray(currentFinances['accounts'])) return null

  const evidence: MigrationEvidence[] = [
    { strength: 'structure', matched: 'currentFinances.accounts', locator: jsonPath('currentFinances.accounts') },
  ]
  // Version evidence, reported and never gated on. This value comes out of a
  // file someone else wrote, so it gets the SAME treatment a name excerpt gets:
  // whitespace collapsed, and clipped with a marker that says it was clipped.
  // Published raw it could carry newlines and control characters into the
  // quoted `detail` of a review item and fracture what a reviewer reads — and a
  // long value was being cut at the bound with no marker at all, presenting a
  // truncated version string as the whole of it.
  const meta = asRecord(root['meta'])
  if (meta !== null) {
    for (const key of ['app', 'exportVersion'] as const) {
      const value = meta[key]
      const shown =
        typeof value === 'string'
          ? value
          : typeof value === 'number' && Number.isFinite(value)
            ? // A numeric version cannot be quoted verbatim and must not pretend
              // to be: `JSON.parse` has already discarded the token, so `2.0`
              // and `2` are the same value by the time they reach here, and
              // publishing `"2"` sends a reviewer looking for a string the file
              // does not contain. Say where the number came from instead.
              `${String(value)} (a number in the file, not text)`
            : null
      const collapsed = shown === null ? '' : shown.replace(/\s+/g, ' ').trim()
      if (collapsed !== '') {
        evidence.push({
          strength: 'structure',
          matched: clipWithMarkers(collapsed, false, false),
          locator: jsonPath(`meta.${key}`),
        })
      }
    }
  }
  return evidence
}

/**
 * Identify the tool a PDF's extracted pages came from, citing page numbers.
 *
 * Reads `page.page` for every citation, never the array index: a page that
 * failed extraction is ABSENT from `pages` (it is listed in
 * `summary.unreadablePages` instead), so page numbers are routinely
 * non-contiguous and `pages[i]` is not page `i + 1`. Only `'name'`-strength
 * evidence is available from a document — a PDF has no parseable export shape —
 * which is exactly why a document identification reads as the weaker claim it
 * is. Returns `null` when nothing matched.
 */
export function identifyMigrationDocument(pages: readonly DocumentPage[]): MigrationIdentification | null {
  const found = new Map<MigrationVendor, MigrationEvidence[]>()
  for (const page of pages) {
    collectNameEvidence(page.text, migrationPageLocator(page.page), found)
  }
  return resolve(found)
}

export interface MigrationReviewOptions {
  /**
   * The extracted pages, when the source was a document. Used only to report
   * which pages of text came across — the report cites the page numbers a
   * human can read the values off, since nothing here maps them.
   */
  pages?: readonly DocumentPage[]
}

/** How many page numbers the "text carried over" item lists before it elides. */
const MAX_LISTED_PAGES = 20

function listPages(pages: readonly DocumentPage[]): string {
  const numbers = pages.map((page) => page.page)
  const shown = numbers.slice(0, MAX_LISTED_PAGES).join(', ')
  return numbers.length > MAX_LISTED_PAGES ? `${shown}, … (${numbers.length} pages)` : shown
}

/** Every item this module emits looks exactly like this — see the module header. */
function unmappedItem(source: string, detail: string, locator: SourceLocator): ImportReviewItem {
  return { status: 'unmapped', source, detail, locator, confidence: 'unmapped' }
}

function evidenceItems(candidate: MigrationCandidate, sourceName: string, lead: string): ImportReviewItem[] {
  return candidate.evidence.map((evidence, index) =>
    unmappedItem(
      `${sourceName} — ${candidate.adapter.displayName}`,
      index === 0
        ? `${lead} The claim rests on this: ${MIGRATION_EVIDENCE_CLAIM[evidence.strength]}. Matched: “${evidence.matched}”. Check it — nothing was mapped on the strength of it.`
        : `Also matched: “${evidence.matched}”.`,
      evidence.locator,
    ),
  )
}

/**
 * **The unmapped report.** Turns an identification into review items — the
 * mandatory WS6 deliverable and, for three of the four vendors, the entire
 * output of the migration path.
 *
 * Every item is `status: 'unmapped'` with `confidence: 'unmapped'` and no
 * `target`, which is what `reviewToProvenance` files under `unresolved` and
 * what `serializeImportProvenance` will accept there. A `null` identification
 * produces `[]` — no vendor claim, no claims at all.
 *
 * The one case that produces a SHORT report is a structurally-identified
 * ProjectionLab export, because `mapProjectionLabExport` already emits its own
 * checklist covering every value that landed, every default it invented, and
 * the categorically non-transferable tail. Repeating that here would double
 * every line in the wizard. Identification is added; the rest is deferred. A
 * ProjectionLab file identified only by NAME (a printed report, say) gets the
 * full treatment, because in that case no mapper ran at all.
 */
export function buildMigrationReview(
  identification: MigrationIdentification | null,
  sourceName: string,
  options: MigrationReviewOptions = {},
): ImportReviewItem[] {
  if (identification === null) return []
  const items: ImportReviewItem[] = []

  if (identification.outcome === 'ambiguous') {
    const names = identification.candidates.map((candidate) => candidate.adapter.displayName)
    items.push(
      unmappedItem(
        sourceName,
        `This file names more than one planning tool (${names.join(', ')}), so no tool was claimed for it — a comparison sheet or a transition memo looks exactly like this, and guessing between them would put a wrong label on the whole import. Every match is listed below; pick the right tool by hand if the file really is an export.`,
        { kind: 'none', note: `${names.length} planning tools named in ${sourceName}` },
      ),
    )
    for (const candidate of identification.candidates) {
      items.push(...evidenceItems(candidate, sourceName, `${candidate.adapter.displayName} is one of the tools named in this file.`))
    }
    items.push(
      unmappedItem(`${sourceName} — what to do instead`, NO_FORMAT_MANUAL_PATH, {
        kind: 'none',
        note: 'no tool was claimed for this file',
      }),
    )
    if (options.pages !== undefined && options.pages.length > 0) items.push(pagesItem(sourceName, options.pages))
    return items
  }

  const { adapter, evidence } = identification
  // The mapper "ran" only on a STRUCTURAL match, not merely because the vendor
  // HAS a mapper: a ProjectionLab PDF identified by name maps nothing, and
  // pointing its reader at a mapper checklist that never ran would be a lie.
  const mapper = adapter.mapper !== null && evidence.some((item) => item.strength === 'structure') ? adapter.mapper : null

  items.push(
    ...evidenceItems(
      identification,
      sourceName,
      mapper !== null
        ? `Identified as a ${adapter.displayName} export, and mapped by the ${mapper} import — what transferred, what was assumed, and what did not transfer are on that import's own checklist and are not repeated here.`
        : `Identified as a ${adapter.displayName} file. Nothing was mapped from it.`,
    ),
  )
  if (mapper !== null) return items

  for (const limitation of adapter.limitations) {
    items.push(
      unmappedItem(`${sourceName} — ${adapter.displayName} limitations`, limitation, {
        kind: 'none',
        note: `published limitation of the ${adapter.displayName} migration path`,
      }),
    )
  }
  items.push(
    unmappedItem(`${sourceName} — what to do instead`, adapter.manualPath, {
      kind: 'none',
      note: `manual path for ${adapter.displayName}`,
    }),
  )
  if (options.pages !== undefined && options.pages.length > 0) items.push(pagesItem(sourceName, options.pages))
  return items
}

/** Only ever called with a non-empty page list — `buildMigrationReview` gates it. */
function pagesItem(sourceName: string, pages: readonly DocumentPage[]): ImportReviewItem {
  const one = pages.length === 1
  return unmappedItem(
    `${sourceName} — text carried over`,
    `Text was read from ${one ? 'page' : 'pages'} ${listPages(pages)} and carried over as-is; no value on ${one ? 'it' : 'them'} was mapped into the plan. Read the page beside the planner screen you are filling in — these are the document's own page numbers, so a page that could not be extracted is simply missing from the list rather than shifting the rest of it.`,
    { kind: 'none', note: `${one ? 'page' : 'pages'} ${listPages(pages)}` },
  )
}
