import type { ScenarioPlanComparison } from '@retiregolden/engine/scenarios/comparison'
import type { Plan } from '@retiregolden/engine/model/plan'
import { canonicalScenarioJson } from '@retiregolden/engine/scenarios/patch'
import { NonFiniteComparisonError } from '@retiregolden/engine/scenarios/scalarComparison'
import { fmtMoneyCompact } from './format'

export type MetricFormat = 'money' | 'percent' | 'number' | 'year' | 'depletionYear'

export function scenarioOverviewRequestKey(
  baselineSnapshotHash: string,
  scenarios: Plan['scenarios'],
  startYear: number,
): string {
  return `${baselineSnapshotHash}:${startYear}:${canonicalScenarioJson(scenarios)}`
}

/**
 * The detail comparison's error line when the engine refuses the comparison
 * because a figure is not a finite number (PR #754 finding 6): which side and
 * what to check, in plain words. Any other error keeps its own message.
 */
export function scenarioDetailError(error: unknown): string {
  if (error instanceof NonFiniteComparisonError) {
    const lead = "This scenario can't be compared with your plan: "
    if (error.role === 'baseline') {
      return `${lead}one of your plan's figures could not be computed. Check your plan's Results page, then compare again.`
    }
    if (error.role === 'proposal') {
      return `${lead}one of the scenario's figures could not be computed. Check the scenario's changes, then compare again.`
    }
    return `${lead}the difference between their figures could not be computed. Check the scenario's changes, then compare again.`
  }
  return error instanceof Error ? error.message : 'The comparison could not be completed.'
}

/**
 * The overview table's line when the side-by-side run fails, in plain words
 * with a next step, instead of leaving the table's placeholder up for good
 * (PR #754 finding 6).
 */
export function scenarioOverviewError(error: unknown): string {
  const what =
    error instanceof NonFiniteComparisonError
      ? 'one of the figures could not be computed'
      : 'the side-by-side run could not be completed'
  return `The scenarios can't be compared right now: ${what}. Check each scenario's changes, then open this page again.`
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

/**
 * Whether a side's own base spending passes, from its solve's first probe
 * (`sustainsCurrentBase`), never from the sign of its slack: the published
 * amount is rounded down to $100, so a slack between −$100 and $0 can sit
 * beside a base that is sustained. Undefined for a comparison built from a
 * result that does not carry the verdict.
 */
export function currentBaseVerdict(sustainsCurrentBase: boolean | null | undefined): string {
  if (sustainsCurrentBase === true) return 'Sustained'
  if (sustainsCurrentBase === false) return 'Not sustained'
  return 'Not judged'
}
