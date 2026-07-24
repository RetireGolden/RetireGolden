/**
 * The **import-provenance contract**: the vocabulary and export envelope that
 * record, for every value an import mapper lands in a draft plan, where it came
 * from, how confident the mapper was, and what a human reviewer decided about
 * it (advisor-intake-and-migration-workbench, WS1). One import produces one
 * `ImportProvenanceExport`; the reviewChecklist model carries the same
 * vocabulary per-item while the user is still in the wizard.
 *
 * **Stability promise:** this module is published as the
 * `@retiregolden/planner-ui/import-provenance` subpath and, unlike the wildcard
 * deep paths, is a supported API: the envelope `kind`/`version` contract, the
 * exported names, and their signatures only change with a semver-major release
 * of the package. It is deliberately browser-free — no DOM, no `crypto.subtle`
 * — so a Node process or the Pro/Advisor repo can build and read the envelope
 * without a browser. Hashing lives in the sibling `sourceHash.ts`, which is the
 * only piece that needs Web Crypto and is therefore async; the mappers that
 * fill this contract stay synchronous and pure.
 *
 * **`ImportConfidence` is deliberately NOT the insights high/medium/low
 * vocabulary.** Insights grades how strong a *finding* is; this grades how
 * faithfully a *source value* survived the trip into the plan — `'exact'` (read
 * verbatim), `'derived'` (computed from other sourced values), `'estimated'`
 * (inferred with a heuristic), `'assumed'` (a mapper default, no source), and
 * `'unmapped'` (present in the source, nothing landed). Mapping the two scales
 * onto one enum would let a UI equate "we're confident this is a problem" with
 * "we copied this number exactly", which are unrelated claims. Keep them apart.
 *
 * Format invariants callers may rely on:
 * - `parseImportProvenance` ignores unknown top-level fields, so a host may
 *   extend the envelope and the file still round-trips through this parser.
 * - The envelope NEVER embeds a raw source document. A source contributes only
 *   its file name, SHA-256, byte count, and the mapper that read it
 *   (`ImportSourceRef`); the bytes themselves stay on the user's disk. This is
 *   load-bearing, not incidental — the export is safe to hand off precisely
 *   because it carries provenance, not the 1040 PDF it describes.
 */

/**
 * Where a single imported value came from. The file name is NOT part of a
 * locator — it lives once on the `ImportSourceRef` at the session/source level,
 * so a locator stays small and a value that fuses two files points at both via
 * `derived` without repeating names. In a multi-source envelope, `sourceIndex`
 * names the entry in `ImportProvenanceExport.sources` a leaf locator addresses;
 * omitted means `sources[0]` (every single-source flow can leave it off).
 */
export type SourceLocator =
  | { kind: 'csvRow'; row: number; column?: string; sourceIndex?: number }
  | { kind: 'jsonPath'; path: string; sourceIndex?: number }
  | { kind: 'form1040'; line: string; sourceIndex?: number }
  | { kind: 'derived'; from: SourceLocator[]; note?: string }
  | { kind: 'none'; note: string }

/** A CSV-row locator; row numbers are 1-based indices into the parsed rows. */
export function csvRowLocator(row: number, column?: string): SourceLocator {
  return column ? { kind: 'csvRow', row, column } : { kind: 'csvRow', row }
}

/** A locator into a JSON export, keyed by dotted path (e.g. `accounts[2].balance`). */
export function jsonPathLocator(path: string): SourceLocator {
  return { kind: 'jsonPath', path }
}

/** A Form 1040 locator keyed by the line id (e.g. `'1a'`, `'11'`, `'header'`). */
export function form1040Locator(line: string): SourceLocator {
  return { kind: 'form1040', line }
}

/**
 * How faithfully a source value survived the trip into the draft plan. See the
 * module header for why this is intentionally distinct from the insights
 * high/medium/low scale.
 */
export type ImportConfidence = 'exact' | 'derived' | 'estimated' | 'assumed' | 'unmapped'

