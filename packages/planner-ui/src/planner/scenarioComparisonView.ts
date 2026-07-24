import type { ScenarioPlanComparison } from '@retiregolden/engine/scenarios/comparison'
import type { Plan } from '@retiregolden/engine/model/plan'
import { canonicalScenarioJson } from '@retiregolden/engine/scenarios/patch'
import { fmtMoneyCompact } from './format'

export type MetricFormat = 'money' | 'percent' | 'number' | 'year' | 'depletionYear'

export function scenarioOverviewRequestKey(
  baselineSnapshotHash: string,
  scenarios: Plan['scenarios'],
  startYear: number,
): string {
  return `${baselineSnapshotHash}:${startYear}:${canonicalScenarioJson(scenarios)}`
}

export function isScenarioComparisonCurrent(
  comparison: ScenarioPlanComparison,
  baselineSnapshotHash: string,
  proposalSnapshotHash: string,
  startYear: number,
): boolean {
  return (
    comparison.provenance.baselineSnapshotHash === baselineSnapshotHash &&
    comparison.provenance.proposalSnapshotHash === proposalSnapshotHash &&
    comparison.provenance.startYear === startYear
  )
}

export function formatMetricValue(value: number | null, format: MetricFormat): string {
  if (format === 'depletionYear') return value === null ? 'never' : String(Math.round(value))
  if (value === null) return '—'
  if (format === 'money') return fmtMoneyCompact(value)
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`
  if (format === 'year') return String(Math.round(value))
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

export function formatScenarioDelta(value: number | null, format: MetricFormat): string {
  if (value === null) return '—'
  if (value === 0) return format === 'percent' ? '0.0 pp' : format === 'money' ? '$0' : '0'
  const sign = value > 0 ? '+' : '−'
  const absolute = Math.abs(value)
  if (format === 'money') return `${sign}${fmtMoneyCompact(absolute)}`
  if (format === 'percent') return `${sign}${(absolute * 100).toFixed(1)} pp`
  if (format === 'year' || format === 'depletionYear') {
    const rounded = Math.round(absolute)
    return `${sign}${rounded} ${rounded === 1 ? 'year' : 'years'}`
  }
  return `${sign}${absolute.toLocaleString('en-US', { maximumFractionDigits: 1 })}`
}

export function spendingCapacityStatus(maxBaseAnnual: number | null, converged: boolean): string {
  if (maxBaseAnnual === null) return 'Unavailable'
  return converged ? 'Converged maximum' : 'Feasible lower bound'
}
