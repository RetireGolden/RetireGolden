/**
 * Bounded stochastic frontier sweeps.
 *
 * The helpers build ordinary plan variants and evaluate them through the
 * shared-path primitive. They do not search; callers provide small fixed grids.
 */

import type { Plan } from '../model/plan'
import {
  comparePlansOnSharedMarketPaths,
  type SharedPathComparisonOptions,
  type SharedPathPlan,
} from './sharedPaths'

export const MAX_FRONTIER_POINTS = 15

export interface StochasticFrontierPoint {
  id: string
  label: string
  x: number
  successRate: number
  requiredFloorSuccessRate: number
  targetLifestyleSuccessRate: number
  p10EndingAfterTaxEstate: number
  medianEndingAfterTaxEstate: number
  expectedShortfallDollars: number
}

function assertBounded(pointCount: number): void {
  if (pointCount > MAX_FRONTIER_POINTS) {
    throw new Error(`Frontier sweeps are capped at ${MAX_FRONTIER_POINTS} points; received ${pointCount}.`)
  }
}

function pointFromRow(id: string, label: string, x: number, row: ReturnType<typeof comparePlansOnSharedMarketPaths>['rows'][number]): StochasticFrontierPoint {
  return {
    id,
    label,
    x,
    successRate: row.summary.successRate,
    requiredFloorSuccessRate: row.summary.requiredFloorSuccessRate,
    targetLifestyleSuccessRate: row.summary.targetLifestyleSuccessRate,
    p10EndingAfterTaxEstate: row.summary.endingAfterTaxEstate.percentiles.p10,
    medianEndingAfterTaxEstate: row.summary.endingAfterTaxEstate.percentiles.p50,
    expectedShortfallDollars: row.summary.downsideRisk.expectedShortfallDollars,
  }
}

export function buildSpendingSuccessFrontier(
  plan: Plan,
  opts: SharedPathComparisonOptions,
  multipliers: readonly number[] = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15],
): StochasticFrontierPoint[] {
  assertBounded(multipliers.length)
  const variants: SharedPathPlan[] = multipliers.map((multiplier) => {
    const baseAnnual = Math.max(0, Math.round(plan.expenses.baseAnnual * multiplier))
    const pct = Math.round(multiplier * 100)
    return {
      id: `spending-${pct}`,
      label: `${pct}% spending`,
      plan: { ...plan, expenses: { ...plan.expenses, baseAnnual } },
    }
  })
  const comparison = comparePlansOnSharedMarketPaths(variants, opts)
  return comparison.rows.map((row, index) => pointFromRow(row.id, row.label, variants[index]!.plan.expenses.baseAnnual, row))
}

export function buildRetirementAgeSuccessFrontier(
  plan: Plan,
  opts: SharedPathComparisonOptions,
  deltas: readonly number[] = [-2, -1, 0, 1, 2],
): StochasticFrontierPoint[] {
  assertBounded(deltas.length)
  const variants: Array<SharedPathPlan & { x: number }> = deltas.map((delta) => {
    const people = plan.household.people.map((person) => ({
      ...person,
      retirementAge: person.retirementAge === null ? null : Math.min(80, Math.max(30, person.retirementAge + delta)),
    }))
    const changedAges = people
      .map((person) => person.retirementAge)
      .filter((age): age is number => age !== null)
    const x = changedAges.length > 0 ? Math.min(...changedAges) : 0
    return {
      id: `retirement-${delta >= 0 ? 'plus' : 'minus'}-${Math.abs(delta)}`,
      label: delta === 0 ? 'Current retirement age' : `${Math.abs(delta)}y ${delta < 0 ? 'earlier' : 'later'}`,
      plan: { ...plan, household: { ...plan.household, people } },
      x,
    }
  })
  const comparison = comparePlansOnSharedMarketPaths(variants, opts)
  return comparison.rows.map((row, index) => pointFromRow(row.id, row.label, variants[index]!.x ?? 0, row))
}
