/**
 * Shared-path stochastic comparisons.
 *
 * Every plan variant is evaluated with the same seed, path count, and market
 * model config, so path index N means the same market history for every row.
 * This is the reusable primitive for scenario/candidate stochastic deltas.
 */

import type { Plan } from '../model/plan.js'
import type { TaxCalculator } from '../projection/types.js'
import type { LtcShockParams } from './ltcShock.js'
import type { MarketModelConfig } from './marketModels.js'
import { createMarketModel } from './marketModels.js'
import { aggregateMonteCarlo, runMonteCarloPaths, type MonteCarloSummary } from './run.js'

export interface SharedPathPlan {
  id: string
  label: string
  plan: Plan
  /**
   * Per-entry tax stack, when variants need different calculators (e.g. the
   * relocation compare's per-candidate local rates). Falls back to the shared
   * `opts.taxCalculator`.
   */
  taxCalculator?: TaxCalculator
}

export interface SharedPathComparisonOptions {
  startYear: number
  taxCalculator: TaxCalculator
  model: MarketModelConfig
  pathCount: number
  seed: number
  stochasticLongevity?: boolean
  ltcShock?: LtcShockParams | null
}

export interface SharedPathComparisonRow {
  id: string
  label: string
  summary: MonteCarloSummary
}

export interface SharedPathComparison {
  seed: number
  pathCount: number
  rows: SharedPathComparisonRow[]
}

export function comparePlansOnSharedMarketPaths(
  plans: SharedPathPlan[],
  opts: SharedPathComparisonOptions,
): SharedPathComparison {
  return {
    seed: opts.seed,
    pathCount: opts.pathCount,
    rows: plans.map((entry) => ({
      id: entry.id,
      label: entry.label,
      summary: aggregateMonteCarlo(
        runMonteCarloPaths(entry.plan, {
          startYear: opts.startYear,
          taxCalculator: entry.taxCalculator ?? opts.taxCalculator,
          model: createMarketModel(opts.model),
          seed: opts.seed,
          pathCount: opts.pathCount,
          stochasticLongevity: opts.stochasticLongevity,
          ltcShock: opts.ltcShock,
        }),
      ),
    })),
  }
}