/**
 * A reviewer's verdict on an imported value. The free planner leaves every
 * decision `'pending'`; the Pro/Advisor workbench is what moves it to
 * `'accepted'`, `'overridden'`, or `'rejected'` later.
 */
export type DecisionState = 'pending' | 'accepted' | 'overridden' | 'rejected'

/**
 * A discriminated union so the compiler enforces what the parser checks: an
 * `overrideValue` exists exactly when the state is `'overridden'` — a typed
 * client cannot construct a decision this contract would refuse to read back.
 */
export type ReviewerDecision =
  | { state: 'pending' | 'accepted' | 'rejected'; decidedAtIso?: string; note?: string }
  | { state: 'overridden'; overrideValue: string; decidedAtIso?: string; note?: string }

/**
 * One value the import touched, with its provenance. Mirrors the two human
 * strings on `ImportReviewItem` (`source`, `detail`) so the wizard checklist and
 * the export envelope describe an item the same way, and adds the structured
 * provenance the checklist carries as optional fields. Both `mappings` and
 * `unresolved` in the envelope use this shape — an unmapped item is simply one
 * whose `confidence` is `'unmapped'` and whose `locator` is typically `none`.
 */
export interface ImportProvenanceEntry {
  /** Where in the source this came from, as a human string (file row, 1040 line). */
  source: string
  /** What happened in the draft plan — or why nothing did and what to do instead. */
  detail: string
  locator: SourceLocator
  confidence: ImportConfidence
  /**
   * Where the value landed in the draft plan, as an engine plan path
   * (`accounts[3]`, `incomes[0]`, `household.state` — the Household Map's
   * node-source convention). Present when the item maps to one addressable
   * field or record; absent for prose-only and unresolved items.
   */
  target?: string
  decision?: ReviewerDecision
}

/** A source document that fed the import — identified, never embedded. */
export interface ImportSourceRef {
  file: string
  /**
   * Lowercase hex SHA-256 of the source's raw bytes (see `sourceHash.ts`), so
   * the report can be verified against the original file. Empty string when
   * the host had no Web Crypto to hash with, or when the source is not a
   * document at all (guided form entry) — a deterministic hash of low-entropy
   * typed personal inputs would be a dictionary-attackable fingerprint, so
   * none is published. Never a wrong hash.
   */
  sha256: string
  /** Byte length of the source. */
  bytes: number
  /** The mapper that read this source (e.g. `'brokerCsv'`, `'tenForty'`). */
  mapper: string
}

export const IMPORT_PROVENANCE_KIND = 'retiregolden.import-provenance'
export const IMPORT_PROVENANCE_VERSION = 1
/** Generous cap; primarily guards against parsing the wrong (huge) file. */
export const MAX_IMPORT_PROVENANCE_JSON_CHARS = 10_000_000

/**
 * The import-provenance export envelope. Mirrors the shape of the plan-format
 * envelopes: a `kind`/`version` pair, an `exportedAtIso` stamp, the plan-schema
 * and engine versions that were current when it was written, and the payload.
 */
export interface ImportProvenanceExport {
  kind: typeof IMPORT_PROVENANCE_KIND
  version: typeof IMPORT_PROVENANCE_VERSION
  exportedAtIso: string
  planSchemaVersion: number
  engineVersion: string
  sources: ImportSourceRef[]
  /** Values that landed in the draft plan. */
  mappings: ImportProvenanceEntry[]
  /** Source values nothing was made of — the "add by hand" list. */
  unresolved: ImportProvenanceEntry[]
}

/** The caller-supplied payload; `serializeImportProvenance` stamps the rest. */
export interface ImportProvenanceInput {
  planSchemaVersion: number
  engineVersion: string
  sources: ImportSourceRef[]
  mappings: ImportProvenanceEntry[]
  unresolved: ImportProvenanceEntry[]
}

/**
 * Deepest allowed `derived.from` nesting. Real locators are one or two levels;
 * the bound exists so a hostile file cannot drive the recursive walkers into a
 * `RangeError` — past it, parse answers `malformed` and serialize throws.
 */
