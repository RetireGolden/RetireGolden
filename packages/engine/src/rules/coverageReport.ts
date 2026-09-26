import type { ApproximationEntry, ApproximationKind } from './approximationKinds.js'
import type {
  CoverageAttestation,
  CoverageAttestationStatus,
  COVERAGE_ATTESTATIONS,
} from './coverageAttestations.js'
import {
  mutationReceiptPathOf,
  type CalculationFormula,
  type CalculationRecord,
} from './calculationRegistry.js'
import type { OutputFamily } from './outputFamilies.js'
import type {
  TAX_RULE_REGISTRY,
  TaxRuleAuthority,
  TaxRuleClassification,
  TaxRuleErrorDirection,
  TaxRuleId,
  TaxRuleJurisdiction,
  TaxRuleVolatility,
} from './taxRuleRegistry.js'

export interface CoverageReportInput {
  readonly registry: typeof TAX_RULE_REGISTRY
  readonly attestations: typeof COVERAGE_ATTESTATIONS
  readonly baselineUnswept: readonly string[]
  /** Test-source contents keyed by path, for the describeRule fixture scan. */
  readonly testSources: Readonly<Record<string, string>>
  /** Committed quote-fidelity ledger JSON text, or null when none exists yet. */
  readonly quoteFidelityLedger: string | null
  /** Due-date derivation — inject taxRuleDueOn from the registry module; one home for the arithmetic. */
  readonly dueOnFor: (ruleId: TaxRuleId) => string
  /**
   * 1-based declaration line of a pinned `path#symbol`, injected so this
   * module stays browser-pure (the AST walk lives in symbolLines.ts, which
   * imports the typescript package). Conformance guarantees every pin
   * resolves, so callers throw rather than return a sentinel on a miss.
   */
  readonly symbolLineFor: (path: string, symbol: string) => number
  /**
   * The record modules the registry is composed from — inject
   * `TAX_RULE_RECORD_MODULES`. This is the ledger's shard boundary, chosen to
   * be exactly the dispatch tooling's contention unit: a re-verification that
   * edits `records/statesWest.ts` rewrites `rule-coverage/statesWest.json` and
   * nothing else, so two dispatches in different domains stop colliding.
   */
  readonly recordModules: readonly (readonly [string, Readonly<Record<string, unknown>>])[]
  /**
   * The kind of every approximated rule, keyed by rule id: inject
   * `APPROXIMATION_KINDS` from approximationKinds.ts. The builder refuses an
   * approximated rule with no entry, and an entry for a rule the registry does
   * not classify `approximated`, so a published kind can neither go missing
   * nor outlive a reclassification.
   */
  readonly approximationKinds: Readonly<Record<string, ApproximationEntry>>
}

/**
 * An approximated rule's published kind: its approximationKinds.ts entry,
 * copied field by field. A fix carries nothing but its kind, because where the
 * fix goes is the rule's own `implementations`, already published with their
 * declaration lines.
 */
export type CoverageApproximation =
  | { readonly kind: 'fix' }
  | { readonly kind: 'needs-fact'; readonly missingInput: string }
  | { readonly kind: 'convention'; readonly reason: string }

export interface CoverageRule {
  readonly id: string
  readonly title: string
  readonly classification: TaxRuleClassification
  readonly errorDirection: TaxRuleErrorDirection | null
  /** Null exactly when the rule is not approximated, like errorDirection. */
  readonly approximation: CoverageApproximation | null
  /** The registry's publication rule: a convention-derived choice must be disclosed wherever the rule is published. */
  readonly conventionRationale: string | null
  readonly contraryReading: string | null
  readonly jurisdiction: TaxRuleJurisdiction
  readonly volatility: TaxRuleVolatility
  readonly effectiveFrom: number
  readonly effectiveThrough: number | null
  readonly verifiedOn: string
  readonly dueOn: string
  readonly implementedBy: readonly string[]
  /**
   * implementedBy joined with the record's declared operative symbols: one
   * entry per implementing file, each carrying at least one function pin with
   * the 1-based line of its declaration for deep links. Conformance resolves
   * every pin through symbolAnchorLine's two-tier rule (module scope wins; a
   * member at any nesting depth resolves only when unique, else the pin is
   * ancestor-qualified like ND.capitalGainsTaxablePct), so a moved, deleted,
   * or newly ambiguous symbol regenerates or fails the build instead of
   * rotting into a dead or wrong anchor.
   */
  readonly implementations: readonly {
    readonly path: string
    readonly functions: readonly {
      readonly name: string
      readonly line: number
    }[]
  }[]
  readonly fixtureFiles: readonly string[]
  /**
   * One entry per describeRule call: where the fixture lives (1-based line of
   * the call) and the it() tests inside its block, each with its own 1-based
   * line for deep links. Derived from the same source scan as fixtureFiles;
   * nothing here is hand-maintained.
   */
  readonly fixtures: readonly {
    readonly path: string
    readonly line: number
    readonly note: string | null
    readonly tests: readonly {
      readonly title: string
      readonly line: number
    }[]
  }[]
  /**
   * `describeRefusal` fixture files for a `typedRefusal` `outOfScope` rule —
   * empty for every other classification, and for an `inexpressibleInput`
   * rule, which has no refusal to drive. Scanned separately from
   * `fixtureFiles`/`fixtures`: those two track `describeRule` blocks only, so
   * a rule covered by a refusal fixture instead would otherwise publish an
   * empty fixture list and read as unfixtured.
   */
  readonly refusalFixtureFiles: readonly string[]
  /** Same shape as `fixtures`, one entry per `describeRefusal` call. */
  readonly refusalFixtures: readonly {
    readonly path: string
    readonly line: number
    readonly note: string | null
    readonly tests: readonly {
      readonly title: string
      readonly line: number
    }[]
  }[]
  readonly authorities: readonly {
    readonly kind: TaxRuleAuthority['kind']
    readonly citation: TaxRuleAuthority['citation']
    readonly url: TaxRuleAuthority['url']
  }[]
}

interface DirectoryRollup {
  readonly directory: string
  readonly files: number
  readonly byStatus: Readonly<Record<string, number>>
}

interface QuoteFidelitySummary {
  readonly generatedAt: string
  readonly entryCount: number
  readonly fetched: number | null
  readonly cached: number | null
  readonly counts: Readonly<Record<string, number>>
  /**
   * Entries verified individually after the run that `generatedAt` names,
   * each with its date and a reason, so the ledger never passes a merged
   * entry off as part of that run. Empty when the ledger is one run's output.
   */
  readonly amendments: readonly {
    readonly on: string
    readonly note: string
    readonly entries: readonly { readonly id: string; readonly citation: string }[]
  }[]
}

// Mirrors verify-quotes.mjs's non-zero-exit set (its exported `SERIOUS`).
// quoteVerdicts.test.ts asserts the two are equal, so they cannot drift.
export const QUOTE_FIDELITY_SERIOUS_VERDICTS = ['ABSENT', 'TRUNCATED', 'ELISION-BROKEN', 'UNFETCHABLE'] as const
const QUOTE_FIDELITY_ADVISORY_VERDICTS = ['PUNCTUATION', 'ELISION-PUNCTUATION', 'PDF-NOT-VERIFIABLE'] as const

/** One shard's entry in the index: where to read it and how many rules it holds. */
export interface CoverageShardEntry {
  /** Record-module basename, e.g. `statesWest`. */
  readonly module: string
  /** Path relative to the index file's own directory. */
  readonly path: string
  readonly ruleCount: number
}

/** A shard file's parsed contents: the per-rule payloads for one record module. */
export interface CoverageShard {
  readonly kind: 'retiregolden.rules-coverage.shard'
  readonly version: 5
  readonly module: string
  readonly rules: readonly CoverageRule[]
}

export interface CoverageReportManifest {
  readonly kind: 'retiregolden.rules-coverage.manifest'
  readonly version: 5
  readonly registry: {
    readonly total: number
    readonly byClassification: Readonly<Record<string, number>>
    /**
     * The approximated rules counted by kind. Every kind is present, at zero
     * when none is left, and the three sum to byClassification.approximated.
     */
    readonly approximatedByKind: Readonly<Record<ApproximationKind, number>>
    readonly byVolatility: Readonly<Record<string, number>>
    readonly byJurisdiction: {
      readonly federal: number
      readonly states: Readonly<Record<string, number>>
      readonly stateTotal: number
    }
  }
  readonly attestations: {
    readonly totalFiles: number
    readonly byStatus: Readonly<Record<string, number>>
    readonly sweptPct: number
    readonly grandfathered: number
  }
  readonly unswept: readonly string[]
  readonly partial: readonly {
    readonly path: string
    readonly sweptOn: string | null
    readonly note: string | null
  }[]
  readonly directoryRollup: readonly DirectoryRollup[]
  /**
   * Where the per-rule payloads live, one entry per record module, sorted by
   * module name. The index carries no `rules` array of its own: that is the
   * whole point of the split, since `verifiedOn`/`dueOn` churn then lands in
   * one shard instead of rewriting a 30k-line file on every dispatch.
   */
  readonly shards: readonly CoverageShardEntry[]
  readonly quoteFidelity: QuoteFidelitySummary | { readonly status: 'no-committed-ledger' }
}

/** A shard as the generator hands it to the writer: name, path, serialized text. */
export interface CoverageReportShard {
  readonly module: string
  /** Path relative to the index file's own directory. */
  readonly path: string
  readonly shard: CoverageShard
  readonly json: string
}

export interface CoverageReport {
  readonly manifest: CoverageReportManifest
  /** Every rule, sorted by id — the union of the shards, for in-process consumers. */
  readonly rules: readonly CoverageRule[]
  readonly markdown: string
  /** The index JSON (`rule-coverage.json`). */
  readonly json: string
  readonly shards: readonly CoverageReportShard[]
}

