/**
 * Executes one optimize request. Shared by the Web Worker entry and the
 * synchronous fallback (tests / no-Worker environments) so both run the
 * identical tax stack — federal engine + per-state engine with the plan's flat
 * rate as an override, matching src/mc/runRequest.ts.
 */

import { objectivePolicyForPlan } from '../engine/decisions'
import {
  optimizePlan,
  optimizePlanCoOptimizingClaimAge,
  type ExactLedgerPostProcessing,
  type OptimizePlanOptions,
} from '../engine/projection/optimizePlan'
import { combineTaxCalculators, createFederalTaxCalculator } from '../engine/tax/federalTax'
import { createStateTaxCalculator } from '../engine/tax/stateTax'
import type { OptimizePostProcessing, OptimizeRequest, OptimizeResult } from './messages'

function summarizePostProcessing(postProcessed: ExactLedgerPostProcessing | null): OptimizePostProcessing | null {
  if (!postProcessed) return null
  return {
    rawSchedule: postProcessed.rawSchedule,
    cleanedSchedule: postProcessed.cleanedSchedule,
    rawValidation: postProcessed.rawValidation,
    cleanedValidation: postProcessed.cleanedValidation,
    adjustments: postProcessed.adjustments,
    stabilized: postProcessed.stabilized,
    iterationCount: postProcessed.iterationCount,
    pruneIterationCount: postProcessed.pruneIterationCount,
    recommendationSchedule: postProcessed.recommendationSchedule,
    cleanedExecutionByYear: postProcessed.cleanedResult.years.map((year) => ({
      year: year.year,
      rothConversion: year.rothConversion,
    })),
  }
}

/**
 * Production defaults for the optimize pipeline. Exported so the dev-only Owl
 * parity harness (src/cases/owlParity.ts) measures exactly what the worker
 * ships — a retune here automatically retunes the parity gate.
 */
export const DEFAULT_OPTIMIZE_SEARCH_BUDGET = 96
export const DEFAULT_OPTIMIZE_CONVERGENCE_ITERATIONS = 6

export async function runOptimizeRequest(
  req: OptimizeRequest,
  locateFile?: (file: string) => string,
): Promise<OptimizeResult> {
  const taxCalculator = combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: req.plan.assumptions.stateEffectiveTaxPct,
      localPct: req.plan.assumptions.localIncomeTaxPct,
    }),
  )
  // Phase 4 local search: refine the winning schedules on the exact ledger
  // under a bounded, deterministic per-seed simulation budget (enough for the
  // coarse+fine sweeps to also explore the bounded taper-extension years past
  // the seed schedule); zero or negative disables search entirely (the seed
  // evaluation would otherwise still cost one simulation).
  const searchBudget = req.searchSimulationBudget ?? DEFAULT_OPTIMIZE_SEARCH_BUDGET
  // Exact-ledger convergence loop (Step 1): re-solve against exogenous inputs
  // recaptured from the incumbent schedule so the recommendation is optimal on
  // the real projection to tolerance. Bounded iteration cap; the tournament
  // still prices and gates whatever the loop produces. `≤ 1` disables it.
  const convergenceIterations = req.convergenceIterations ?? DEFAULT_OPTIMIZE_CONVERGENCE_ITERATIONS
  const planOptions: OptimizePlanOptions = {
    startYear: req.startYear,
    taxCalculator,
    liquidationRatePct: req.liquidationRatePct,
    solver: { timeLimitSec: req.timeLimitSec, locateFile },
    search: searchBudget > 0 ? { maxSimulations: searchBudget } : false,
    convergence: convergenceIterations > 1 ? { maxIterations: convergenceIterations } : false,
    // Resolved here (not passed as a function) so the policy survives the
    // structured-clone worker boundary; floor policies read the plan's bequest target.
    policy: req.objectivePolicyId ? objectivePolicyForPlan(req.objectivePolicyId, req.plan) : undefined,
  }

  // Step 5: co-optimize the SS claim age when requested (opt-in; bounded grid).
  // The returned schedule may assume a claim change reported in `claimAge`.
  if (req.coOptimizeClaimAge) {
    const { schedule, postProcessed, tournament, convergence, claimAge } = await optimizePlanCoOptimizingClaimAge(
      req.plan,
      planOptions,
    )
    return { schedule, postProcessed: summarizePostProcessing(postProcessed), tournament, convergence, claimAge }
  }

  const { schedule, postProcessed, tournament, convergence } = await optimizePlan(req.plan, planOptions)
  return { schedule, postProcessed: summarizePostProcessing(postProcessed), tournament, convergence, claimAge: null }
}