export const MAX_LOCATOR_DEPTH = 32

/**
 * Serialization writes ONLY the contract's fields, rebuilt object-by-object —
 * an extension field a caller left on a source or entry (worst case, one
 * carrying raw document content) is dropped, not emitted. This is what makes
 * the never-embeds-the-raw-document guarantee structural rather than advisory.
 * Relational invariants a typed caller can still violate (a leaf `sourceIndex`
 * outside `sources[]`, excessive nesting, an `'unmapped'` entry filed as a
 * mapping) make serialize THROW — emitting a file this module's own parser
 * would call malformed is a programming error, not a data condition.
 */
function cleanLocator(locator: SourceLocator, depth: number, sourceCount: number): SourceLocator {
  if (depth > MAX_LOCATOR_DEPTH) throw new Error(`locator nesting exceeds ${MAX_LOCATOR_DEPTH}`)
  if (locator.kind === 'csvRow' || locator.kind === 'jsonPath' || locator.kind === 'form1040') {
    const index = locator.sourceIndex ?? 0
    if (!Number.isInteger(index) || index < 0 || index >= sourceCount) {
      throw new Error(`locator sourceIndex ${String(locator.sourceIndex)} does not name an entry in sources[] (length ${sourceCount})`)
    }
  }
  switch (locator.kind) {
    case 'csvRow':
      // The parser refuses rows below 1 — the serializer must too, or the
      // supported API can emit a report its own consumer calls malformed.
      if (!Number.isInteger(locator.row) || locator.row < 1) {
        throw new Error(`csvRow locator row must be a 1-based integer (got ${String(locator.row)})`)
      }
      return {
        kind: 'csvRow',
        row: locator.row,
        ...(locator.column !== undefined ? { column: locator.column } : {}),
        ...(locator.sourceIndex !== undefined ? { sourceIndex: locator.sourceIndex } : {}),
      }
    case 'jsonPath':
      return { kind: 'jsonPath', path: locator.path, ...(locator.sourceIndex !== undefined ? { sourceIndex: locator.sourceIndex } : {}) }
    case 'form1040':
      return { kind: 'form1040', line: locator.line, ...(locator.sourceIndex !== undefined ? { sourceIndex: locator.sourceIndex } : {}) }
    case 'derived':
      // A derivation from nothing names no source at all — refuse it.
      if (locator.from.length === 0) throw new Error('a derived locator must name at least one source locator')
      return {
        kind: 'derived',
        from: locator.from.map((part) => cleanLocator(part, depth + 1, sourceCount)),
        ...(locator.note !== undefined ? { note: locator.note } : {}),
      }
    case 'none':
      return { kind: 'none', note: locator.note }
  }
}

function cleanEntry(entry: ImportProvenanceEntry, sourceCount: number, collection: 'mappings' | 'unresolved'): ImportProvenanceEntry {
  // `unmapped` means "nothing landed" — an entry graded that way belongs in
  // `unresolved`, every unresolved entry must be graded that way, and a value
  // that never landed cannot claim a plan destination.
  if ((entry.confidence === 'unmapped') !== (collection === 'unresolved')) {
    throw new Error(`a '${entry.confidence}' entry cannot be filed under '${collection}'`)
  }
  if (collection === 'unresolved' && entry.target !== undefined) {
    throw new Error(`an unresolved entry cannot carry a target (got '${entry.target}')`)
  }
  return {
    source: entry.source,
    detail: entry.detail,
    locator: cleanLocator(entry.locator, 0, sourceCount),
    confidence: entry.confidence,
    ...(entry.target !== undefined ? { target: entry.target } : {}),
    ...(entry.decision !== undefined ? { decision: cleanDecision(entry.decision) } : {}),
  }
}