const CONFORMANCE_SOURCE = 'taxRuleRegistry.conformance.test.ts'
const STATE_PREFIX = 'state:'

/**
 * Directory holding the per-record-module shards, relative to the index file
 * (`DOCS/operations/rule-coverage.json` → `DOCS/operations/rule-coverage/`).
 */
const COVERAGE_SHARD_DIRECTORY = 'rule-coverage'

/** Shard file name for a record module, so writers and readers cannot disagree. */
export function coverageShardPath(moduleName: string): string {
  return COVERAGE_SHARD_DIRECTORY + '/' + moduleName + '.json'
}

/** Committed artifacts must sort identically on every machine, so no locale-aware collation. */
const compareStrings = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => compareStrings(left, right)))
}

/**
 * Lexes `source` from `index`, returning the index just past the current
 * non-code region when one starts here: a line or block comment, a string or
 * template literal (with ${} nesting), or a regex literal when `regexOk` says
 * a regex may start in this position. Returns `index` unchanged otherwise.
 */
function skipNonCode(source: string, index: number, regexOk: boolean): number {
  const char = source[index]!
  const next = source[index + 1]
  if (char === '/' && next === '/') {
    const eol = source.indexOf('\n', index)
    return eol === -1 ? source.length : eol + 1
  }
  if (char === '/' && next === '*') {
    const close = source.indexOf('*/', index + 2)
    return close === -1 ? source.length : close + 2
  }
  if (char === "'" || char === '"') {
    let cursor = index + 1
    while (cursor < source.length && source[cursor] !== char) {
      cursor += source[cursor] === '\\' ? 2 : 1
    }
    return cursor + 1
  }
  if (char === '`') {
    let cursor = index + 1
    let templateDepth = 0
    while (cursor < source.length) {
      const c = source[cursor]!
      if (c === '\\') {
        cursor += 2
        continue
      }
      if (c === '$' && source[cursor + 1] === '{') {
        templateDepth += 1
        cursor += 2
        continue
      }
      if (c === '}' && templateDepth > 0) {
        templateDepth -= 1
        cursor += 1
        continue
      }
      if (c === '`' && templateDepth === 0) return cursor + 1
      cursor += 1
    }
    return source.length
  }
  if (char === '/' && regexOk) {
    let cursor = index + 1
    let inClass = false
    while (cursor < source.length) {
      const c = source[cursor]!
      if (c === '\\') {
        cursor += 2
        continue
      }
      if (c === '[') inClass = true
      else if (c === ']') inClass = false
      else if (c === '/' && !inClass) return cursor + 1
      else if (c === '\n') return cursor // not a regex after all; bail at EOL
      cursor += 1
    }
    return source.length
  }
  return index
}

/** A regex literal can start wherever an expression can. */
function regexCanFollow(source: string, index: number): boolean {
  let cursor = index - 1
  while (cursor >= 0 && (source[cursor] === ' ' || source[cursor] === '\t' || source[cursor] === '\n' || source[cursor] === '\r')) {
    cursor -= 1
  }
  if (cursor < 0) return true
  return '(,=:;!&|?{['.includes(source[cursor]!)
}

/**
 * Index just past the closing parenthesis of the describeRule(...) call that
 * starts at `start`, honoring strings, templates, comments, and regex
 * literals so punctuation inside them cannot derail the extent.
 */
export function describeRuleCallEnd(source: string, start: number): number {
  const open = source.indexOf('(', start)
  if (open === -1) return source.length
  let depth = 0
  let index = open
  while (index < source.length) {
    const skipped = skipNonCode(source, index, regexCanFollow(source, index))
    if (skipped !== index) {
      index = skipped
      continue
    }
    const char = source[index]!
    if (char === '(') depth += 1
    if (char === ')') {
      depth -= 1
      if (depth === 0) return index + 1
    }
    index += 1
  }
  return source.length
}

/** Reads the string literal starting at *index* (any quote); null for substitution templates. */
function readStringLiteral(source: string, index: number, end: number): string | null {
  const quote = source[index]!
  if (quote !== "'" && quote !== '"' && quote !== '`') return null
  let cursor = index + 1
  let value = ''
  while (cursor < end) {
    const c = source[cursor]!
    if (c === '\\') {
      value += source[cursor + 1] ?? ''
      cursor += 2
      continue
    }
    if (c === quote) return value
    if (quote === '`' && c === '$' && source[cursor + 1] === '{') return null
    value += c
    cursor += 1
  }
  return null
}

/**
 * The spec's note within the call extent, found at CODE level so a note-like
 * sequence inside a comment, title, or other string never wins, and all three
 * quote forms are read.
 */
function noteWithin(source: string, start: number, end: number): string | null {
  let index = start
  while (index < end) {
    const skipped = skipNonCode(source, index, regexCanFollow(source, index))
    if (skipped !== index) {
      index = Math.min(skipped, end)
      continue
    }
    if (source.startsWith('note', index) && (index === 0 || !/[\w$.]/u.test(source[index - 1]!))) {
      let cursor = index + 4
      while (cursor < end && (source[cursor] === ' ' || source[cursor] === '\t')) cursor += 1
      if (source[cursor] === ':') {
        cursor += 1
        while (
          cursor < end &&
          (source[cursor] === ' ' || source[cursor] === '\t' || source[cursor] === '\n' || source[cursor] === '\r')
        ) {
          cursor += 1
        }
        return readStringLiteral(source, cursor, end)
      }
    }
    index += 1
  }
  return null
}

/**
 * it() tests at CODE level within [start, end) — an it('...') spelled inside
 * a comment or another string never counts. Plain single, double, and
 * substitution-free backtick titles are all captured, each with the 1-based
 * line of its it( token so the published manifest can deep-link to the test.
 */
