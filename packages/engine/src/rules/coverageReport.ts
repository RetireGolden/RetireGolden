import type {
  CoverageAttestation,
  CoverageAttestationStatus,
  COVERAGE_ATTESTATIONS,
} from './coverageAttestations.js'
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
}

export interface CoverageRule {
  readonly id: string
  readonly title: string
  readonly classification: TaxRuleClassification
  readonly errorDirection: TaxRuleErrorDirection | null
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
): { title: string; line: number }[] {
  const tests: { title: string; line: number }[] = []
  let index = start
  while (index < end) {
    const skipped = skipNonCode(source, index, regexCanFollow(source, index))
    if (skipped !== index) {
      index = Math.min(skipped, end)
      continue
    }
    const match = /^\bit\(\s*(['"\u0060])/u.exec(source.slice(index, Math.min(index + 64, end)))
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
 * Scans `testSources` for `describeRule(<id>` or `describeRefusal(<id>`
 * blocks, keyed by rule id — the two helpers make different claims about a
 * rule and are published in separate fields (`fixtures` vs
 * `refusalFixtures`), but the source-level shape of a call (an id string
 * literal, then a balanced extent with it() tests inside) is identical for
 * both, so one scan serves either name.
 */
function detailsByRule(
  testSources: Readonly<Record<string, string>>,
  callName: 'describeRule' | 'describeRefusal',
): ReadonlyMap<string, readonly FixtureDetail[]> {
  const callPattern = new RegExp(callName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&') + '\\(\\s*\'([^\']+)\'', 'gu')
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
  return {
    generatedAt: parsed.generatedAt,
    entryCount: parsed.entryCount,
    fetched: typeof parsed.fetched === 'number' && Number.isFinite(parsed.fetched) ? parsed.fetched : null,
    cached: typeof parsed.cached === 'number' && Number.isFinite(parsed.cached) ? parsed.cached : null,
    counts: Object.fromEntries(Object.entries(counts).sort(([left], [right]) => compareStrings(left, right))),
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
    'Each rule carries title, errorDirection (null unless the rule is approximated), conventionRationale and contraryReading (null when unused), deduplicated authority identities (kind, citation, url), per-fixture detail (path, line, optional note, and the it() tests scanned from the fixture source, each with its own 1-based line), and implementations (per implementing file, the conformance-enforced operative function names with their 1-based declaration lines). Every line number is recomputed from source on each generation and the freshness suite fails when the committed index or any committed shard drifts from the sources in the same commit, so at any commit that passes CI the published lines are exact for that commit. This markdown file is the human summary and does not repeat them.',
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
        ' over ' +
        fidelity.entryCount +
        ' authority entries' +
        provenance +
        '.',
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
    // version.
    version: 5,
    registry: {
      total: rules.length,
      byClassification: countBy(rules.map(({ classification }) => classification)),
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