function cleanDecision(decision: ReviewerDecision): ReviewerDecision {
  const shared = {
    ...(decision.decidedAtIso !== undefined ? { decidedAtIso: decision.decidedAtIso } : {}),
    ...(decision.note !== undefined ? { note: decision.note } : {}),
  }
  return decision.state === 'overridden'
    ? { state: 'overridden', overrideValue: decision.overrideValue, ...shared }
    : { state: decision.state, ...shared }
}

function cleanSourceRef(source: ImportSourceRef): ImportSourceRef {
  // Same constraints the parser enforces — the supported API must not emit a
  // source identity its own consumer calls malformed.
  if (!SHA256_RE.test(source.sha256)) {
    throw new Error(`source sha256 must be empty or lowercase 64-hex (got '${source.sha256.slice(0, 24)}')`)
  }
  if (!Number.isInteger(source.bytes) || source.bytes < 0) {
    throw new Error(`source bytes must be a non-negative integer (got ${String(source.bytes)})`)
  }
  return { file: source.file, sha256: source.sha256, bytes: source.bytes, mapper: source.mapper }
}

export function serializeImportProvenance(
  input: ImportProvenanceInput,
  now: () => Date = () => new Date(),
): string {
  const envelope: ImportProvenanceExport = {
    kind: IMPORT_PROVENANCE_KIND,
    version: IMPORT_PROVENANCE_VERSION,
    exportedAtIso: now().toISOString(),
    planSchemaVersion: input.planSchemaVersion,
    engineVersion: input.engineVersion,
    sources: input.sources.map(cleanSourceRef),
    mappings: input.mappings.map((entry) => cleanEntry(entry, input.sources.length, 'mappings')),
    unresolved: input.unresolved.map((entry) => cleanEntry(entry, input.sources.length, 'unresolved')),
  }
  const json = JSON.stringify(envelope, null, 2)
  // Never emit what the parser refuses: a report past the parse cap would be
  // unreadable by this contract's own consumer.
  if (json.length > MAX_IMPORT_PROVENANCE_JSON_CHARS) {
    throw new Error(`serialized import provenance exceeds ${MAX_IMPORT_PROVENANCE_JSON_CHARS} characters`)
  }
  return json
}

export type ParseImportProvenanceResult =
  | { ok: true; provenance: ImportProvenanceExport }
  | { ok: false; reason: 'too_large' | 'not_json' | 'wrong_kind' | 'unsupported_version' | 'malformed' }

const CONFIDENCE_VALUES: readonly string[] = ['exact', 'derived', 'estimated', 'assumed', 'unmapped']
const DECISION_STATES: readonly string[] = ['pending', 'accepted', 'overridden', 'rejected']
/** Empty (host without Web Crypto) or lowercase 64-hex — the documented contract. */
const SHA256_RE = /^([0-9a-f]{64})?$/

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function optionalString(value: unknown): { ok: boolean; value?: string } {
  if (value === undefined) return { ok: true }
  return typeof value === 'string' ? { ok: true, value } : { ok: false }
}

// The parsers below rebuild every object from its checked fields — a foreign
// file's extension fields are dropped, invalid shapes fail the whole parse.

function parseLeafSourceIndex(value: unknown, sourceCount: number): { ok: boolean; value?: number } {
  // An omitted index means `sources[0]`, so even the default demands a source —
  // a leaf locator in an envelope with an empty `sources[]` dangles.
  if (value === undefined) return sourceCount > 0 ? { ok: true } : { ok: false }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= sourceCount) return { ok: false }
  return { ok: true, value }
}

