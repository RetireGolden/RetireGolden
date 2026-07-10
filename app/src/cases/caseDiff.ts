import type { CaseRunnerManifest, CaseRunResult } from './caseRunner'

export type CaseDiffMetric =
  | 'depletionYear'
  | 'endingAfterTaxEstate'
  | 'endingInvestable'
  | 'endingNetWorth'
  | 'lifetimeRothConversions'
  | 'lifetimeTaxesAndPenalties'
  | 'recommendationState'
  | 'warnings'

export interface CaseDiffAllow {
  caseId: string
  metric?: CaseDiffMetric
  reason?: string
}

export interface CaseDiffAllowlist {
  allowed: CaseDiffAllow[]
}

export interface CaseDifference {
  allowed: boolean
  baseValue: unknown
  caseId: string
  delta: number | null
  headValue: unknown
  metric: CaseDiffMetric | 'case'
  name: string
  reason: string | null
}

export interface CaseDiffResult {
  differences: CaseDifference[]
  unexpected: CaseDifference[]
}

const DIFF_METRICS: CaseDiffMetric[] = [
  'endingAfterTaxEstate',
  'endingInvestable',
  'endingNetWorth',
  'lifetimeTaxesAndPenalties',
  'lifetimeRothConversions',
  'depletionYear',
  'warnings',
  'recommendationState',
]

function caseMap(manifest: CaseRunnerManifest): Map<string, CaseRunResult> {
  return new Map(manifest.cases.map((row) => [row.id, row]))
}

function recommendationState(row: CaseRunResult): string | null {
  return row.decision?.winner?.recommendationState ?? null
}

function metricValue(row: CaseRunResult, metric: CaseDiffMetric): unknown {
  if (metric === 'warnings') return row.warnings
  if (metric === 'recommendationState') return recommendationState(row)
  return row.metrics[metric]
}

function valuesEqual(base: unknown, head: unknown): boolean {
  return JSON.stringify(base) === JSON.stringify(head)
}

function numericDelta(base: unknown, head: unknown): number | null {
  if (typeof base === 'number' && typeof head === 'number') return head - base
  return null
}

function allowReason(allowlist: CaseDiffAllowlist | undefined, caseId: string, metric: CaseDifference['metric']): string | null {
  const match = allowlist?.allowed.find((entry) => entry.caseId === caseId && (entry.metric === undefined || entry.metric === metric))
  return match?.reason ?? null
}

export function diffCaseManifests(
  base: CaseRunnerManifest,
  head: CaseRunnerManifest,
  allowlist?: CaseDiffAllowlist,
): CaseDiffResult {
  const differences: CaseDifference[] = []
  const baseCases = caseMap(base)
  const headCases = caseMap(head)
  const ids = [...new Set([...baseCases.keys(), ...headCases.keys()])].sort()

  for (const id of ids) {
    const baseRow = baseCases.get(id)
    const headRow = headCases.get(id)
    if (!baseRow || !headRow) {
      const reason = allowReason(allowlist, id, 'case')
      differences.push({
        allowed: reason !== null,
        baseValue: baseRow ? 'present' : 'missing',
        caseId: id,
        delta: null,
        headValue: headRow ? 'present' : 'missing',
        metric: 'case',
        name: baseRow?.name ?? headRow?.name ?? id,
        reason,
      })
      continue
    }

    for (const metric of DIFF_METRICS) {
      const baseValue = metricValue(baseRow, metric)
      const headValue = metricValue(headRow, metric)
      if (valuesEqual(baseValue, headValue)) continue
      const reason = allowReason(allowlist, id, metric)
      differences.push({
        allowed: reason !== null,
        baseValue,
        caseId: id,
        delta: numericDelta(baseValue, headValue),
        headValue,
        metric,
        name: headRow.name,
        reason,
      })
    }
  }

  return {
    differences,
    unexpected: differences.filter((difference) => !difference.allowed),
  }
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.length === 0 ? '[]' : JSON.stringify(value)
  if (value === null) return 'null'
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

function formatDifference(diff: CaseDifference): string {
  const delta = diff.delta === null ? '' : ` (delta ${diff.delta > 0 ? '+' : ''}${diff.delta.toLocaleString()})`
  const allowed = diff.allowed ? ` [allowed: ${diff.reason ?? 'listed'}]` : ''
  return `- ${diff.caseId} ${diff.metric}: ${formatValue(diff.baseValue)} -> ${formatValue(diff.headValue)}${delta}${allowed}`
}

export function formatCaseDiffSummary(result: CaseDiffResult): string {
  if (result.differences.length === 0) return 'No case deltas.'
  const unexpected = result.unexpected.map(formatDifference)
  const allowed = result.differences.filter((diff) => diff.allowed).map(formatDifference)
  const lines: string[] = []
  if (unexpected.length > 0) {
    lines.push(`Unexpected case deltas (${unexpected.length}):`, ...unexpected)
  } else {
    lines.push('No unexpected case deltas.')
  }
  if (allowed.length > 0) lines.push(`Allowed case deltas (${allowed.length}):`, ...allowed)
  return lines.join('\n')
}