function testsBetween(
  source: string,
  start: number,
  end: number,
  newlines: readonly number[],
  // Also accept the `test(` spelling, for suites outside the fixture helpers
  // (the walkthrough census) that may use either name.
  includeTestAlias = false,
): { title: string; line: number }[] {
  const tests: { title: string; line: number }[] = []
  let index = start
  while (index < end) {
    const skipped = skipNonCode(source, index, regexCanFollow(source, index))
    if (skipped !== index) {
      index = Math.min(skipped, end)
      continue
    }
    const window = source.slice(index, Math.min(index + 64, end))
    // Two literal patterns rather than one built at runtime, for the same
    // static-analysis reason as CALL_PATTERNS below.
    const match = includeTestAlias
      ? /^\b(?:it|test)\(\s*(['"\u0060])/u.exec(window)
      : /^\bit\(\s*(['"\u0060])/u.exec(window)
    if (match !== null && (index === 0 || !/[\w$.]/u.test(source[index - 1]!))) {
      const quote = match[1]!
      const titleStart = index + match[0].length
      let cursor = titleStart
      let title = ''
      let broken = false
      while (cursor < end) {
        const c = source[cursor]!
        if (c === '\\') {
          title += source[cursor + 1] ?? ''
          cursor += 2
          continue
        }
        if (c === quote) break
        if (quote === '\u0060' && c === '$' && source[cursor + 1] === '{') {
          broken = true // substitution titles are not literal; skip them
          break
        }
        title += c
        cursor += 1
      }
      if (!broken) tests.push({ title, line: lineAt(newlines, index) })
      index = cursor + 1
      continue
    }
    index += 1
  }
  return tests
}

interface FixtureDetail {
  readonly path: string
  readonly line: number
  readonly note: string | null
  readonly tests: readonly { readonly title: string; readonly line: number }[]
}

/** Newline offsets, computed once per file so line lookups during the scan stay O(log n). */
function newlineOffsets(source: string): readonly number[] {
  const offsets: number[] = []
  for (let index = source.indexOf('\n'); index !== -1; index = source.indexOf('\n', index + 1)) {
    offsets.push(index)
  }
  return offsets
}

/** 1-based line containing `position`: count of newlines strictly before it, plus one. */
function lineAt(newlines: readonly number[], position: number): number {
  let low = 0
  let high = newlines.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (newlines[mid]! < position) low = mid + 1
    else high = mid
  }
  return low + 1
}

/**
 * Scans `testSources` for `describeRule(<id>`, `describeRefusal(<id>`, or
 * `describeCalculation(<id>` blocks, keyed by record id — the three helpers
 * make different claims and are published in separate places (`fixtures`,
 * `refusalFixtures`, and the calculation shards' `fixtureFiles`), but the
 * source-level shape of a call (an id string literal, then a balanced extent
 * with it() tests inside) is identical for all of them, so one scan serves
 * any of the three names.
 */
// Three hardcoded patterns rather than one built from `callName` at runtime:
// a RegExp built from a variable reads to static analysis (Semgrep's
// detect-non-literal-regexp) as attacker-controlled input, even though this
// one is a closed three-member union. Literal patterns sidestep the warning
// instead of arguing with it.
const CALL_PATTERNS = {
  describeRule: /describeRule\(\s*'([^']+)'/gu,
  describeRefusal: /describeRefusal\(\s*'([^']+)'/gu,
  describeCalculation: /describeCalculation\(\s*'([^']+)'/gu,
} as const

function detailsByRule(
  testSources: Readonly<Record<string, string>>,
  callName: keyof typeof CALL_PATTERNS,
): ReadonlyMap<string, readonly FixtureDetail[]> {
  const callPattern = CALL_PATTERNS[callName]
  const details = new Map<string, FixtureDetail[]>()
  for (const [path, source] of Object.entries(testSources)) {
    if (path.endsWith(CONFORMANCE_SOURCE)) continue
    // Vite emits same-directory glob keys as `./name`, not `../rules/name`.
    const fixturePath = path
      .replace(/^\.\.\//u, 'packages/engine/src/')
      .replace(/^\.\//u, 'packages/engine/src/rules/')
    const calls = [...source.matchAll(callPattern)]
    const newlines = calls.length > 0 ? newlineOffsets(source) : []
    for (let index = 0; index < calls.length; index += 1) {
      const match = calls[index]!
      const ruleId = match[1]!
      const start = match.index ?? 0
      // The block is the describeRule CALL's balanced extent, not a slice to
      // the next call: it() titles that follow the callback's close in the
      // same file belong to sibling suites, never to this rule.
      const end = describeRuleCallEnd(source, start)
      const tests = testsBetween(source, start, end, newlines)
      const note = noteWithin(source, start, end)
      const line = lineAt(newlines, start)
      const list = details.get(ruleId) ?? []
      list.push({
        path: fixturePath,
        line,
        note,
        tests,
      })
      details.set(ruleId, list)
    }
  }
  return new Map(
    [...details.entries()]
      .map(
        ([ruleId, list]) =>
          [ruleId, [...list].sort((left, right) => compareStrings(left.path, right.path) || left.line - right.line)] as const,
      )
      .sort(([left], [right]) => compareStrings(left, right)),
  )
}

function directoryRollup(attestations: Readonly<Record<string, CoverageAttestation>>): readonly DirectoryRollup[] {
  const filesByDirectory = new Map<string, CoverageAttestation[]>()
  for (const [path, attestation] of Object.entries(attestations)) {
    const directory = path.includes('/') ? path.split('/')[0]! : '(root)'
    const files = filesByDirectory.get(directory) ?? []
    files.push(attestation)
    filesByDirectory.set(directory, files)
  }
  return [...filesByDirectory.entries()]
    .map(([directory, files]) => ({
      directory,
      files: files.length,
      byStatus: countBy(files.map(({ status }) => status)),
    }))
    .sort((left, right) => compareStrings(left.directory, right.directory))
}

function dedupeAuthorityIdentities(
  authority: readonly { kind: TaxRuleAuthority['kind']; citation: string; url: string; quotedText: string }[],
): CoverageRule['authorities'] {
  const seen = new Set<string>()
  const identities: { kind: TaxRuleAuthority['kind']; citation: string; url: string }[] = []
  for (const { kind, citation, url } of authority) {
    const key = kind + '\u0000' + citation + '\u0000' + url
    if (seen.has(key)) continue
    seen.add(key)
    identities.push({ kind, citation, url })
  }
  // The registry type guarantees at least one authority per rule; a rule
  // publishing zero links would break the transparency page's contract, so an
  // empty collapse is a builder bug, not a value.
  if (identities.length === 0) throw new Error('rule published no authority identities')
  return identities
}

/**
 * A rule's published approximation kind, or null for a rule that is not
 * approximated. Fails closed both ways: an approximated rule with no entry
 * would drop off the public known-limits table, and an entry on any other rule
 * would publish a limit the engine no longer has.
 */
function publishedApproximation(
  id: string,
  classification: TaxRuleClassification,
  kinds: Readonly<Record<string, ApproximationEntry>>,
): CoverageApproximation | null {
  const entry = Object.hasOwn(kinds, id) ? kinds[id] : undefined
  if (classification !== 'approximated') {
    if (entry !== undefined) {
      throw new Error('rule ' + id + ' is classified ' + classification + ' but carries an approximation kind')
    }
    return null
  }
  if (entry === undefined) {
    throw new Error('approximated rule ' + id + ' has no approximation kind in approximationKinds.ts')
  }
  switch (entry.kind) {
    case 'fix':
      return { kind: 'fix' }
    case 'needs-fact':
      return { kind: 'needs-fact', missingInput: entry.missingInput }
    case 'convention':
      return { kind: 'convention', reason: entry.reason }
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function quoteFidelitySummary(
  ledger: string | null,
  expectedAuthorityEntries: readonly { id: string; citation: string; url: string }[],
): CoverageReportManifest['quoteFidelity'] {
  if (ledger === null) return { status: 'no-committed-ledger' }
  const parsed: unknown = JSON.parse(ledger)
  if (!isRecord(parsed) || typeof parsed.generatedAt !== 'string' || !isRecord(parsed.counts)) {
    throw new Error('quote-fidelity ledger must contain generatedAt and verdict counts')
  }
  if (typeof parsed.entryCount !== 'number' || !Number.isFinite(parsed.entryCount)) {
    throw new Error('quote-fidelity ledger must contain a finite entryCount')
  }
  if (parsed.entryCount !== expectedAuthorityEntries.length) {
    throw new Error(
      'quote-fidelity ledger does not cover the whole registry (' +
        parsed.entryCount +
        ' entries vs ' +
        expectedAuthorityEntries.length +
        ' expected; filtered run or stale ledger)',
    )
  }
  // A same-count registry edit (renamed id, swapped URL, reworded citation)
  // must not keep publishing the old run's verdicts, so the ledger's identity
  // multiset is compared entry-for-entry, not merely counted. quotedText edits
  // behind an unchanged identity are caught by the quoteSha256 conformance
  // test, which can hash; this module stays crypto-free for browser bundling.
  const identity = (entry: { id: string; citation: string; url: string }): string =>
    entry.id + '\u0000' + entry.citation + '\u0000' + entry.url
  const ledgerResults = Array.isArray(parsed.results) ? parsed.results : null
  if (ledgerResults === null) {
    throw new Error('quote-fidelity ledger must contain a results array')
  }
  const ledgerIdentities = ledgerResults
    .map((result: unknown) => {
      if (
        !isRecord(result) ||
        typeof result.id !== 'string' ||
        typeof result.citation !== 'string' ||
        typeof result.url !== 'string'
      ) {
        throw new Error('every quote-fidelity ledger result must carry id, citation, and url')
      }
      return identity({ id: result.id, citation: result.citation, url: result.url })
    })
    .sort(compareStrings)
  const expectedIdentities = expectedAuthorityEntries.map(identity).sort(compareStrings)
  for (let index = 0; index < expectedIdentities.length; index += 1) {
    if (ledgerIdentities[index] !== expectedIdentities[index]) {
      throw new Error(
        'quote-fidelity ledger is stale: authority entries changed since the run (first mismatch at sorted position ' +
          index +
          ': ledger has ' +
          JSON.stringify(ledgerIdentities[index] ?? '(missing)') +
          ', registry expects ' +
          JSON.stringify(expectedIdentities[index]) +
          '); re-run pnpm verify:quotes -- --json',
      )
    }
  }
  const counts: Record<string, number> = {}
  for (const [verdict, count] of Object.entries(parsed.counts)) {
    if (typeof count !== 'number' || !Number.isFinite(count)) {
      throw new Error('quote-fidelity verdict count for ' + verdict + ' must be finite')
    }
    counts[verdict] = count
  }
  const verdictTotal = Object.values(counts).reduce((sum, count) => sum + count, 0)
  if (verdictTotal !== parsed.entryCount) {
    throw new Error(
      'quote-fidelity verdict counts must sum to entryCount (' +
        verdictTotal +
        ' vs ' +
        parsed.entryCount +
        ')',
    )
  }
  const amendments: QuoteFidelitySummary['amendments'][number][] = []
  if (parsed.amendments !== undefined) {
    if (!Array.isArray(parsed.amendments)) throw new Error('quote-fidelity amendments must be an array')
    const resultKeys = new Set(
      ledgerResults.map((result: unknown) =>
        isRecord(result) ? String(result.id) + '\u0000' + String(result.citation) : ''),
    )
    for (const amendment of parsed.amendments as unknown[]) {
      if (
        !isRecord(amendment) ||
        typeof amendment.on !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/u.test(amendment.on) ||
        typeof amendment.note !== 'string' ||
        amendment.note.trim() === '' ||
        !Array.isArray(amendment.entries) ||
        amendment.entries.length === 0
      ) {
        throw new Error('every quote-fidelity amendment must carry an ISO date, a note and at least one entry')
      }
      const entries = (amendment.entries as unknown[]).map((entry) => {
        if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.citation !== 'string') {
          throw new Error('every quote-fidelity amendment entry must carry id and citation')
        }
        if (!resultKeys.has(entry.id + '\u0000' + entry.citation)) {
          throw new Error('quote-fidelity amendment names an entry the ledger does not hold: ' + entry.id + ' / ' + entry.citation)
        }
        return { id: entry.id, citation: entry.citation }
      })
      amendments.push({ on: amendment.on, note: amendment.note, entries })
    }
  }
  return {
    generatedAt: parsed.generatedAt,
    entryCount: parsed.entryCount,
    fetched: typeof parsed.fetched === 'number' && Number.isFinite(parsed.fetched) ? parsed.fetched : null,
    cached: typeof parsed.cached === 'number' && Number.isFinite(parsed.cached) ? parsed.cached : null,
    counts: Object.fromEntries(Object.entries(counts).sort(([left], [right]) => compareStrings(left, right))),
    amendments,
  }
}

function markdownCell(value: string | number | null): string {
  if (value === null) return '—'
  return String(value).replace(/\|/gu, '\\|')
}

function markdownRow(cells: readonly (string | number | null)[]): string {
  return '| ' + cells.map(markdownCell).join(' | ') + ' |'
}

function countRows(counts: Readonly<Record<string, number>>): readonly (readonly [string, number])[] {
  return Object.entries(counts).sort(([left], [right]) => compareStrings(left, right))
}

function buildMarkdown(manifest: CoverageReportManifest, rules: readonly CoverageRule[]): string {
  const lines = [
    '<!-- GENERATED by packages/engine/scripts/rules-coverage.mjs — do not edit. Regenerate: pnpm rules:coverage -->',
    '',
    '# Rules coverage',
    '',
    '## How to read this',
    '',
    'Attestations are dated, re-falsifiable sweep claims about each engine source file.',
    'The registry is the machine-checked chain from a rule to its implementation and discriminating fixtures.',
    '',
    '## Registry totals',
    '',
    '| Metric | Count |',
    '| --- | ---: |',
    markdownRow(['Total rules', manifest.registry.total]),
    ...countRows(manifest.registry.byClassification).map(([classification, count]) =>
      markdownRow(['Classification: ' + classification, count])),
    ...countRows(manifest.registry.approximatedByKind).map(([kind, count]) =>
      markdownRow(['Approximated kind: ' + kind, count])),
    ...countRows(manifest.registry.byVolatility).map(([volatility, count]) =>
      markdownRow(['Volatility: ' + volatility, count])),
    markdownRow(['Federal jurisdiction', manifest.registry.byJurisdiction.federal]),
    markdownRow(['State jurisdiction total', manifest.registry.byJurisdiction.stateTotal]),
    '',
    '| State jurisdiction | Count |',
    '| --- | ---: |',
    ...countRows(manifest.registry.byJurisdiction.states).map(([state, count]) => markdownRow([state, count])),
    '',
    '## Attestation summary',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    markdownRow(['Engine source files', manifest.attestations.totalFiles]),
    markdownRow(['Swept', manifest.attestations.sweptPct.toFixed(1) + '%']),
    markdownRow(['Grandfathered unswept baseline', manifest.attestations.grandfathered]),
    ...countRows(manifest.attestations.byStatus).map(([status, count]) => markdownRow([status, count])),
    '',
    '## Per-directory rollup',
    '',
    '| Directory | Files | Partial | Registered | Rule-free | Unswept |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...manifest.directoryRollup.map((directory) => markdownRow([
      directory.directory,
      directory.files,
      directory.byStatus.partial ?? 0,
      directory.byStatus.registered ?? 0,
      directory.byStatus['rule-free'] ?? 0,
      directory.byStatus.unswept ?? 0,
    ])),
    '',
    '## Unswept files',
    '',
    ...(manifest.unswept.length === 0 ? ['None.'] : manifest.unswept.map((path) => '- ' + path)),
    '',
    '## Partial files',
    '',
    ...(manifest.partial.length === 0
      ? ['None.']
      : [
          '| Path | Swept on | Residual claims |',
          '| --- | --- | --- |',
          ...manifest.partial.map(({ path, sweptOn, note }) => markdownRow([path, sweptOn, note])),
        ]),
    '',
    '## Coverage shards',
    '',
    'Per-rule payloads are sharded one file per record module under `DOCS/operations/rule-coverage/`, mirroring `packages/engine/src/rules/records/`. A re-verification rewrites only the shard whose module it edits, so dispatches in different domains no longer collide on one file.',
    '',
    '| Shard | Rules |',
    '| --- | ---: |',
    ...manifest.shards.map((entry) => markdownRow([entry.path, entry.ruleCount])),
    '',
    '## Re-verification due dates',
    '',
    'The 25 earliest due dates are shown below (' + rules.length +
      ' rules total). Comparing dueOn to today is deliberately excluded so this page stays deterministic; run `pnpm rules:due` to see what is due (add `-- --horizon N` for upcoming), or call taxRulesDueForVerification() from @retiregolden/engine/rules programmatically.',
    '',
    '| Rule | Volatility | Verified on | Due on |',
    '| --- | --- | --- | --- |',
    ...[...rules]
      .sort((left, right) => compareStrings(left.dueOn, right.dueOn) || compareStrings(left.id, right.id))
      .slice(0, 25)
      .map((rule) => markdownRow([rule.id, rule.volatility, rule.verifiedOn, rule.dueOn])),
    '',
    '## Manifest contract',
    '',
    'The JSON ledger (version 5) is the machine contract, and it is split in two: rule-coverage.json is the INDEX — registry and attestation totals, the per-directory rollup, the unswept and partial lists, the quote-fidelity summary, and a shards array naming every shard with its path and rule count — while the per-rule payloads live in the shard files it names, one per record module. A consumer reads the index, then reads the shards it needs; the union of the shards\' rules arrays, sorted by id, is what version 4 published inline as manifest.rules.',
    '',
    'Each rule carries title, errorDirection (null unless the rule is approximated), approximation (null unless the rule is approximated; otherwise its kind from packages/engine/src/rules/approximationKinds.ts: fix alone, since where the fix goes is the rule\'s own implementations; needs-fact with missingInput, the fact the plan does not collect; or convention with reason, why the approximation is kept), conventionRationale and contraryReading (null when unused), deduplicated authority identities (kind, citation, url), per-fixture detail (path, line, optional note, and the it() tests scanned from the fixture source, each with its own 1-based line), and implementations (per implementing file, the conformance-enforced operative function names with their 1-based declaration lines). Every line number is recomputed from source on each generation and the freshness suite fails when the committed index or any committed shard drifts from the sources in the same commit, so at any commit that passes CI the published lines are exact for that commit. This markdown file is the human summary and does not repeat them.',
    '',
    'The index\'s registry totals also carry approximatedByKind, the approximated rules counted by kind (convention, fix, needs-fact), every kind present and the three summing to byClassification.approximated. It and approximation are additive within version 5: a reader that does not know them ignores them, and one that needs them requires them.',
    '',
    'Version 5 is a breaking discriminator for strict version checks: manifest.rules moved out of the index into the shards. Version 4 added fixtures[].tests and per-function lines in place of the flat title and name lists of version 3.',
    '',
    '## Quote fidelity',
    '',
  ]
  if ('status' in manifest.quoteFidelity) {
    lines.push(
      'No committed ledger — generate one with: pnpm verify:quotes -- --json > DOCS/operations/quote-fidelity-ledger.json (network required; see quote-fidelity.md).',
    )
  } else {
    const fidelity = manifest.quoteFidelity
    const classOf = (verdict: string): string =>
      (QUOTE_FIDELITY_SERIOUS_VERDICTS as readonly string[]).includes(verdict)
        ? 'serious'
        : (QUOTE_FIDELITY_ADVISORY_VERDICTS as readonly string[]).includes(verdict)
          ? 'advisory'
          : 'ok'
    const classTotal = (wanted: string): number =>
      countRows(fidelity.counts).reduce((sum, [verdict, count]) => (classOf(verdict) === wanted ? sum + count : sum), 0)
    const provenance =
      fidelity.fetched === null || fidelity.cached === null
        ? ''
        : ' (' + fidelity.fetched + ' fetched live, ' + fidelity.cached + ' from cache)'
    lines.push(
      'Committed ledger generated at ' +
        fidelity.generatedAt +
        provenance +
        (fidelity.amendments.length === 0 ? '' : ' and amended afterwards') +
        ', over ' +
        fidelity.entryCount +
        ' authority entries.',
      ...fidelity.amendments.map(
        (amendment) =>
          'Amended on ' +
          amendment.on +
          ': ' +
          amendment.entries.length +
          ' ' +
          (amendment.entries.length === 1 ? 'entry' : 'entries') +
          ' verified individually after that run (' +
          amendment.entries.map((entry) => entry.id + ', ' + entry.citation).join('; ') +
          '). ' +
          amendment.note,
      ),
      '',
      classTotal('serious') +
        ' serious, ' +
        classTotal('advisory') +
        ' advisory, ' +
        classTotal('ok') +
        ' verify clean. Serious verdicts are dispositioned through the rules:due re-verification queue,',
      'not treated as a CI gate; how to read each verdict: DOCS/operations/quote-fidelity.md.',
      '',
      '| Verdict | Class | Count |',
      '| --- | --- | ---: |',
    )
    lines.push(...countRows(fidelity.counts).map(([verdict, count]) => markdownRow([verdict, classOf(verdict), count])))
    lines.push(
      '',
      'Regenerate: pnpm verify:quotes -- --json > DOCS/operations/quote-fidelity-ledger.json (network required), then pnpm rules:coverage.',
    )
  }
  return lines.join('\n') + '\n'
}

/**
 * Environmental inputs enter at this boundary so committed artifacts reproduce
 * across machines without a filesystem read or clock observation.
 */
export function buildCoverageReport(input: CoverageReportInput): CoverageReport {
  const fixtureDetails = detailsByRule(input.testSources, 'describeRule')
  const refusalFixtureDetails = detailsByRule(input.testSources, 'describeRefusal')
  const rules: readonly CoverageRule[] = Object.entries(input.registry)
    .map(([id, rule]) => ({
      id,
      title: rule.title,
      classification: rule.classification,
      errorDirection: rule.errorDirection,
      approximation: publishedApproximation(id, rule.classification, input.approximationKinds),
      conventionRationale: rule.conventionRationale,
      contraryReading: rule.contraryReading,
      jurisdiction: rule.jurisdiction,
      volatility: rule.volatility,
      effectiveFrom: rule.effectiveFrom,
      effectiveThrough: rule.effectiveThrough,
      verifiedOn: rule.verifiedOn,
      dueOn: input.dueOnFor(id as TaxRuleId),
      implementedBy: [...rule.implementedBy].sort(),
      implementations: [...rule.implementedBy].sort().map((path) => ({
        path,
        functions: rule.implementedByFunctions
          .filter((entry: string) => entry.startsWith(path + '#'))
          .map((entry: string) => entry.slice(path.length + 1))
          .sort(compareStrings)
          .map((name) => ({ name, line: input.symbolLineFor(path, name) })),
      })),
      fixtureFiles: [...new Set((fixtureDetails.get(id) ?? []).map(({ path }) => path))].sort(compareStrings),
      fixtures: fixtureDetails.get(id) ?? [],
      refusalFixtureFiles: [...new Set((refusalFixtureDetails.get(id) ?? []).map(({ path }) => path))].sort(compareStrings),
      refusalFixtures: refusalFixtureDetails.get(id) ?? [],
      // Distinct quotes of one provision collapse to one public identity once
      // quotedText is stripped; duplicates would inflate link lists downstream.
      authorities: dedupeAuthorityIdentities(rule.authority),
    }))
    .sort((left, right) => compareStrings(left.id, right.id))
  // publishedApproximation has already refused a kind on a registered rule that
  // is not approximated; a kind for an id the registry does not hold at all
  // (a renamed or deleted rule) would otherwise be dropped without a word.
  const unregisteredKinds = Object.keys(input.approximationKinds)
    .filter((id) => !Object.hasOwn(input.registry, id))
    .sort(compareStrings)
  if (unregisteredKinds.length > 0) {
    throw new Error('approximation kinds name rules the registry does not hold: ' + unregisteredKinds.join(', '))
  }
  // A typed literal, so a fourth kind cannot be added without a count here;
  // key order is alphabetical, like every other count map in the ledger.
  const approximatedByKind: Record<ApproximationKind, number> = { convention: 0, fix: 0, 'needs-fact': 0 }
  for (const rule of rules) {
    if (rule.approximation !== null) approximatedByKind[rule.approximation.kind] += 1
  }
  const attestationEntries = Object.entries(input.attestations).sort(([left], [right]) => compareStrings(left, right))
  const unswept = attestationEntries
    .filter(([, attestation]) => attestation.status === 'unswept')
    .map(([path]) => path)
  const partial = attestationEntries
    .filter(([, attestation]) => attestation.status === 'partial')
    .map(([path, attestation]) => ({ path, sweptOn: attestation.sweptOn, note: attestation.note }))
  const statuses: readonly CoverageAttestationStatus[] = ['partial', 'registered', 'rule-free', 'unswept']
  const byStatus = countBy(Object.values(input.attestations).map(({ status }) => status))
  for (const status of statuses) byStatus[status] ??= 0
  const stateCounts: Record<string, number> = {}
  for (const rule of rules) {
    if (rule.jurisdiction === 'federal') continue
    const state = rule.jurisdiction.slice(STATE_PREFIX.length)
    stateCounts[state] = (stateCounts[state] ?? 0) + 1
  }
  const totalFiles = attestationEntries.length
  const swept = totalFiles - unswept.length
  const expectedAuthorityEntries = Object.entries(input.registry).flatMap(([id, rule]) =>
    rule.authority.map((authority) => ({ id, citation: authority.citation, url: authority.url })),
  )
  // The shard boundary is the record module, so the mapping is read from the
  // modules themselves. A rule the modules do not claim would be published into
  // no shard and silently vanish from the ledger's union, so it throws instead:
  // the registry is composed FROM these modules, and the conformance suite
  // already fails when one on disk is missing from the list.
  const moduleOfRule = new Map<string, string>()
  for (const [moduleName, records] of input.recordModules) {
    for (const ruleId of Object.keys(records)) moduleOfRule.set(ruleId, moduleName)
  }
  const rulesByModule = new Map<string, CoverageRule[]>(
    input.recordModules.map(([moduleName]) => [moduleName, []]),
  )
  for (const rule of rules) {
    const moduleName = moduleOfRule.get(rule.id)
    if (moduleName === undefined) {
      throw new Error('rule ' + rule.id + ' belongs to no record module, so it has no coverage shard')
    }
    rulesByModule.get(moduleName)!.push(rule)
  }
  const shards: readonly CoverageReportShard[] = [...rulesByModule.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([moduleName, moduleRules]) => {
      // `rules` is already id-sorted, so per-module order inherits that; the
      // sort is restated because the shard file's ordering is the committed
      // artifact's, and it must not depend on how the outer list was built.
      const sorted = [...moduleRules].sort((left, right) => compareStrings(left.id, right.id))
      const shard: CoverageShard = {
        kind: 'retiregolden.rules-coverage.shard',
        version: 5,
        module: moduleName,
        rules: sorted,
      }
      return {
        module: moduleName,
        path: coverageShardPath(moduleName),
        shard,
        json: JSON.stringify(shard, null, 2) + '\n',
      }
    })
  const manifest: CoverageReportManifest = {
    kind: 'retiregolden.rules-coverage.manifest',
    // 5: the per-rule payloads moved out of the index into one shard per record
    // module (manifest.shards names them); the index itself no longer carries a
    // rules array. 4: implementation functions and fixture tests carry 1-based
    // declaration lines for deep links (fixtures[].tests replaces the flat
    // testTitles list). 3 added implementations and per-fixture detail; 2 added
    // title/errorDirection/conventionRationale/contraryReading and deduplicated
    // authority identities. A consumer requiring these fields gates on the
    // version. Still 5 with every rule's `approximation` (null unless the
    // rule is approximated) and registry.approximatedByKind: both are
    // additive, so a version 5 reader that does not know them ignores them,
    // and a reader that needs them requires them.
    version: 5,
    registry: {
      total: rules.length,
      byClassification: countBy(rules.map(({ classification }) => classification)),
      approximatedByKind,
      byVolatility: countBy(rules.map(({ volatility }) => volatility)),
      byJurisdiction: {
        federal: rules.filter(({ jurisdiction }) => jurisdiction === 'federal').length,
        states: Object.fromEntries(Object.entries(stateCounts).sort(([left], [right]) => compareStrings(left, right))),
        stateTotal: Object.values(stateCounts).reduce((total, count) => total + count, 0),
      },
    },
    attestations: {
      totalFiles,
      byStatus: Object.fromEntries(Object.entries(byStatus).sort(([left], [right]) => compareStrings(left, right))),
      sweptPct: Number(((swept / totalFiles) * 100).toFixed(1)),
      grandfathered: input.baselineUnswept.length,
    },
    unswept,
    partial,
    directoryRollup: directoryRollup(input.attestations),
    shards: shards.map(({ module, path, shard }) => ({ module, path, ruleCount: shard.rules.length })),
    quoteFidelity: quoteFidelitySummary(input.quoteFidelityLedger, expectedAuthorityEntries),
  }
  return {
    manifest,
    rules,
    markdown: buildMarkdown(manifest, rules),
    json: JSON.stringify(manifest, null, 2) + '\n',
    shards,
  }
}

export interface CalculationCoverageInput {
  readonly registry: Readonly<Record<string, CalculationRecord>>
  readonly recordModules: readonly (readonly [string, Readonly<Record<string, CalculationRecord>>])[]
  readonly families: Readonly<Record<string, OutputFamily>>
  readonly attestations: Readonly<Record<string, CoverageAttestation>>
  readonly testSources: Readonly<Record<string, string>>
  /** Repo-relative path → source, for every `*.external.golden.test.ts` under packages/. */
  readonly externalGoldenSources: Readonly<Record<string, string>>
  /**
   * The text of DOCS/external-oracles.md, whose "Implemented fixtures" table
   * names each oracle's id, domain and primary source against its fixture
   * file. Required whenever `externalGoldenSources` is non-empty: every
   * fixture must have a row there and state its tolerance, or the census
   * refuses to build.
   */
  readonly oracleRegistryText?: string | null
  readonly walkthroughs: readonly { readonly id: string; readonly testName: string }[]
  readonly symbolLineFor: (path: string, symbol: string) => number
  readonly docTextFor: (path: string) => string | null
}

/**
 * The contract gates a record is held to, published per record so a gate
 * that breaks later (a moved worksheet, a renamed pin) is visible in the
 * artifact rather than folded silently into the family's `partial` status.
 * `worksheetExists` and `mutationExists` are true for a record that owes no
 * derivation worksheet (dataset, assumption, and registry justifications).
 */
export interface CalculationRecordGates {
  readonly fixtureRegistersTest: boolean
  readonly pinsResolve: boolean
  readonly familiesExist: boolean
  readonly worksheetExists: boolean
  readonly mutationExists: boolean
  readonly provenanceIndependent: boolean
}

/** A dataset justification's public source; its digest and rights note stay in the registry. */
export interface CalculationCoverageDataset {
  readonly citation: string
  readonly url: string
  readonly asOf: string
  readonly retrievedOn: string
}

export interface CalculationCoverageAssumption {
  readonly rationale: string
  readonly intendedUse: string
  readonly errorBound: string | null
}

export interface CalculationCoverageRecord {
  readonly id: string
  readonly title: string
  readonly kind: CalculationRecord['kind']
  readonly outputs: readonly string[]
  /** The record's `feeds` list as declared; `[]` when the record declares none. */
  readonly feeds: readonly string[]
  // The record's substance, copied from the registry so the catalog page can
  // show it without a click-through. Justification detail is published per
  // kind; each field is null for the kinds it does not belong to.
  readonly purpose: string
  readonly statement: string
  readonly formula: CalculationFormula | null
  readonly limits: readonly string[]
  /**
   * The evidence worksheet path: a derivation record's `justification.worksheet`
   * as declared; for any other justification kind, the conventional
   * `DOCS/calculations/<group>/<id>.md` when that file exists, else null.
   */
  readonly worksheet: string | null
  /**
   * The worksheet's mutation receipt, by `mutationReceiptPathOf`: always named
   * for a derivation record (the gates report whether it exists); for any
   * other kind only when the receipt file exists; null whenever `worksheet` is.
   */
  readonly mutation: string | null
  /** Null unless `justificationKind` is 'dataset'. */
  readonly dataset: CalculationCoverageDataset | null
  /** Null unless `justificationKind` is 'registry'. */
  readonly ruleIds: readonly string[] | null
  /** Null unless `justificationKind` is 'assumption'. */
  readonly assumption: CalculationCoverageAssumption | null
  readonly justificationKind: CalculationRecord['justification']['kind']
  readonly implementedBy: readonly string[]
  readonly provenance: CalculationRecord['provenance']
  readonly fixtureFiles: readonly string[]
  readonly gates: CalculationRecordGates
}

export interface WalkthroughEntry {
  readonly id: string
  readonly testName: string
}

const WALKTHROUGH_TEST_SUFFIX = /\.test\.tsx?$/u

/**
 * The walkthrough census: one entry per it()/test() title found at CODE
 * level in each `*.test.ts(x)` file of planner-ui's `examples/walkthroughs/`,
 * with `id` the file name minus its test suffix. The generator and the
 * freshness suite each feed this from their own listing of that directory,
 * so the published list is always the computed one: an empty list means the
 * directory holds no walkthrough tests, never that the scan was skipped.
 */
export function walkthroughEntriesOf(sources: Readonly<Record<string, string>>): readonly WalkthroughEntry[] {
  const entries: { id: string; testName: string; line: number }[] = []
  for (const [path, source] of Object.entries(sources)) {
    const fileName = path.slice(path.lastIndexOf('/') + 1)
    if (!WALKTHROUGH_TEST_SUFFIX.test(fileName)) continue
    const id = fileName.replace(WALKTHROUGH_TEST_SUFFIX, '')
    for (const test of testsBetween(source, 0, source.length, newlineOffsets(source), true)) {
      entries.push({ id, testName: test.title, line: test.line })
    }
  }
  return entries
    .sort((left, right) => compareStrings(left.id, right.id) || left.line - right.line)
    .map(({ id, testName }) => ({ id, testName }))
}

/**
 * The calculation-coverage ledger version, carried by the index and by every
 * shard: the pair moves together, so a consumer that pins one pins both.
 * Version 2 added each record's substance (purpose, statement, formula,
 * limits, worksheet, mutation, dataset, ruleIds, assumption) between `feeds`
 * and `justificationKind`, and names worksheet and mutation for any
 * justification kind whose conventional evidence files exist. Version 1 was
 * the sharded layout with per-record gates only.
 */
export const CALCULATION_COVERAGE_VERSION = 2

/** One row of the oracle registry's "Implemented fixtures" table, as a fixture file carries it. */
export interface OracleRegistryEntry {
  /** `ORACLE-001`, or a range such as `ORACLE-007/008` for one row naming several. */
  readonly id: string
  readonly domain: string
  /** The primary source the fixture freezes, as the registry states it, as plain text (links as their text; code, bold and italic markers removed). */
  readonly source: string
}

/**
 * One external-oracle fixture file: examples an independent source published,
 * frozen into a test the engine must reproduce. `count` is its code-level
 * it()/test() cases; `tolerances` are the distinct "Tolerance:" statements in
 * its comments (block or line comments), in order, each to the end of its
 * sentence; `oracles` are the registry rows whose fixture is this file, and
 * their ids are exactly the oracles the file declares.
 */
export interface OracleExample {
  readonly file: string
  readonly count: number
  readonly tolerances: readonly string[]
  readonly oracles: readonly OracleRegistryEntry[]
}

export interface CalculationCoverageShard {
  readonly kind: 'retiregolden.calculation-coverage.shard'
  readonly version: typeof CALCULATION_COVERAGE_VERSION
  readonly group: string
  readonly records: readonly CalculationCoverageRecord[]
}

export interface CalculationCoverageManifest {
  readonly kind: 'retiregolden.calculation-coverage.manifest'
  readonly version: typeof CALCULATION_COVERAGE_VERSION
  readonly families: {
    readonly identified: number
    readonly byGroup: Readonly<Record<string, number>>
    readonly byKind: Readonly<Record<string, number>>
    readonly complete: readonly string[]
    readonly partial: readonly string[]
    readonly noRecordYet: readonly string[]
    readonly relocationPending: readonly string[]
    /**
     * Family id → sorted ids of the records whose `feeds` name it. Families
     * nobody feeds are omitted. Informational only: a family listed here and
     * in no record's `outputs` is still no-record-yet.
     */
    readonly fedBy: Readonly<Record<string, readonly string[]>>
  }
  readonly records: {
    readonly total: number
    readonly byKind: Readonly<Record<string, number>>
    readonly byJustificationKind: Readonly<Record<string, number>>
  }
  readonly oracleExamples: readonly OracleExample[]
  readonly walkthroughs: readonly { readonly id: string; readonly testName: string }[]
  /**
   * The engine source files the tax-rule sweep attested `rule-free` (swept,
   * no claim that needs a tax rule; coverageAttestations.ts), counted against
   * the calculation catalog: `catalogued` files implement at least one
   * calculation record (a record lists them in `implementedBy`);
   * `excludedWithReason` files implement none and carry an `exclusionReason`
   * saying why none is owed; `notYetReviewed` files implement none and carry
   * no reason yet. The three sum to the rule-free files. They count files,
   * not records or families, and no family status depends on them.
   */
  readonly attestationsDerived: {
    readonly catalogued: number
    readonly excludedWithReason: number
    readonly notYetReviewed: number
  }
  readonly shards: readonly { readonly group: string; readonly path: string; readonly recordCount: number }[]
}

export interface CalculationCoverageReport {
  readonly manifest: CalculationCoverageManifest
  readonly json: string
  readonly shards: readonly {
    readonly group: string
    readonly path: string
    readonly shard: CalculationCoverageShard
    readonly json: string
  }[]
}

const CALCULATION_SHARD_DIRECTORY = 'calculation-coverage'
const CALCULATION_CONFORMANCE_SOURCE = 'calculationRegistry.conformance.test.ts'

export function calculationCoverageShardPath(group: string): string {
  return CALCULATION_SHARD_DIRECTORY + '/' + group + '.json'
}

function attestationPathOf(implementedBy: string): string {
  return implementedBy.replace(/^packages\/engine\/src\//u, '')
}

/**
 * it()/test() calls at CODE level in an external-oracle file — an `it(`
 * inside a comment or a string never counts, so a pending-case note cannot
 * inflate the published case count.
 */
function countOracleCalls(source: string): number {
  let count = 0
  let index = 0
  while (index < source.length) {
    const skipped = skipNonCode(source, index, regexCanFollow(source, index))
    if (skipped !== index) {
      index = skipped
      continue
    }
    const isIt = source.startsWith('it(', index)
    if ((isIt || source.startsWith('test(', index)) && (index === 0 || !/[\w$.]/u.test(source[index - 1]!))) {
      count += 1
      index += isIt ? 3 : 5
      continue
    }
    index += 1
  }
  return count
}

const ORACLE_FIXTURES_HEADING = '## Implemented fixtures'
const ORACLE_TABLE_HEADER = ['ID', 'Domain', 'Fixture', 'Primary source'] as const
const ORACLE_ID_CELL = /^ORACLE-\d{3}(?:\/\d{3})*$/u
const ORACLE_FIXTURE_LINK = /^\[`([^`]+)`\]\([^)]*\)$/u
const EXTERNAL_GOLDEN_SUFFIX = '.external.golden.test.ts'
/**
 * How a fixture declares an oracle it carries, in a comment:
 * `ORACLE-005 (DOCS/external-oracles.md)`. A bare `ORACLE-001` is a
 * cross-reference, not a declaration, and text in code or strings is never
 * read, so a fixture cites another file's oracle in the bare form.
 */
const ORACLE_DECLARATION = /ORACLE-(\d{3}) \(DOCS\/external-oracles\.md\)/gu

/** A registry id cell as the ids it names: `ORACLE-007/008` is ORACLE-007 and ORACLE-008. */
export function oracleIdsOf(cell: string): readonly string[] {
  return cell
    .slice('ORACLE-'.length)
    .split('/')
    .map((digits) => `ORACLE-${digits}`)
}

/** A Markdown table row's cells: split on unescaped pipes, `\\|` read as a literal pipe. */
function markdownTableCells(row: string): string[] {
  const closed = row.endsWith('|') && !row.endsWith('\\|')
  const inner = row.slice(1, closed ? -1 : undefined)
  const cells: string[] = []
  let cell = ''
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index]!
    if (char === '\\' && inner[index + 1] === '|') {
      cell += '|'
      index += 1
    } else if (char === '|') {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell.trim())
  return cells
}

/**
 * Registry text as plain text for publication: a link becomes its text, and
 * code spans, bold and italic lose their markers.
 */
export function plainMarkdownText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/`+/gu, '')
    .replace(/\*\*|__/gu, '')
    .replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?![\w*])/gu, '$1$2')
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/gu, '$1$2')
}

