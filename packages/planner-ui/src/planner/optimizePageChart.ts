import type { OptimizedSchedule } from '@retiregolden/engine/strategies/optimizer'
import type { ExactLedgerTournament } from '@retiregolden/engine/projection/optimizePlan'
import type { OptimizePostProcessing } from '../optimize/messages'

export interface OptimizeChartRow {
  year: number
  requested: number
  cleaned: number
  executed: number
}

export function actionableTournamentConversions(
  tournament: Pick<ExactLedgerTournament, 'winnerSource' | 'winnerConversions'> | null,
): { year: number; amount: number }[] {
  return tournament?.winnerSource === 'candidate' || tournament?.winnerSource === 'milp'
    ? tournament.winnerConversions
    : []
}

export function isCalculatedIdentityWithheldPostProcessing(
  postProcessed: OptimizePostProcessing | null,
): boolean {
  if (
    postProcessed === null ||
    !postProcessed.stabilized ||
    postProcessed.cleanedValidation.recommendationState !== 'identityIncomplete'
  ) return false
  const cleanedTotal = postProcessed.cleanedSchedule.conversions.reduce(
    (sum, conversion) => sum + conversion.amount,
    0,
  )
  return cleanedTotal >= postProcessed.minimumRequestedConversionDollars
}

export function displayedCleanedConversions(
  tournament: Pick<
    ExactLedgerTournament,
    'winnerSource' | 'winnerConversions' | 'retirementActionReadinessVeto'
  > | null,
  postProcessed: OptimizePostProcessing | null,
): { year: number; amount: number }[] {
  const withheld = tournament?.retirementActionReadinessVeto?.vetoedConversions
  if (withheld && withheld.length > 0) return withheld
  const actionable = actionableTournamentConversions(tournament)
  if (actionable.length > 0) return actionable
  if (tournament?.winnerSource !== 'none') return []
  return isCalculatedIdentityWithheldPostProcessing(postProcessed)
    ? postProcessed!.cleanedSchedule.conversions
    : []
}

export function displayedScheduleAlreadyExecuted(
  tournament: Pick<
    ExactLedgerTournament,
    'winnerSource' | 'searchRefined' | 'retirementActionReadinessVeto'
  > | null,
): boolean {
  if (tournament?.winnerSource === 'candidate') return true
  const withheldSource = tournament?.retirementActionReadinessVeto?.vetoedWinnerSource
  return withheldSource === 'candidate' ||
    (withheldSource === 'milp' && tournament?.searchRefined === true)
}

export function monteCarloSuccessValue(
  hasRecommendationPlan: boolean,
  successRate: number | null,
): string {
  if (!hasRecommendationPlan) return 'Unavailable'
  return successRate === null ? '…' : `${Math.round(successRate * 100)}%`
}

export function buildOptimizeChartRows({
  schedule,
  recommendedConversions,
  postProcessed,
  displayedScheduleAlreadyExecuted,
}: {
  schedule: OptimizedSchedule | null
  recommendedConversions: { year: number; amount: number }[]
  postProcessed: OptimizePostProcessing | null
  displayedScheduleAlreadyExecuted: boolean
}): OptimizeChartRow[] {
  const rawByYear = new Map(schedule?.conversions.map((c) => [c.year, c.amount]) ?? [])
  const cleanedByYear = new Map(recommendedConversions.map((c) => [c.year, c.amount]))
  // A candidate schedule, or a search-refined withheld MILP schedule, already
  // consists of exact-ledger executed amounts. An unrefined MILP path instead
  // reports the cleaned re-run's stored execution evidence.
  const executedByYear = displayedScheduleAlreadyExecuted
    ? cleanedByYear
    : new Map(postProcessed?.cleanedExecutionByYear.map((year) => [year.year, year.rothConversion]) ?? [])
  const years = [...new Set([...rawByYear.keys(), ...cleanedByYear.keys()])].sort((a, b) => a - b)
  return years.map((year) => ({
    year,
    requested: Math.round(rawByYear.get(year) ?? 0),
    cleaned: Math.round(cleanedByYear.get(year) ?? 0),
    executed: Math.round(executedByYear.get(year) ?? 0),
  }))
}

export function shouldShowRecommendedScheduleBars(candidateWins: boolean, hasExecutionMismatch: boolean): boolean {
  return candidateWins || hasExecutionMismatch
}
