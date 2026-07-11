import type { OptimizedSchedule } from '@retiregolden/engine/strategies/optimizer'
import type { OptimizePostProcessing } from '../optimize/messages'

export interface OptimizeChartRow {
  year: number
  requested: number
  cleaned: number
  executed: number
}

export function buildOptimizeChartRows({
  schedule,
  recommendedConversions,
  postProcessed,
  candidateWins,
}: {
  schedule: OptimizedSchedule | null
  recommendedConversions: { year: number; amount: number }[]
  postProcessed: OptimizePostProcessing | null
  candidateWins: boolean
}): OptimizeChartRow[] {
  const rawByYear = new Map(schedule?.conversions.map((c) => [c.year, c.amount]) ?? [])
  const cleanedByYear = new Map(recommendedConversions.map((c) => [c.year, c.amount]))
  // A winning candidate's schedule is its exact-ledger execution; the MILP path
  // reports the cleaned re-run's executed amounts.
  const executedByYear = candidateWins
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