/**
 * The rows of the "Implemented fixtures" table in DOCS/external-oracles.md,
 * for the rows whose fixture is an external golden test. The table is the
 * one under that heading: its header must be
 * `| ID | Domain | Fixture | Primary source |` followed by the delimiter row,
 * and it runs to the first line that is not a row. Refused: a row with other
 * than four cells (a pipe inside a cell is written `\\|`), a row without a
 * fixture link, an external golden row without an ORACLE id, an id listed on
 * two rows, and a table row anywhere in the section after the table has
 * ended (a blank line ends a Markdown table, so such a row would silently
 * drop out of it). Rows for other fixtures (a characterization benchmark, a
 * hand-worksheet golden) are not published examples and are skipped.
 */
export function oracleRegistryRowsOf(text: string): readonly (OracleRegistryEntry & { readonly file: string })[] {
  const lines = text.replace(/\r\n/gu, '\n').split('\n')
  const start = lines.findIndex((line) => line.trim() === ORACLE_FIXTURES_HEADING)
  if (start < 0) throw new Error(`external oracle registry: no "${ORACLE_FIXTURES_HEADING}" section`)
  const next = lines.findIndex((line, index) => index > start && /^#{1,2} /u.test(line))
  const section = lines.slice(start + 1, next < 0 ? undefined : next).map((line) => line.trim())
  const first = section.findIndex((line) => line.startsWith('|'))
  if (first < 0) throw new Error(`external oracle registry: no table under "${ORACLE_FIXTURES_HEADING}"`)
  if (markdownTableCells(section[first]!).join('|') !== ORACLE_TABLE_HEADER.join('|')) {
    throw new Error(`external oracle registry: the table's header must be | ${ORACLE_TABLE_HEADER.join(' | ')} |`)
  }
  if (!/^\|(?:\s*:?-+:?\s*\|){4}$/u.test(section[first + 1] ?? '')) {
    throw new Error("external oracle registry: the table's header must be followed by its delimiter row")
  }
  const rows: (OracleRegistryEntry & { readonly file: string })[] = []
  const seenIds = new Map<string, string>()
  let index = first + 2
  for (; index < section.length && section[index]!.startsWith('|'); index += 1) {
    const line = section[index]!
    const cells = markdownTableCells(line)
    if (cells.length !== 4) {
      throw new Error(
        `external oracle registry: a row has ${cells.length} cells, not 4 (write a pipe inside a cell as \\|): ${line.slice(0, 80)}`,
      )
    }
    const [id, domain, fixture, source] = cells as [string, string, string, string]
    const link = ORACLE_FIXTURE_LINK.exec(fixture)
    if (link === null) throw new Error(`external oracle registry: row ${id} has no fixture link: ${fixture.slice(0, 80)}`)
    const file = link[1]!
    if (ORACLE_ID_CELL.test(id)) {
      for (const oracleId of oracleIdsOf(id)) {
        const earlier = seenIds.get(oracleId)
        if (earlier !== undefined) {
          throw new Error(`external oracle registry: ${oracleId} is listed twice (for ${earlier} and for ${file})`)
        }
        seenIds.set(oracleId, file)
      }
    }
    if (!file.endsWith(EXTERNAL_GOLDEN_SUFFIX)) continue
    if (!ORACLE_ID_CELL.test(id)) throw new Error(`external oracle registry: the row for ${file} has no ORACLE id: "${id}"`)
    rows.push({ id, domain: plainMarkdownText(domain), source: plainMarkdownText(source), file })
  }
  const stray = section.slice(index).find((line) => line.startsWith('|'))
  if (stray !== undefined) {
    throw new Error(
      `external oracle registry: a table row appears after the table has ended (a blank line or text ends a Markdown table): ${stray.slice(0, 80)}`,
    )
  }
  return rows
}

/** Every comment in a source file, block or line, as its lines with the comment markers removed; strings are skipped. */
function commentLinesOf(source: string): readonly (readonly string[])[] {
  const comments: string[][] = []
  let index = 0
  while (index < source.length) {
    const skipped = skipNonCode(source, index, regexCanFollow(source, index))
    if (skipped === index) {
      index += 1
      continue
    }
    if (source[index] === '/' && (source[index + 1] === '*' || source[index + 1] === '/')) {
      comments.push(
        source
          .slice(index, skipped)
          .replace(/\r\n/gu, '\n')
          .split('\n')
          .map((line) =>
            line
              .replace(/^\s*(?:\/\*\*?|\/\/+|\*(?!\/))?\s?/u, '')
              .replace(/\s*\*\/\s*$/u, '')
              .trim(),
          ),
      )
    }
    index = skipped
  }
  return comments
}

/**
 * Abbreviations a citation puts inside a sentence (Rev. Proc., Pub., No.,
 * Sec., a month, e.g., U.S., a single initial): the period after one does not
 * end a tolerance statement.
 */
const CITATION_ABBREVIATION =
  /(?:^|[\s(])(?:Rev|Proc|Pub|Publ|No|Nos|Sec|Secs|Reg|Regs|Rul|Treas|Dept|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|vs|approx|e\.g|i\.e|[A-Z](?:\.[A-Z])*)$/u

/**
 * The first period that ends a sentence: followed by whitespace or the end,
 * not inside a number such as 0.10, and not after a citation abbreviation
 * such as "Rev. Proc." (the period ending the whole text always counts).
 */
function sentenceEndOf(text: string): number {
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '.') continue
    if (index + 1 === text.length) return index
    if (!/\s/u.test(text[index + 1]!)) continue
    if (CITATION_ABBREVIATION.test(text.slice(0, index))) continue
    return index
  }
  return -1
}

