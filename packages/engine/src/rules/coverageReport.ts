import type {
  CoverageAttestation,
  CoverageAttestationStatus,
  COVERAGE_ATTESTATIONS,
} from './coverageAttestations.js'
import type {
  DEFAULT_REVERIFICATION_INTERVAL_DAYS,
  TAX_RULE_REGISTRY,
  TaxRuleClassification,
  TaxRuleJurisdiction,
  TaxRuleVolatility,
} from './taxRuleRegistry.js'

export interface CoverageReportInput {
  readonly registry: typeof TAX_RULE_REGISTRY
  readonly attestations: typeof COVERAGE_ATTESTATIONS
  readonly baselineUnswept: readonly string[]
  /** Test-source contents keyed by path, for the describeRule fixture scan. */
  readonly testSources: Readonly<Record<string, string>>
  readonly intervals: typeof DEFAULT_REVERIFICATION_INTERVAL_DAYS
  /** Committed quote-fidelity ledger JSON text, or null when none exists yet. */
  readonly quoteFidelityLedger: string | null
}

interface CoverageRule {
  readonly id: string
  readonly classification: TaxRuleClassification
  readonly jurisdiction: TaxRuleJurisdiction
  readonly volatility: TaxRuleVolatility
  readonly effectiveFrom: number
  readonly effectiveThrough: number | null
  readonly verifiedOn: string
  readonly dueOn: string
  readonly implementedBy: readonly string[]
  readonly fixtureFiles: readonly string[]
}

interface DirectoryRollup {
  readonly directory: string
  readonly files: number
  readonly byStatus: Readonly<Record<string, number>>
}

interface QuoteFidelitySummary {
  readonly generatedAt: string
  readonly counts: Readonly<Record<string, number>>
}

export interface CoverageReportManifest {
  readonly kind: 'retiregolden.rules-coverage.manifest'
  readonly version: 1
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

function dateAfterDays(isoDate: string, days: number): string {
  const date = new Date(isoDate + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function fixtureFilesByRule(testSources: Readonly<Record<string, string>>): ReadonlyMap<string, readonly string[]> {
  const fixturePaths = new Map<string, Set<string>>()
  for (const [path, source] of Object.entries(testSources)) {
    if (path.endsWith(CONFORMANCE_SOURCE)) continue
    // Vite emits same-directory glob keys as `./name`, not `../rules/name`.
    const fixturePath = path
      .replace(/^\.\.\//u, 'packages/engine/src/')
      .replace(/^\.\//u, 'packages/engine/src/rules/')
    for (const match of source.matchAll(/describeRule\(\s*'([^']+)'/gu)) {
      const ruleId = match[1]!
      const paths = fixturePaths.get(ruleId) ?? new Set<string>()
      paths.add(fixturePath)
      fixturePaths.set(ruleId, paths)
    }
  }
  return new Map(
    [...fixturePaths.entries()]
      .map(([ruleId, paths]) => [ruleId, [...paths].sort()] as const)
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function quoteFidelitySummary(
  ledger: string | null,
  expectedAuthorityEntryCount: number,
): CoverageReportManifest['quoteFidelity'] {
  if (ledger === null) return { status: 'no-committed-ledger' }
  const parsed: unknown = JSON.parse(ledger)
  if (!isRecord(parsed) || typeof parsed.generatedAt !== 'string' || !isRecord(parsed.counts)) {
    throw new Error('quote-fidelity ledger must contain generatedAt and verdict counts')
  }
  if (typeof parsed.entryCount !== 'number' || !Number.isFinite(parsed.entryCount)) {
    throw new Error('quote-fidelity ledger must contain a finite entryCount')
  }
  if (parsed.entryCount !== expectedAuthorityEntryCount) {
    throw new Error(
      'quote-fidelity ledger does not cover the whole registry (' +
        parsed.entryCount +
        ' entries vs ' +
        expectedAuthorityEntryCount +
        ' expected; filtered run or stale ledger)',
    )
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
      ' rules total). Comparing dueOn to today is deliberately excluded so this page stays deterministic; the planned rules:due runner (change-loop workstream) will flag overdue rules, and taxRulesDueForVerification() from @retiregolden/engine/rules answers the question programmatically today.',
    '',
    '| Rule | Volatility | Verified on | Due on |',
    '| --- | --- | --- | --- |',
    ...[...manifest.rules]
      .sort((left, right) => compareStrings(left.dueOn, right.dueOn) || compareStrings(left.id, right.id))
      .slice(0, 25)
      .map((rule) => markdownRow([rule.id, rule.volatility, rule.verifiedOn, rule.dueOn])),
    '',
    '## Quote fidelity',
    '',
  ]
  if ('status' in manifest.quoteFidelity) {
    lines.push(
      'No committed ledger — generate one with: pnpm verify:quotes -- --json > DOCS/operations/quote-fidelity-ledger.json (network required; see quote-fidelity.md).',
    )
  } else {
    lines.push('Committed ledger generated at ' + manifest.quoteFidelity.generatedAt + '.')
    lines.push('', '| Verdict | Count |', '| --- | ---: |')
    lines.push(...countRows(manifest.quoteFidelity.counts).map(([verdict, count]) => markdownRow([verdict, count])))
  }
  return lines.join('\n') + '\n'
}

/**
 * Environmental inputs enter at this boundary so committed artifacts reproduce
 * across machines without a filesystem read or clock observation.
 */
export function buildCoverageReport(input: CoverageReportInput): CoverageReport {
  const fixtureFiles = fixtureFilesByRule(input.testSources)
  const rules: readonly CoverageRule[] = Object.entries(input.registry)
    .map(([id, rule]) => ({
      id,
      classification: rule.classification,
      jurisdiction: rule.jurisdiction,
      volatility: rule.volatility,
      effectiveFrom: rule.effectiveFrom,
      effectiveThrough: rule.effectiveThrough,
      verifiedOn: rule.verifiedOn,
      dueOn: dateAfterDays(rule.verifiedOn, input.intervals[rule.volatility]),
      implementedBy: [...rule.implementedBy].sort(),
      fixtureFiles: fixtureFiles.get(id) ?? [],
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
  const expectedAuthorityEntryCount = Object.values(input.registry).reduce(
    (total, rule) => total + rule.authority.length,
    0,
  )
  const manifest: CoverageReportManifest = {
    kind: 'retiregolden.rules-coverage.manifest',
    version: 1,
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
    quoteFidelity: quoteFidelitySummary(input.quoteFidelityLedger, expectedAuthorityEntryCount),
  }
  return { manifest, markdown: buildMarkdown(manifest), json: JSON.stringify(manifest, null, 2) + '\n' }
}
