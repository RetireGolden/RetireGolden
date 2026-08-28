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
   * entry per implementing file, functions empty until that record's
   * implementedByFunctions backfill lands. Conformance enforces that every
   * declared symbol exists in its file.
   */
  readonly implementations: readonly {
    readonly path: string
    readonly functions: readonly string[]
  }[]
  readonly fixtureFiles: readonly string[]
  /**
   * One entry per describeRule call: where the fixture lives (1-based line of
   * the call) and the it() titles inside its block. Derived from the same
   * source scan as fixtureFiles; nothing here is hand-maintained.
   */
  readonly fixtures: readonly {
    readonly path: string
    readonly line: number
    readonly note: string | null
    readonly testTitles: readonly string[]
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

// Mirrors verify-quotes.mjs's non-zero-exit set; keep the two lists in step.
export const QUOTE_FIDELITY_SERIOUS_VERDICTS = ['ABSENT', 'TRUNCATED', 'ELISION-BROKEN', 'UNFETCHABLE'] as const
const QUOTE_FIDELITY_ADVISORY_VERDICTS = ['PUNCTUATION', 'ELISION-PUNCTUATION', 'PDF-NOT-VERIFIABLE'] as const

export interface CoverageReportManifest {
  readonly kind: 'retiregolden.rules-coverage.manifest'
  readonly version: 3
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
  readonly rules: readonly CoverageRule[]
  readonly quoteFidelity: QuoteFidelitySummary | { readonly status: 'no-committed-ledger' }
}

export interface CoverageReport {
  readonly manifest: CoverageReportManifest
  readonly markdown: string
  readonly json: string
}

const CONFORMANCE_SOURCE = 'taxRuleRegistry.conformance.test.ts'
const STATE_PREFIX = 'state:'

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
 * it() titles at CODE level within [start, end) — an it('...') spelled inside
 * a comment or another string never counts. Plain single, double, and
 * substitution-free backtick titles are all captured.
 */
function testTitlesBetween(source: string, start: number, end: number): string[] {
  const titles: string[] = []
  let index = start
  while (index < end) {
    const skipped = skipNonCode(source, index, regexCanFollow(source, index))
    if (skipped !== index) {
      index = Math.min(skipped, end)
      continue
    }
    const match = /^\bit\(\s*(['"\u0060])/u.exec(source.slice(index, Math.min(index + 24, end)))
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
      if (!broken) titles.push(title)
      index = cursor + 1
      continue
    }
    index += 1
  }
  return titles
}

interface FixtureDetail {
  readonly path: string
  readonly line: number
  readonly note: string | null
  readonly testTitles: readonly string[]
}

function fixtureDetailsByRule(testSources: Readonly<Record<string, string>>): ReadonlyMap<string, readonly FixtureDetail[]> {
  const details = new Map<string, FixtureDetail[]>()
  for (const [path, source] of Object.entries(testSources)) {
    if (path.endsWith(CONFORMANCE_SOURCE)) continue
    // Vite emits same-directory glob keys as `./name`, not `../rules/name`.
    const fixturePath = path
      .replace(/^\.\.\//u, 'packages/engine/src/')
      .replace(/^\.\//u, 'packages/engine/src/rules/')
    const calls = [...source.matchAll(/describeRule\(\s*'([^']+)'/gu)]
    for (let index = 0; index < calls.length; index += 1) {
      const match = calls[index]!
      const ruleId = match[1]!
      const start = match.index ?? 0
      // The block is the describeRule CALL's balanced extent, not a slice to
      // the next call: it() titles that follow the callback's close in the
      // same file belong to sibling suites, never to this rule.
      const end = describeRuleCallEnd(source, start)
      const testTitles = testTitlesBetween(source, start, end)
      const note = noteWithin(source, start, end)
      const line = source.slice(0, start).split('\n').length
      const list = details.get(ruleId) ?? []
      list.push({
        path: fixturePath,
        line,
        note,
        testTitles,
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

function buildMarkdown(manifest: CoverageReportManifest): string {
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
    '## Re-verification due dates',
    '',
    'The 25 earliest due dates are shown below (' + manifest.rules.length +
      ' rules total). Comparing dueOn to today is deliberately excluded so this page stays deterministic; run `pnpm rules:due` to see what is due (add `-- --horizon N` for upcoming), or call taxRulesDueForVerification() from @retiregolden/engine/rules programmatically.',
    '',
    '| Rule | Volatility | Verified on | Due on |',
    '| --- | --- | --- | --- |',
    ...[...manifest.rules]
      .sort((left, right) => compareStrings(left.dueOn, right.dueOn) || compareStrings(left.id, right.id))
      .slice(0, 25)
      .map((rule) => markdownRow([rule.id, rule.volatility, rule.verifiedOn, rule.dueOn])),
    '',
    '## Manifest contract',
    '',
    'The JSON manifest (rule-coverage.json, version 3) is the machine contract: each rule additionally carries title, errorDirection (null unless the rule is approximated), conventionRationale and contraryReading (null when unused), deduplicated authority identities (kind, citation, url), and per-fixture detail (path, line, optional note, and the it() titles scanned from the fixture source). This markdown file is the human summary and does not repeat them. Version 3 is a breaking discriminator for strict version checks (implementations and fixtures are required at 3); the new fields are additive only for readers that ignore unknown keys and do not pin the version.',
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
  const fixtureDetails = fixtureDetailsByRule(input.testSources)
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
          .sort(compareStrings),
      })),
      fixtureFiles: [...new Set((fixtureDetails.get(id) ?? []).map(({ path }) => path))].sort(compareStrings),
      fixtures: fixtureDetails.get(id) ?? [],
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
  const manifest: CoverageReportManifest = {
    kind: 'retiregolden.rules-coverage.manifest',
    // 3: rules additionally carry implementations (per-file function lists)
    // and per-fixture detail. 2 added title/errorDirection/
    // conventionRationale/contraryReading and deduplicated authority
    // identities. A consumer requiring these fields gates on the version.
    version: 3,
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
    rules,
    quoteFidelity: quoteFidelitySummary(input.quoteFidelityLedger, expectedAuthorityEntries),
  }
  return { manifest, markdown: buildMarkdown(manifest), json: JSON.stringify(manifest, null, 2) + '\n' }
}