/** A comment line that opens a new labelled field ("Access date: …"), which a wrapped statement never runs into. */
const LABELLED_LINE = /^[A-Z][A-Za-z0-9 /()'-]{0,40}:(?:\s|$)/u
const TOLERANCE_WRAP_LIMIT = 3

/**
 * The distinct "Tolerance:" statements in a fixture's comments (block or
 * line comments; never code or strings), in order. A statement is the text
 * after the label to the end of its sentence: the first period followed by a
 * space or the end of the text, so neither the period in 0.10 nor one after a
 * citation abbreviation ("Rev. Proc.", "Pub.", "No.", "U.S.") ends it. A
 * statement that does not end on its line continues onto following comment
 * lines, up to three, but never into a blank line or a line that opens a new
 * labelled field; one that still has not ended is refused rather than
 * published garbled, as is an empty statement.
 */
export function oracleTolerancesOf(source: string): readonly string[] {
  const found: string[] = []
  for (const lines of commentLinesOf(source)) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!
      const at = line.indexOf('Tolerance:')
      if (at < 0) continue
      let text = line.slice(at + 'Tolerance:'.length).trim()
      let wrapped = 0
      while (sentenceEndOf(text) < 0 && wrapped < TOLERANCE_WRAP_LIMIT) {
        const nextLine = lines[index + 1 + wrapped]
        if (nextLine === undefined || nextLine === '' || LABELLED_LINE.test(nextLine)) break
        text += ' ' + nextLine
        wrapped += 1
      }
      const end = sentenceEndOf(text)
      if (end < 0) {
        throw new Error(`a "Tolerance:" statement must end its sentence with a period: "${text.slice(0, 80)}"`)
      }
      const statement = text.slice(0, end).trim()
      if (statement === '') throw new Error('a "Tolerance:" statement is empty')
      if (!found.includes(statement)) found.push(statement)
    }
  }
  return found
}

