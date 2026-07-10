/**
 * Executes one sustainable-spending solve. Shared by the Web Worker entry and
 * the synchronous fallback (tests / no-Worker environments) so both run the
 * identical tax stack — federal engine + per-state engine with the plan's flat
 * rate as an override, matching ./runOptimize.ts.
 */

import { createDecisionContext, solveMaxSustainableSpending, SPENDING_SOLVER_UI_BUDGET } from '../engine/decisions'
import { combineTaxCalculators, createFederalTaxCalculator } from '../engine/tax/federalTax'
import { createStateTaxCalculator } from '../engine/tax/stateTax'
import type { SpendingSolveRequest, SpendingSolveResult } from './spendingMessages'

export function runSpendingSolveRequest(req: SpendingSolveRequest): SpendingSolveResult {
  const taxCalculator = combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: req.plan.assumptions.stateEffectiveTaxPct,
      localPct: req.plan.assumptions.localIncomeTaxPct,
    }),
  )
  const ctx = createDecisionContext(req.plan, { startYear: req.startYear, taxCalculator })
  const estateFloorTodayDollars = req.plan.expenses.bequestTargetDollars ?? 0
  const solved = solveMaxSustainableSpending(ctx, {
    maxSimulations: req.maxSimulations ?? SPENDING_SOLVER_UI_BUDGET,
    estateFloorTodayDollars,
  })
  const summary = solved.bestEvaluation?.candidateSummary ?? null
  return {
    maxBaseAnnual: solved.maxBaseAnnual,
    spendingSlackDollars: solved.spendingSlackDollars,
    currentBaseAnnual: req.plan.expenses.baseAnnual,
    estateFloorTodayDollars,
    converged: solved.converged,
    limitingConstraint: solved.limitingConstraint,
    simulationCount: solved.simulationCount,
    diagnostics: solved.diagnostics,
    evidence: summary
      ? {
          endingAfterTaxEstate: summary.endingAfterTaxEstate,
          endingNetWorth: summary.endingNetWorth,
          lifetimeTaxesAndPenalties: summary.lifetimeTaxesAndPenalties,
          depletionYear: solved.bestEvaluation!.candidateResult.depletionYear,
          endYear: solved.bestEvaluation!.candidateResult.endYear,
        }
      : null,
  }
}