function parseLocator(value: unknown, sourceCount: number, depth: number): SourceLocator | null {
  if (depth > MAX_LOCATOR_DEPTH) return null
  const rec = asRecord(value)
  if (!rec) return null
  const sourceIndex = parseLeafSourceIndex(rec['sourceIndex'], sourceCount)
  const withIndex = sourceIndex.value !== undefined ? { sourceIndex: sourceIndex.value } : {}
  switch (rec['kind']) {
    case 'csvRow': {
      const column = optionalString(rec['column'])
      const row = rec['row']
      if (typeof row !== 'number' || !Number.isInteger(row) || row < 1 || !column.ok || !sourceIndex.ok) return null
      return { kind: 'csvRow', row, ...(column.value !== undefined ? { column: column.value } : {}), ...withIndex }
    }
    case 'jsonPath':
      if (typeof rec['path'] !== 'string' || !sourceIndex.ok) return null
      return { kind: 'jsonPath', path: rec['path'], ...withIndex }
    case 'form1040':
      if (typeof rec['line'] !== 'string' || !sourceIndex.ok) return null
      return { kind: 'form1040', line: rec['line'], ...withIndex }
    case 'derived': {
      const note = optionalString(rec['note'])
      if (!Array.isArray(rec['from']) || rec['from'].length === 0 || !note.ok) return null
      const from: SourceLocator[] = []
      for (const part of rec['from'] as unknown[]) {
        const parsed = parseLocator(part, sourceCount, depth + 1)
        if (parsed === null) return null
        from.push(parsed)
      }
      return { kind: 'derived', from, ...(note.value !== undefined ? { note: note.value } : {}) }
    }
    case 'none':
      if (typeof rec['note'] !== 'string') return null
      return { kind: 'none', note: rec['note'] }
    default:
      return null
  }
}

function parseSourceRef(value: unknown): ImportSourceRef | null {
  const rec = asRecord(value)
  if (!rec) return null
  if (typeof rec['file'] !== 'string') return null
  if (typeof rec['sha256'] !== 'string' || !SHA256_RE.test(rec['sha256'])) return null
  if (typeof rec['bytes'] !== 'number' || !Number.isInteger(rec['bytes']) || rec['bytes'] < 0) return null
  if (typeof rec['mapper'] !== 'string') return null
  return { file: rec['file'], sha256: rec['sha256'], bytes: rec['bytes'], mapper: rec['mapper'] }
}

function parseDecision(value: unknown): { ok: boolean; value?: ReviewerDecision } {
  if (value === undefined) return { ok: true }
  const rec = asRecord(value)
  if (!rec) return { ok: false }
  const state = rec['state']
  if (typeof state !== 'string' || !DECISION_STATES.includes(state)) return { ok: false }
  const overrideValue = optionalString(rec['overrideValue'])
  const decidedAtIso = optionalString(rec['decidedAtIso'])
  const note = optionalString(rec['note'])
  if (!overrideValue.ok || !decidedAtIso.ok || !note.ok) return { ok: false }
  // `overrideValue` exists exactly when the state is `overridden` — otherwise a
  // workbench either has no replacement to apply or an ambiguous stray one.
  if ((state === 'overridden') !== (overrideValue.value !== undefined)) return { ok: false }
  const shared = {
    ...(decidedAtIso.value !== undefined ? { decidedAtIso: decidedAtIso.value } : {}),
    ...(note.value !== undefined ? { note: note.value } : {}),
  }
  return {
    ok: true,
    value:
      state === 'overridden'
        ? { state, overrideValue: overrideValue.value!, ...shared }
        : { state: state as 'pending' | 'accepted' | 'rejected', ...shared },
  }
}

function parseEntry(value: unknown, sourceCount: number, collection: 'mappings' | 'unresolved'): ImportProvenanceEntry | null {
  const rec = asRecord(value)
  if (!rec) return null
  if (typeof rec['source'] !== 'string' || typeof rec['detail'] !== 'string') return null
  const locator = parseLocator(rec['locator'], sourceCount, 0)
  if (locator === null) return null
  const confidence = rec['confidence']
  if (typeof confidence !== 'string' || !CONFIDENCE_VALUES.includes(confidence)) return null
  // `unmapped` means "nothing landed": it belongs in `unresolved` and is the
  // only grade that does — a misfiled entry is malformed, not reinterpreted.
  if ((confidence === 'unmapped') !== (collection === 'unresolved')) return null
  const target = optionalString(rec['target'])
  const decision = parseDecision(rec['decision'])
  if (!target.ok || !decision.ok) return null
  // A value that never landed cannot claim a plan destination.
  if (collection === 'unresolved' && target.value !== undefined) return null
  return {
    source: rec['source'],
    detail: rec['detail'],
    locator,
    confidence: confidence as ImportConfidence,
    ...(target.value !== undefined ? { target: target.value } : {}),
    ...(decision.value !== undefined ? { decision: decision.value } : {}),
  }
}