/**
 * Every external-oracle fixture with its cases, stated tolerances and
 * registry rows. Fails closed, so the published table cannot fall out of
 * step with the fixtures: a fixture with no registry row; a registry row
 * naming an external golden that is not in the tree (checked whenever the
 * registry is given, fixtures or not); an oracle a fixture declares
 * (`ORACLE-nnn (DOCS/external-oracles.md)`) that the registry does not list
 * for that file, or one the registry lists for it that the file does not
 * declare; a fixture that states no tolerance or states one that cannot be
 * read; and fixtures with no registry at all.
 */
function oracleExamplesOf(input: CalculationCoverageInput): readonly OracleExample[] {
  const files = Object.keys(input.externalGoldenSources)
  if (!input.oracleRegistryText) {
    if (files.length === 0) return []
    throw new Error('external oracle registry: DOCS/external-oracles.md is required when external golden fixtures exist')
  }
  const rows = oracleRegistryRowsOf(input.oracleRegistryText)
  const present = new Set(files)
  for (const row of rows) {
    if (!present.has(row.file)) {
      throw new Error(`external oracle registry: row ${row.id} names ${row.file}, which is not an external golden fixture in the tree`)
    }
  }
  return files
    .map((file) => {
      const source = input.externalGoldenSources[file]!
      const oracles = rows.filter((row) => row.file === file).map(({ id, domain, source: text }) => ({ id, domain, source: text }))
      if (oracles.length === 0) {
        throw new Error(`external oracle registry: ${file} has no row in the "Implemented fixtures" table of DOCS/external-oracles.md`)
      }
      const listed = new Set(oracles.flatMap((oracle) => oracleIdsOf(oracle.id)))
      const commentText = commentLinesOf(source)
        .map((lines) => lines.join('\n'))
        .join('\n')
      const declared = new Set([...commentText.matchAll(ORACLE_DECLARATION)].map((match) => `ORACLE-${match[1]}`))
      for (const id of declared) {
        if (!listed.has(id)) {
          throw new Error(`external oracle registry: ${file} declares ${id}, which the "Implemented fixtures" table does not list for it`)
        }
      }
      for (const id of listed) {
        if (!declared.has(id)) {
          throw new Error(
            `external oracle registry: the "Implemented fixtures" table lists ${id} for ${file}, which the file does not declare as "${id} (DOCS/external-oracles.md)"`,
          )
        }
      }
      let tolerances: readonly string[]
      try {
        tolerances = oracleTolerancesOf(source)
      } catch (error) {
        throw new Error(`external oracle fixture ${file}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
      }
      if (tolerances.length === 0) throw new Error(`external oracle fixture ${file} states no "Tolerance:" line in its comments`)
      return { file, count: countOracleCalls(source), tolerances, oracles }
    })
    .sort((left, right) => compareStrings(left.file, right.file))
}

function docPresent(text: string | null): boolean {
  return text !== null && text.trim().length > 0
}

function calculationRecordGates(
  id: string,
  record: CalculationRecord,
  input: CalculationCoverageInput,
  fixtureDetails: ReadonlyMap<string, readonly FixtureDetail[]>,
): CalculationRecordGates {
  const fixtures = fixtureDetails.get(id) ?? []
  const pinsResolve = record.implementedByFunctions.every((entry) => {
    const hash = entry.indexOf('#')
    if (hash <= 0 || hash === entry.length - 1) return false
    try {
      input.symbolLineFor(entry.slice(0, hash), entry.slice(hash + 1))
      return true
    } catch {
      return false
    }
  })
  let worksheetExists = true
  let mutationExists = true
  if (record.justification.kind === 'derivation') {
    const { worksheet } = record.justification
    worksheetExists = docPresent(input.docTextFor(worksheet))
    // The receipt path is derived by the one shared convention, the same one
    // describeCalculation holds the fixture to, so the two cannot diverge.
    mutationExists = docPresent(input.docTextFor(mutationReceiptPathOf(worksheet)))
  }
  return {
    fixtureRegistersTest: fixtures.some((fixture) => fixture.tests.length > 0),
    pinsResolve,
    familiesExist: [...record.outputs, ...(record.feeds ?? [])].every(
      (familyId) => input.families[familyId] !== undefined,
    ),
    worksheetExists,
    mutationExists,
    provenanceIndependent: record.provenance.derivedBy !== record.provenance.reviewedBy,
  }
}

function gatesPass(gates: CalculationRecordGates): boolean {
  return Object.values(gates).every((gate) => gate === true)
}

function familyRelocationPending(family: OutputFamily): boolean {
  return (
    (family.kind === 'ui-native' || family.kind === 'ui-transformation') &&
    family.relocation !== null &&
    family.relocation.status === 'pending'
  )
}

function familyIsComplete(
  family: OutputFamily,
  records: readonly { record: CalculationRecord; passes: boolean }[],
): boolean {
  if (records.length === 0) return false
  if (!records.every(({ record, passes }) => passes && record.provenance.reviewedBy !== 'unreviewed')) return false
  if (family.surfaces.length === 0) return false
  if (family.relocation !== null && family.relocation.status !== 'done') return false
  return true
}

type CalculationSubstance = Pick<
  CalculationCoverageRecord,
  'purpose' | 'statement' | 'formula' | 'limits' | 'worksheet' | 'mutation' | 'dataset' | 'ruleIds' | 'assumption'
>

/**
 * The docs directory a record module's evidence lives in: the module name in
 * kebab case (`laddersAndValuation` is `ladders-and-valuation`), which is the
 * family-group vocabulary and the directory every derivation worksheet in the
 * registry already names. A record of any other justification kind owes no
 * worksheet, but when one exists at `DOCS/calculations/<directory>/<id>.md`
 * the catalog card should name it rather than publish null beside a file
 * that is on disk.
 */
function conventionalWorksheetPathOf(group: string, id: string): string {
  const directory = group.replace(/[A-Z]/gu, (letter) => '-' + letter.toLowerCase())
  return 'DOCS/calculations/' + directory + '/' + id + '.md'
}

/**
 * The worksheet and receipt the card names. A derivation record's come from
 * the registry, the receipt by the one shared convention the gates check, so
 * the published path and the gated path cannot differ. Any other kind names
 * the conventional worksheet only when that file exists, and its receipt only
 * when the receipt file exists too; neither is a gate for those kinds.
 */
function evidencePathsOf(
  record: CalculationRecord,
  group: string,
  id: string,
  docTextFor: CalculationCoverageInput['docTextFor'],
): Pick<CalculationSubstance, 'worksheet' | 'mutation'> {
  if (record.justification.kind === 'derivation') {
    const { worksheet } = record.justification
    return { worksheet, mutation: mutationReceiptPathOf(worksheet) }
  }
  const worksheet = conventionalWorksheetPathOf(group, id)
  if (!docPresent(docTextFor(worksheet))) return { worksheet: null, mutation: null }
  const mutation = mutationReceiptPathOf(worksheet)
  return { worksheet, mutation: docPresent(docTextFor(mutation)) ? mutation : null }
}

/**
 * What the catalog page shows for a record without a click-through: its
 * prose, its formula, its evidence paths, and the public part of its
 * justification. A dataset's digest and rights note are registry detail and
 * are not published.
 */
function calculationSubstance(
  record: CalculationRecord,
  group: string,
  id: string,
  docTextFor: CalculationCoverageInput['docTextFor'],
): CalculationSubstance {
  const { formula, justification } = record
  return {
    purpose: record.purpose,
    statement: record.statement,
    formula:
      formula === null
        ? null
        : {
            expression: formula.expression,
            variables: formula.variables.map(({ symbol, meaning, unit, domain }) => ({
              symbol,
              meaning,
              unit,
              domain,
            })),
            timing: formula.timing,
            rounding: formula.rounding,
          },
    limits: [...record.limits],
    ...evidencePathsOf(record, group, id, docTextFor),
    dataset:
      justification.kind === 'dataset'
        ? {
            citation: justification.source.citation,
            url: justification.source.url,
            asOf: justification.source.asOf,
            retrievedOn: justification.source.retrievedOn,
          }
        : null,
    ruleIds: justification.kind === 'registry' ? [...justification.ruleIds] : null,
    assumption:
      justification.kind === 'assumption'
        ? {
            rationale: justification.rationale,
            intendedUse: justification.intendedUse,
            errorBound: justification.errorBound,
          }
        : null,
  }
}

export function buildCalculationCoverageReport(input: CalculationCoverageInput): CalculationCoverageReport {
  const fixtureDetails = detailsByRule(
    Object.fromEntries(
      Object.entries(input.testSources).filter(([path]) => !path.endsWith(CALCULATION_CONFORMANCE_SOURCE)),
    ),
    'describeCalculation',
  )
  const gateById = new Map(
    Object.entries(input.registry).map(([id, record]) => [
      id,
      calculationRecordGates(id, record, input, fixtureDetails),
    ]),
  )
  const moduleOfRecord = new Map<string, string>()
  for (const [moduleName, records] of input.recordModules) {
    for (const id of Object.keys(records)) moduleOfRecord.set(id, moduleName)
  }
  const moduleOf = (id: string): string => {
    const moduleName = moduleOfRecord.get(id)
    if (moduleName === undefined) {
      throw new Error('calculation ' + id + ' belongs to no record module, so it has no coverage shard')
    }
    return moduleName
  }
  const published: readonly CalculationCoverageRecord[] = Object.entries(input.registry)
    .map(([id, record]) => ({
      id,
      title: record.title,
      kind: record.kind,
      outputs: [...record.outputs],
      feeds: [...(record.feeds ?? [])],
      ...calculationSubstance(record, moduleOf(id), id, input.docTextFor),
      justificationKind: record.justification.kind,
      implementedBy: [...record.implementedBy],
      provenance: record.provenance,
      fixtureFiles: [...new Set((fixtureDetails.get(id) ?? []).map(({ path }) => path))].sort(compareStrings),
      gates: gateById.get(id)!,
    }))
    .sort((left, right) => compareStrings(left.id, right.id))
  // Family status is decided by `outputs` alone: a record that only feeds a
  // family (see CalculationRecord.feeds) is not the record that computes it,
  // so it must not move that family out of no-record-yet.
  const recordsByFamily = new Map<string, { record: CalculationRecord; passes: boolean }[]>()
  const feedersByFamily = new Map<string, string[]>()
  for (const [id, record] of Object.entries(input.registry)) {
    for (const familyId of record.outputs) {
      const list = recordsByFamily.get(familyId) ?? []
      list.push({ record, passes: gatesPass(gateById.get(id)!) })
      recordsByFamily.set(familyId, list)
    }
    for (const familyId of record.feeds ?? []) {
      if (input.families[familyId] === undefined) continue
      const feeders = feedersByFamily.get(familyId) ?? []
      feeders.push(id)
      feedersByFamily.set(familyId, feeders)
    }
  }
  const fedBy: Record<string, readonly string[]> = Object.fromEntries(
    [...feedersByFamily.entries()]
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([familyId, feeders]) => [familyId, [...feeders].sort(compareStrings)]),
  )
  const complete: string[] = []
  const partial: string[] = []
  const noRecordYet: string[] = []
  const relocationPending: string[] = []
  for (const [familyId, family] of Object.entries(input.families)) {
    if (familyRelocationPending(family)) relocationPending.push(familyId)
    const named = recordsByFamily.get(familyId) ?? []
    if (named.length === 0) noRecordYet.push(familyId)
    else if (familyIsComplete(family, named)) complete.push(familyId)
    else partial.push(familyId)
  }
  complete.sort(compareStrings)
  partial.sort(compareStrings)
  noRecordYet.sort(compareStrings)
  relocationPending.sort(compareStrings)

  const cataloguedPaths = new Set<string>()
  for (const record of Object.values(input.registry)) {
    for (const path of record.implementedBy) cataloguedPaths.add(attestationPathOf(path))
  }
  let catalogued = 0
  let excludedWithReason = 0
  let notYetReviewed = 0
  for (const [path, attestation] of Object.entries(input.attestations)) {
    if (attestation.status !== 'rule-free') continue
    if (cataloguedPaths.has(path)) catalogued += 1
    else if (typeof attestation.exclusionReason === 'string' && attestation.exclusionReason.trim().length > 0) {
      excludedWithReason += 1
    } else {
      notYetReviewed += 1
    }
  }

  const recordsByModule = new Map<string, CalculationCoverageRecord[]>(
    input.recordModules.map(([moduleName]) => [moduleName, []]),
  )
  for (const record of published) recordsByModule.get(moduleOf(record.id))!.push(record)
  const shards = [...recordsByModule.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([group, moduleRecords]) => {
      const sorted = [...moduleRecords].sort((left, right) => compareStrings(left.id, right.id))
      const shard: CalculationCoverageShard = {
        kind: 'retiregolden.calculation-coverage.shard',
        version: CALCULATION_COVERAGE_VERSION,
        group,
        records: sorted,
      }
      return {
        group,
        path: calculationCoverageShardPath(group),
        shard,
        json: JSON.stringify(shard, null, 2) + '\n',
      }
    })

  const oracleExamples = oracleExamplesOf(input)

  const familyList = Object.values(input.families)
  const manifest: CalculationCoverageManifest = {
    kind: 'retiregolden.calculation-coverage.manifest',
    version: CALCULATION_COVERAGE_VERSION,
    families: {
      identified: familyList.length,
      byGroup: countBy(familyList.map(({ group }) => group)),
      byKind: countBy(familyList.map(({ kind }) => kind)),
      complete,
      partial,
      noRecordYet,
      relocationPending,
      fedBy,
    },
    records: {
      total: published.length,
      byKind: countBy(published.map(({ kind }) => kind)),
      byJustificationKind: countBy(published.map(({ justificationKind }) => justificationKind)),
    },
    oracleExamples,
    walkthroughs: [...input.walkthroughs],
    attestationsDerived: { catalogued, excludedWithReason, notYetReviewed },
    shards: shards.map(({ group, path, shard }) => ({ group, path, recordCount: shard.records.length })),
  }
  return {
    manifest,
    json: JSON.stringify(manifest, null, 2) + '\n',
    shards,
  }
}
