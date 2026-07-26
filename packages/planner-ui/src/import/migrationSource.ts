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

import type { DocumentPage, DocumentTextSummary } from './documentText'
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
  /**
   * This value argues AGAINST the identification rather than for it, and is
   * published anyway.
   *
   * A file whose shape matches ProjectionLab but whose own `meta.app` says
   * "eMoney" is the case: the structural conclusion stands (a shape is a much
   * harder thing to have by accident than a label), but listing that label
   * silently among the supporting evidence would read as corroboration of the
   * opposite of what it says. Dropping it would be worse still — a reviewer who
   * later opened the file would find the one detail this report had chosen not
   * to mention.
   */
  contradicts?: boolean
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
    // What text comes across is decided per FILE, not per vendor, so it cannot
    // be promised here: these strings are built once at module load, and a
    // vendor identified from a CSV or a pasted export has no pages at all. This
    // list used to promise "its text is carried over with page citations" for
    // every identify-only vendor, which was simply untrue for every non-PDF
    // source. `buildMigrationReview` says what actually came across, because it
    // is the only place that can see it.
    'The data is not unimportant — the format is unsubstantiated. What can be brought across from this file is stated separately below.',
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
    // This text is reached in TWO situations that look the same from here and
    // are not: the mapper was never run (a printed report, or a host that only
    // identified the file), and the mapper ran and refused it — its own size cap,
    // or a draft that failed plan validation. The old wording assumed the first
    // and told the second to run the import that had just failed, while offering
    // the broker/spreadsheet fallback only to PDFs. So the fallback is offered
    // unconditionally: it is the answer in both situations, and a reader who has
    // already tried the import needs somewhere to go rather than a loop.
    manualPath:
      'The JSON data export is the file that maps: if it has not been through the ProjectionLab import yet, start there. If it has already been tried and would not go through — or all you have is a PDF or a printed report, which maps nothing — bring balances over with the broker CSV or spreadsheet import instead, seed income and taxes from last year’s Form 1040, and type the rest on the planner screens.',
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
 *
 * `\p{Cf}` rather than a list of the invisible characters that came to mind:
 * the first version of this guard enumerated U+00AD, U+200B-200D, U+2060 and
 * U+FEFF, which left the bidi marks and isolates (U+200E, U+200F, U+2066-2069)
 * and the override U+202E still able to defeat it — every one of them a
 * character that renders as nothing. Enumerating a class whose whole point is
 * that its members are invisible is a losing game; name the category instead.
 */
const NAME_EDGE = '[\\p{L}\\p{N}\\p{M}\\p{Cf}_]'
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
  // THE MATCH IS RESERVED FIRST, and the context gets whatever is left. Built
  // the other way round — window the raw text, sanitise, then clip from the
  // right — the quotation could lose the very thing it is quoting: thirty
  // control characters ahead of `RightCapital` each expand to an eight-character
  // `<U+0007>` during sanitising, and the clip then cut the name off the end. An
  // excerpt labelled "Matched:" that does not contain the match is worse than no
  // excerpt, because it reads as though that is what the file says.
  const matched = printableFragment(text.slice(index, index + length))
  if (matched.length >= MAX_MIGRATION_EVIDENCE_CHARS) {
    // The match alone fills the budget. Nothing else can be shown, and the
    // marker says the quotation is not the whole of it.
    return clipWithMarkers(matched, false, false)
  }

  // Split what is left between the two sides, then sanitise each side
  // separately so an expansion on one cannot eat the other or the match.
  const room = MAX_MIGRATION_EVIDENCE_CHARS - matched.length
  const context = Math.max(0, Math.floor(room / 2))
  const start = wholeCharacterBoundary(text, Math.max(0, index - context))
  const end = wholeCharacterBoundary(text, Math.min(text.length, index + length + context))
  // `printableFragment`, not `printableEvidence`: trimming each side would eat
  // the spaces ADJACENT to the match and glue the excerpt together —
  // "Generated withRightCapitalon March 14" — which stops it being verbatim at
  // exactly the two positions a reader looks at first. Only the outer edges are
  // trimmed, below.
  const before = printableFragment(text.slice(start, index))
  const after = printableFragment(text.slice(index + length, end))

  // Each side is trimmed toward the match — the left from its left, the right
  // from its right — so the match keeps its immediate surroundings, which is the
  // part that lets a reader judge the claim.
  const half = Math.max(0, Math.floor((room - 2) / 2))
  const leftClipped = before.length > half
  const rightClipped = after.length > half
  // Trim the OUTER edges only — a leading space after the ellipsis, or a
  // trailing one before it, shows a reader nothing.
  const left = (leftClipped ? sliceTailWholeCharacters(before, half) : before).replace(/^\s+/, '')
  const right = (rightClipped ? sliceWholeCharacters(after, half) : after).replace(/\s+$/, '')

  const leadingMarker = start > 0 || leftClipped
  const trailingMarker = end < text.length || rightClipped
  return `${leadingMarker ? '…' : ''}${left}${matched}${right}${trailingMarker ? '…' : ''}`
}