function parseAll<T>(value: unknown, parseOne: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null
  const parsed: T[] = []
  for (const entry of value) {
    const one = parseOne(entry)
    if (one === null) return null
    parsed.push(one)
  }
  return parsed
}

export function parseImportProvenance(json: string): ParseImportProvenanceResult {
  if (json.length > MAX_IMPORT_PROVENANCE_JSON_CHARS) return { ok: false, reason: 'too_large' }

  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'not_json' }
  }
  const env = asRecord(raw)
  if (!env) return { ok: false, reason: 'wrong_kind' }
  if (env['kind'] !== IMPORT_PROVENANCE_KIND) return { ok: false, reason: 'wrong_kind' }
  if (env['version'] !== IMPORT_PROVENANCE_VERSION) return { ok: false, reason: 'unsupported_version' }

  // Every element the type promises is checked before the typed result exists —
  // a hand-edited or foreign file must fail here, not in a consumer's
  // dereference. Unknown top-level keys stay tolerated (dropped, not an error);
  // sources parse first so leaf `sourceIndex` values can be bounds-checked.
  // A real ISO-8601 timestamp, not merely anything Date.parse recognizes —
  // downstream ordering/display must not depend on locale-format leniency.
  const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
  if (
    typeof env['exportedAtIso'] !== 'string' ||
    !ISO_RE.test(env['exportedAtIso']) ||
    Number.isNaN(Date.parse(env['exportedAtIso']))
  ) {
    return { ok: false, reason: 'malformed' }
  }
  if (
    typeof env['planSchemaVersion'] !== 'number' ||
    !Number.isInteger(env['planSchemaVersion']) ||
    env['planSchemaVersion'] < 0
  ) {
    return { ok: false, reason: 'malformed' }
  }
  if (typeof env['engineVersion'] !== 'string') return { ok: false, reason: 'malformed' }
  const sources = parseAll(env['sources'], parseSourceRef)
  if (sources === null) return { ok: false, reason: 'malformed' }
  const mappings = parseAll(env['mappings'], (entry) => parseEntry(entry, sources.length, 'mappings'))
  const unresolved = parseAll(env['unresolved'], (entry) => parseEntry(entry, sources.length, 'unresolved'))
  if (mappings === null || unresolved === null) return { ok: false, reason: 'malformed' }

  return {
    ok: true,
    provenance: {
      kind: IMPORT_PROVENANCE_KIND,
      version: IMPORT_PROVENANCE_VERSION,
      exportedAtIso: env['exportedAtIso'],
      planSchemaVersion: env['planSchemaVersion'],
      engineVersion: env['engineVersion'],
      sources,
      mappings,
      unresolved,
    },
  }
}

/** A short, human-readable rendering of a locator for display and debug logs. */
export function describeSourceLocator(locator: SourceLocator): string {
  // In a multi-source envelope the index is the only thing separating row 12
  // of one file from row 12 of another — render it whenever it is present.
  const inSource = 'sourceIndex' in locator && locator.sourceIndex !== undefined ? ` (source ${locator.sourceIndex})` : ''
  switch (locator.kind) {
    case 'csvRow':
      return (locator.column ? `CSV row ${locator.row}, column ${locator.column}` : `CSV row ${locator.row}`) + inSource
    case 'jsonPath':
      return `JSON ${locator.path}${inSource}`
    case 'form1040':
      return `Form 1040 line ${locator.line}${inSource}`
    case 'derived': {
      const parts = locator.from.map(describeSourceLocator).join(', ')
      return locator.note ? `derived from ${parts} (${locator.note})` : `derived from ${parts}`
    }
    case 'none':
      return locator.note
  }
}
