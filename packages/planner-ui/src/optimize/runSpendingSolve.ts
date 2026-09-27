/**
 * Executes one sustainable-spending solve. Shared by the Web Worker entry and
 * the synchronous fallback (tests / no-Worker environments) so both run the
 * identical tax stack — federal engine + per-state engine with the plan's flat
 * rate as an override, matching ./runOptimize.ts.
 */

import { createDecisionContext, solveMaxSustainableSpending, SPENDING_SOLVER_UI_BUDGET } from '@retiregolden/engine/decisions'
import { projectionDollarBasis, toTodayDollars } from '@retiregolden/engine/projection/dollarBasis'
import { taxCalculatorFor } from '../planTaxCalculator'
import type { SpendingSolveRequest, SpendingSolveResult } from './spendingMessages'

export function runSpendingSolveRequest(req: SpendingSolveRequest): SpendingSolveResult {
  const taxCalculator = taxCalculatorFor(req.plan)
  const ctx = createDecisionContext(req.plan, { startYear: req.startYear, taxCalculator })
  const estateFloorTodayDollars = req.plan.expenses.bequestTargetDollars ?? 0
  const solved = solveMaxSustainableSpending(ctx, {
    maxSimulations: req.maxSimulations ?? SPENDING_SOLVER_UI_BUDGET,
    estateFloorTodayDollars,
  })
  const summary = solved.bestEvaluation?.candidateSummary ?? null
  const run = solved.bestEvaluation?.candidateResult ?? null
  return {
    maxBaseAnnual: solved.maxBaseAnnual,
    spendingSlackDollars: solved.spendingSlackDollars,
    feasibleBaseAnnual: solved.feasibleBaseAnnual,
    sustainsCurrentBase: solved.sustainsCurrentBase,
    maxBaseAnnualRounding: solved.maxBaseAnnualRounding,
    initialWithdrawalRatePct: solved.initialWithdrawalRatePct,
    currentBaseAnnual: req.plan.expenses.baseAnnual,
    estateFloorTodayDollars,
    converged: solved.converged,
    limitingConstraint: solved.limitingConstraint,
    simulationCount: solved.simulationCount,
    zeroSpendingDepletes: solved.zeroSpendingDepletes,
    acaGrossPremiumYears: solved.acaGrossPremiumYears,
    acaGrossPremiumReasons: solved.acaGrossPremiumReasons,
    acaGrossPremiumDirection: solved.acaGrossPremiumDirection,
    diagnostics: solved.diagnostics,
    evidence:
      summary && run
        ? {
            endingAfterTaxEstate: summary.endingAfterTaxEstate,
            // In today's dollars by the answer run's own inflation factor, so
            // the page divides by nothing itself. A run with no years (its
            // horizon ends before it starts) has no factor, and none is set.
            ...(run.years.length === 0
              ? {}
              : {
                  endingAfterTaxEstateTodayDollars: toTodayDollars(
                    projectionDollarBasis(run),
                    run.endYear,
                    summary.endingAfterTaxEstate,
                  ),
                }),
            endingNetWorth: summary.endingNetWorth,
            lifetimeTaxesAndPenalties: summary.lifetimeTaxesAndPenalties,
            depletionYear: run.depletionYear,
            endYear: run.endYear,
          }
        : null,
  }
}