/**
 * Nudge a raw index off the middle of a surrogate pair.
 *
 * The window boundaries are computed in code units, so either end can land
 * between the two halves of an astral character — one emoji near the edge of the
 * context and the slice begins or ends with half of it. Sanitising cannot repair
 * that (a lone surrogate is not a control character), so it has to not happen.
 */
function wholeCharacterBoundary(text: string, index: number): number {
  if (index <= 0 || index >= text.length) return index
  const code = text.charCodeAt(index)
  // A LOW surrogate here means the character started at index - 1.
  return code >= 0xdc00 && code <= 0xdfff ? index - 1 : index
}

/**
 * Make a fragment of someone else's file safe to publish AS EVIDENCE, which is
 * a stricter job than making it safe to store.
 *
 * Whitespace runs collapse to single spaces — PDF text layers are full of layout
 * padding, and an excerpt that is 90% spaces shows a human nothing. Everything
 * left that renders as nothing or as something other than itself is then
 * replaced by a VISIBLE `<U+XXXX>`: control characters (BEL rings a terminal,
 * ESC begins an escape sequence) and format characters (the bidi override U+202E
 * reverses the display order of the text after it, so an excerpt could be made
 * to read as something it is not).
 *
 * Whitespace first, then escaping, deliberately: newline and tab are control
 * characters too, and they want collapsing into a space, not rendering as
 * `<U+000A>`.
 *
 * This is not only sanitisation — it is the evidence doing its job. The reason
 * an identification can hinge on an invisible character is precisely that the
 * character is invisible; showing it is what lets a reviewer see WHY something
 * matched instead of staring at a word that looks ordinary.
 */
function printableEvidence(text: string): string {
  return printableFragment(text).trim()
}

/**
 * {@link printableEvidence} without the trim, for a piece that will be joined to
 * another piece. The spaces at a fragment's edges are real text when the
 * fragment sits next to the matched name, and dropping them makes the quotation
 * say something the file does not.
 */
function printableFragment(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, (ch) => `<U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}>`)
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
  const clipped = body.length > room ? sliceWholeCharacters(body, Math.max(0, room)) : body
  return `${leading ? '…' : ''}${clipped}${marked ? '…' : ''}`
}

/**
 * `slice`, but never through the middle of a character.
 *
 * `String.prototype.slice` counts UTF-16 code units, and every astral character
 * — emoji, and a great deal of CJK — is two of them. A cut that lands between
 * the two halves leaves a lone surrogate, which renders as `` and is not a
 * faithful excerpt of anything. That matters more here than it would elsewhere:
 * the excerpt is published as EVIDENCE, quoted back to a reviewer as what the
 * file says, so a character this module invented has no business in it.
 *
 * The bound stays a code-unit bound (it is a promise about the published
 * string's length, and `length` is in code units) — this only steps the cut back
 * by one when it would split a pair.
 */
/**
 * {@link sliceWholeCharacters} from the other end — the last `room` code units,
 * never beginning on the second half of a character.
 *
 * The left side of an excerpt is trimmed from its LEFT so the text nearest the
 * match survives, and that cut has exactly the same hazard as the one at the far
 * end: land it one unit inside an emoji and the excerpt opens with an orphaned
 * low surrogate. Three separate cuts in this function needed the same care, and
 * this was the last of them to get it.
 */
function sliceTailWholeCharacters(body: string, room: number): string {
  if (room <= 0) return ''
  if (body.length <= room) return body
  const start = body.length - room
  const code = body.charCodeAt(start)
  // A LOW surrogate first means its high half was just cut off; drop it too.
  return body.slice(code >= 0xdc00 && code <= 0xdfff ? start + 1 : start)
}

