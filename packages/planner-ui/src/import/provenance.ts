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
 * `derived` without repeating names.
 */
export type SourceLocator =
  | { kind: 'csvRow'; row: number; column?: string }
  | { kind: 'jsonPath'; path: string }
  | { kind: 'form1040'; line: string }
  | { kind: 'derived'; from: SourceLocator[]; note?: string }
  | { kind: 'none'; note: string }

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

export interface ReviewerDecision {
  state: DecisionState
  /** Present only when `state === 'overridden'`: the value the reviewer chose instead. */
  overrideValue?: string
  decidedAtIso?: string
  note?: string
}

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
  decision?: ReviewerDecision
}

/** A source document that fed the import — identified, never embedded. */
export interface ImportSourceRef {
  file: string
  /** Lowercase hex SHA-256 of the source bytes (see `sourceHash.ts`). */
  sha256: string
  /** UTF-8 byte length of the source. */
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
    sources: input.sources,
    mappings: input.mappings,
    unresolved: input.unresolved,
  }
  return JSON.stringify(envelope, null, 2)
}

export type ParseImportProvenanceResult =
  | { ok: true; provenance: ImportProvenanceExport }
  | { ok: false; reason: 'too_large' | 'not_json' | 'wrong_kind' | 'unsupported_version' }

export function parseImportProvenance(json: string): ParseImportProvenanceResult {
  if (json.length > MAX_IMPORT_PROVENANCE_JSON_CHARS) return { ok: false, reason: 'too_large' }

  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'not_json' }
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'wrong_kind' }
  const env = raw as {
    kind?: string
    version?: number
    exportedAtIso?: unknown
    planSchemaVersion?: unknown
    engineVersion?: unknown
    sources?: unknown
    mappings?: unknown
    unresolved?: unknown
  }
  if (env.kind !== IMPORT_PROVENANCE_KIND) return { ok: false, reason: 'wrong_kind' }
  if (env.version !== IMPORT_PROVENANCE_VERSION) return { ok: false, reason: 'unsupported_version' }

  // Reconstruct the known fields only — this both drops unknown top-level keys
  // and tolerates them (their presence is not an error).
  const provenance: ImportProvenanceExport = {
    kind: IMPORT_PROVENANCE_KIND,
    version: IMPORT_PROVENANCE_VERSION,
    exportedAtIso: typeof env.exportedAtIso === 'string' ? env.exportedAtIso : '',
    planSchemaVersion: typeof env.planSchemaVersion === 'number' ? env.planSchemaVersion : 0,
    engineVersion: typeof env.engineVersion === 'string' ? env.engineVersion : '',
    sources: Array.isArray(env.sources) ? (env.sources as ImportSourceRef[]) : [],
    mappings: Array.isArray(env.mappings) ? (env.mappings as ImportProvenanceEntry[]) : [],
    unresolved: Array.isArray(env.unresolved) ? (env.unresolved as ImportProvenanceEntry[]) : [],
  }
  return { ok: true, provenance }
}

/** A short, human-readable rendering of a locator for display and debug logs. */
export function describeSourceLocator(locator: SourceLocator): string {
  switch (locator.kind) {
    case 'csvRow':
      return locator.column ? `CSV row ${locator.row}, column ${locator.column}` : `CSV row ${locator.row}`
    case 'jsonPath':
      return `JSON ${locator.path}`
    case 'form1040':
      return `Form 1040 line ${locator.line}`
    case 'derived': {
      const parts = locator.from.map(describeSourceLocator).join(', ')
      return locator.note ? `derived from ${parts} (${locator.note})` : `derived from ${parts}`
    }
    case 'none':
      return locator.note
  }
}