function sliceWholeCharacters(body: string, room: number): string {
  if (room <= 0) return ''
  const code = body.charCodeAt(room - 1)
  // A high surrogate in the last kept position means its partner was next.
  const splitsPair = code >= 0xd800 && code <= 0xdbff
  return body.slice(0, splitsPair ? room - 1 : room)
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
  // The size ceiling governs the WHOLE function, not just the structural parse.
  // With the check only inside `projectionLabStructure`, an oversized export
  // fell through to the name scan and came back identified-by-name — so a
  // ProjectionLab file the mapper had refused for its SIZE was reported as an
  // unmapped file of unsubstantiated format, which is a different and untrue
  // account of what happened. It also meant four regex passes over an input
  // already known to be past the limit.
  if (text.length > MAX_MIGRATION_TEXT_CHARS) return null
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
  // run through `printableEvidence`, and clipped with a marker that says it was
  // clipped. Published raw it could carry control and format characters into the
  // quoted `detail` of a review item — where they reach the provenance envelope
  // and anything that renders it — and a long value was being cut at the bound
  // with no marker at all, presenting a truncated version string as the whole
  // of it.
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
      const collapsed = shown === null ? '' : printableEvidence(shown)
      if (collapsed !== '') {
        // `meta.app` is the file's claim about which program wrote it, and it
        // is not automatically evidence FOR ProjectionLab: a structurally
        // matching file carrying `meta.app: "eMoney"` was being listed as
        // additional support for the ProjectionLab identification, which reads
        // as corroboration of the opposite of what it says. A value that names
        // the tool corroborates; one that names something else CONTRADICTS, and
        // is reported as such — dropping it would be worse, since a reviewer
        // seeing it might well conclude the shape check was fooled.
        //
        // The structural conclusion stands either way: the shape is the claim,
        // and a label is not a shape. `exportVersion` is never a vendor claim in
        // the first place, so it is only ever supporting detail.
        // Tested against the RAW value, never the sanitised one. Sanitising
        // turns an invisible character into visible punctuation, and punctuation
        // is a legal name edge — so `ProjectionLab<ZWJ>oratory`, which the raw
        // pattern correctly rejects for the same reason it rejects
        // `ProjectionLaboratory`, became `ProjectionLab<U+200D>oratory` and
        // matched. The display transform would have been manufacturing the
        // boundary that the check then found: decide first, render second.
        const contradicts = key === 'app' && !new RegExp(VENDOR_NAME_PATTERN.projectionlab, 'iu').test(String(value))
        evidence.push({
          strength: 'structure',
          matched: clipWithMarkers(collapsed, false, false),
          locator: jsonPath(`meta.${key}`),
          ...(contradicts ? { contradicts: true } : {}),
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
  /**
   * The extraction summary that came back with those pages. Supplies what the
   * page list cannot: which pages are ABSENT from it and why. Without this the
   * report can only say that something might be missing, which tells a reader
   * nothing they can act on.
   */
  summary?: DocumentTextSummary
  /**
   * The vendor's own mapper ran on this file AND succeeded, so its checklist is
   * being shown alongside this report.
   *
   * Nothing in this module invokes a mapper, so nothing in it can observe this;
   * only the caller knows. Absent or `false` means the full report — limitations
   * and the manual path — which is the safe default: it is never WRONG to show
   * a user what could not be brought over, only longer. Claiming a successful
   * mapping that did not happen is wrong, and worst exactly when the import
   * failed.
   */
  mapped?: boolean
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

function evidenceItems(
  candidate: MigrationCandidate,
  sourceName: string,
  lead: string,
  mapped: boolean,
): ImportReviewItem[] {
  return candidate.evidence.map((evidence, index) =>
    unmappedItem(
      `${sourceName} — ${candidate.adapter.displayName}`,
      index === 0
        ? // The closing sentence has to differ between the two paths or it
          // contradicts the one it does not fit. On the identify-only path
          // "nothing was mapped on the strength of it" is the point of the whole
          // report; on the mapped path the lead has just said the file WAS
          // mapped, so the same words read as a denial of the sentence before
          // them. What is true in both cases is narrower: this identification
          // item is not itself a mapped value.
          `${lead} The claim rests on this: ${MIGRATION_EVIDENCE_CLAIM[evidence.strength]}. Matched: “${evidence.matched}”. Check it — ${
            mapped
              ? 'this identification is a note about the file, not one of the values that transferred.'
              : 'nothing was mapped on the strength of it.'
          }`
        : evidence.contradicts === true
          ? `Against it: the file's own label says “${evidence.matched}”, which does not name ${candidate.adapter.displayName}. The identification stands on the file's structure — a shape is far harder to have by accident than a label — but this is here because you should see it.`
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
  rawSourceName: string,
  options: MigrationReviewOptions = {},
): ImportReviewItem[] {
  if (identification === null) return []
  // The FILE NAME gets the same treatment the file's contents get, and for the
  // same reason. It is attacker-controlled in the identical sense — a browser
  // will hand over a name containing U+202E or a newline — and it is
  // interpolated into every label and locator note below, so a bidi override in
  // it reorders the displayed evidence line and a newline fractures the exported
  // provenance text. Sanitising the contents and then rendering them under an
  // unsanitised name would defeat the whole exercise. Callers keep the raw name
  // for identity (`ImportSourceRef.file` is where it belongs); what appears in
  // human-facing prose is this.
  const sourceName = printableEvidence(rawSourceName)
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
      items.push(...evidenceItems(candidate, sourceName, `${candidate.adapter.displayName} is one of the tools named in this file.`, false))
    }
    items.push(
      unmappedItem(`${sourceName} — what to do instead`, NO_FORMAT_MANUAL_PATH, {
        kind: 'none',
        note: 'no tool was claimed for this file',
      }),
    )
    if (options.pages !== undefined && options.pages.length > 0) items.push(...pageItems(sourceName, options.pages))
    if (options.summary !== undefined) items.push(...omittedPageItems(sourceName, options.summary))
    return items
  }

  const { adapter, evidence } = identification
  // Three things must ALL be true before this report may point a reader at a
  // mapper's checklist instead of its own limitations, and the third is the one
  // that was missing: the vendor has a mapper, the file matched STRUCTURALLY
  // (a ProjectionLab PDF identified by name maps nothing), and the caller says
  // the mapper actually ran and SUCCEEDED.
  //
  // Structural recognition is not evidence that anything was mapped. Nothing
  // here invokes the mapper; a host can call `buildMigrationReview` without ever
  // calling it, and `mapProjectionLabExport` can refuse a file it recognises —
  // its own size cap, or a draft that fails plan validation. In either case the
  // old expression claimed the export "was mapped", then returned early and
  // withheld the limitations and the manual path from the one user who most
  // needed them: the one whose import had just failed. Defaulting `mapped` to
  // false is the safe direction — a caller who says nothing gets the full
  // report, which is never wrong, only longer.
  const mapper =
    adapter.mapper !== null && options.mapped === true && evidence.some((item) => item.strength === 'structure')
      ? adapter.mapper
      : null

  items.push(
    ...evidenceItems(
      identification,
      sourceName,
      mapper !== null
        ? `Identified as a ${adapter.displayName} export, and mapped by the ${mapper} import — what transferred, what was assumed, and what did not transfer are on that import's own checklist and are not repeated here.`
        : `Identified as a ${adapter.displayName} file. Nothing was mapped from it.`,
      mapper !== null,
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
  if (options.pages !== undefined && options.pages.length > 0) items.push(...pageItems(sourceName, options.pages))
    if (options.summary !== undefined) items.push(...omittedPageItems(sourceName, options.summary))
  return items
}

/**
 * What actually came across, page state by page state — never one list.
 *
 * `extractDocumentText` deliberately returns three kinds of page and they mean
 * three different things to somebody about to retype values by hand. Listing
 * them together said "text was read from these pages and carried over as-is"
 * over a set that could include a scan carrying no text at all, and a page whose
 * text was CLIPPED at the reader's cap. Both hide exactly what a manual
 * migration needs to know — the first is the OCR case WS5 declined to scope, and
 * the second means values are missing from a page that looks complete.
 *
 * Called only with a non-empty page list; `buildMigrationReview` gates it.
 */
/**
 * What the reader could tell about ONE page, as a closed set.
 *
 * This exists because the alternative did not work. The three signals a
 * `DocumentPage` carries — whether `text` is empty, `imageOnly`, `truncated` —
 * make eight combinations, and picking them off with a filter per case meant
 * reasoning about one cell at a time and getting a different cell wrong on each
 * pass: a scan read as blank, then a blank page was told it needed OCR, then a
 * page emptied by a zero-character cap fell into whichever bucket was tested
 * first. A total function over the whole space, with a test that enumerates all
 * eight, is what makes "is every case handled?" a question with an answer.
 */
export type PageReadState =
  /** Text came across, and the reader was not cut off mid-page. */
  | 'text'
  /** A cap stopped the reader partway through this page, whatever it had so far. */
  | 'clipped'
  /** No text, and the reader saw a raster image it cannot read. */
  | 'image'
  /** No text and no image the reader recognises. Says nothing about vectors. */
  | 'no-marks'

/**
 * `truncated` is tested FIRST and on its own: it is the only signal that says
 * the reader stopped early on this page, and it can be set with text present or
 * absent. Everything after it describes a page the reader saw all of.
 */
export function classifyPage(page: DocumentPage): PageReadState {
  if (page.truncated) return 'clipped'
  if (page.text !== '') return 'text'
  return page.imageOnly ? 'image' : 'no-marks'
}

function pageItems(sourceName: string, pages: readonly DocumentPage[]): ImportReviewItem[] {
  const byState = (state: PageReadState): DocumentPage[] => pages.filter((page) => classifyPage(page) === state)
  const readable = byState('text')
  const clipped = byState('clipped')
  const scanned = byState('image')
  const blank = byState('no-marks')
  const items: ImportReviewItem[] = []

  if (readable.length > 0) {
    const one = readable.length === 1
    items.push(
      unmappedItem(
        `${sourceName} — text carried over`,
        `Text was read from ${one ? 'page' : 'pages'} ${listPages(readable)} and carried over as-is; no value on ${one ? 'it' : 'them'} was mapped into the plan. Read the page beside the planner screen you are filling in — these are the document's own page numbers, so a page that could not be extracted is simply missing from the list rather than shifting the rest of it.`,
        { kind: 'none', note: `${one ? 'page' : 'pages'} ${listPages(readable)}` },
      ),
    )
  }
  if (clipped.length > 0) {
    const one = clipped.length === 1
    items.push(
      unmappedItem(
        `${sourceName} — text cut short`,
        // Deliberately does not name WHICH cap. `DocumentPage.truncated` is set
        // by the per-page cap and by the document-wide budget running out
        // partway through a page, and the page itself cannot tell them apart —
        // so attributing it to the per-page limit was a guess that would be
        // wrong on exactly the long documents where it matters. What the reader
        // needs to do is the same either way.
        `${one ? 'Page' : 'Pages'} ${listPages(clipped)} held more text than the reader kept, so what came across ${one ? 'stops' : 'stop'} partway. Open the original for ${one ? 'that page' : 'those pages'} rather than trusting what is here to be all of it.`,
        { kind: 'none', note: `${one ? 'page' : 'pages'} ${listPages(clipped)}` },
      ),
    )
  }
  // Both sentences below are written to the LIMIT of what `imageOnly` can
  // support, which is less than it sounds like. The reader sets it when it sees
  // any raster paint operation and measures no page coverage at all — WS5's own
  // findings note records this — so it cannot tell a full-page scan from a
  // corner logo, and it says nothing whatever about vector drawing. Claiming
  // "this is a scan" or "this page is empty" from it is claiming more than the
  // signal carries, and the second is the more dangerous of the two: a financial
  // report whose text was converted to outlines has no text layer and no raster
  // image, and would have been reported as nothing worth checking.
  if (scanned.length > 0) {
    const one = scanned.length === 1
    items.push(
      unmappedItem(
        `${sourceName} — an image the reader cannot read`,
        `${one ? 'Page' : 'Pages'} ${listPages(scanned)} carried no text, only an image the reader cannot read — commonly a scan or a photograph of a statement, though it can also be something as small as a logo or a watermark on an otherwise empty page. Reading an image needs OCR, which RetireGolden does not do. Open ${one ? 'it' : 'them'} in the original to see which, and type in anything that matters.`,
        { kind: 'none', note: `${one ? 'page' : 'pages'} ${listPages(scanned)}` },
      ),
    )
  }
  if (blank.length > 0) {
    const one = blank.length === 1
    items.push(
      unmappedItem(
        `${sourceName} — nothing the reader could read`,
        `${one ? 'Page' : 'Pages'} ${listPages(blank)} gave up no text and no image the reader recognised. That is usually a genuinely blank page — a separator or a spacer — but the reader only looks for text and for raster images, so a page drawn as vector graphics, or one whose text was converted to outlines, looks exactly the same to it. Glance at ${one ? 'it' : 'them'} in the original before assuming ${one ? 'it holds' : 'they hold'} nothing.`,
        { kind: 'none', note: `${one ? 'page' : 'pages'} ${listPages(blank)}` },
      ),
    )
  }
  return items
}

/**
 * The pages that never reached `options.pages` at all — named, rather than left
 * to be inferred from a gap in a list.
 *
 * Two ways a page goes missing, and a manual migration needs both spelled out,
 * because the whole point of this report is telling somebody which originals
 * still need their eyes on them:
 *
 *  - `summary.unreadablePages` — pdfjs failed on that page specifically.
 *  - the DOCUMENT-wide text cap stopped extraction partway, so every page after
 *    some point was never looked at. Those page numbers are not enumerated
 *    anywhere, so this reports the count and where the reading stopped.
 *
 * Saying "a page that could not be extracted is simply missing from the list"
 * was true and useless: it told a reader that something might be absent without
 * telling them what.
 */
function omittedPageItems(sourceName: string, summary: DocumentTextSummary): ImportReviewItem[] {
  const items: ImportReviewItem[] = []
  const unreadable = summary.unreadablePages
  if (unreadable.length > 0) {
    const one = unreadable.length === 1
    const shown = unreadable.slice(0, MAX_LISTED_PAGES).join(', ')
    const list = unreadable.length > MAX_LISTED_PAGES ? `${shown}, … (${unreadable.length} pages)` : shown
    items.push(
      unmappedItem(
        `${sourceName} — could not be read`,
        `${one ? 'Page' : 'Pages'} ${list} could not be read at all — not blank, not a scan, but a page the reader failed on. Nothing is known about what ${one ? 'it holds' : 'they hold'}, so open ${one ? 'it' : 'them'} in the original.`,
        { kind: 'none', note: `${one ? 'page' : 'pages'} ${list}` },
      ),
    )
  }
  // Early stopping is read off `truncatedBy`, which is what actually records it,
  // rather than inferred from the page counts. The inference was doubly wrong:
  // it required ZERO unreadable pages, so one failed page anywhere silenced the
  // warning that every LATER page was never opened at all — the report then
  // named the failed page and said nothing about the rest of the document. And
  // `pagesExtracted` is not "the last page reached" when extraction failed on
  // some, so it could not be used to say where the reading stopped either.
  // COUNTED, not case-analysed. Three versions of this were written as
  // conditions over `truncatedBy`, `unreadablePages` and the page counts, and
  // each was wrong in a different direction: one unreadable page silenced the
  // warning entirely; then the document cap clipping the LAST page announced a
  // remainder that does not exist. The question is arithmetic — how many pages
  // did the reader never open — and arithmetic cannot be wrong in a direction.
  // A page was either extracted, or recorded unreadable, or never reached.
  const seen = summary.pagesExtracted + unreadable.length
  const neverOpened = Math.max(0, summary.totalPages - seen)
  if (neverOpened > 0) {
    items.push(
      unmappedItem(
        `${sourceName} — reading stopped early`,
        // The COUNT is what this knows; the CAUSE is only stated when
        // `truncatedBy` recorded one. Naming the text budget unconditionally
        // would be asserting a reason the arithmetic cannot see — the same habit
        // that made the surrounding condition wrong three times.
        `${seen} of ${summary.totalPages} pages were opened${
          summary.truncatedBy.includes('document_text_cap') ? ', the reader having run out of its text budget partway through' : ''
        }. The remaining ${neverOpened} ${neverOpened === 1 ? 'page was' : 'pages were'} never looked at, so nothing from ${neverOpened === 1 ? 'it' : 'them'} is in this report — not even a note saying a page was unreadable. Work through the remainder by hand, or split the document and bring the rest in separately.`,
        { kind: 'none', note: `${seen} of ${summary.totalPages} pages opened` },
      ),
    )
  }
  return items
}
