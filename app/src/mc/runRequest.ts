/**
 * Executes one Monte Carlo work unit. Shared by the Web Worker entry and the
 * pool's synchronous fallback so both paths run the identical tax stack:
 * the federal engine plus the per-state engine (with the plan's flat rate as
 * an override).
 */

import type { Plan } from '../engine/model/plan'
import { buildAnnuitizationSweep } from '../engine/decisions/annuitization'
import { buildRetirementAgeSuccessFrontier, buildSpendingSuccessFrontier } from '../engine/montecarlo/frontiers'
import {
  runHistoricalStressSuites,
  type HistoricalStressWindow,
} from '../engine/montecarlo/historicalSuites'
import { createMarketModel } from '../engine/montecarlo/marketModels'
import {
  solveRiskBasedGuardrails,
  type RiskBasedGuardrailSolution,
} from '../engine/montecarlo/riskBasedGuardrails'
import { runMonteCarloPaths, type MonteCarloPathsResult } from '../engine/montecarlo/run'
import { combineTaxCalculators, createFederalTaxCalculator } from '../engine/tax/federalTax'
import { createStateTaxCalculator } from '../engine/tax/stateTax'
import type {
  FrontierWorkerRequest,
  FrontierWorkerResult,
  HistoricalStressSuiteViewResult,
  HistoricalStressWindowView,
  HistoricalWorkerRequest,
  McWorkerRequest,
  RiskBasedWorkerRequest,
} from './messages'

function taxCalculatorForPlan(plan: Plan) {
  return combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: plan.assumptions.stateEffectiveTaxPct,
      localPct: plan.assumptions.localIncomeTaxPct,
    }),
  )
}

export function runMcRequest(req: McWorkerRequest, onPathDone?: (completed: number) => void): MonteCarloPathsResult {
  const taxCalculator = taxCalculatorForPlan(req.plan)
  return runMonteCarloPaths(req.plan, {
    startYear: req.startYear,
    taxCalculator,
    model: createMarketModel(req.model),
    seed: req.seed,
    pathCount: req.pathCount,
    firstPathIndex: req.firstPathIndex,
    stochasticLongevity: req.stochasticLongevity,
    ltcShock: req.ltcShock,
    onPathDone,
  })
}

export function runRiskBasedGuardrailRequest(
  req: RiskBasedWorkerRequest,
  onProbeDone?: (completed: number, total: number) => void,
): RiskBasedGuardrailSolution {
  return solveRiskBasedGuardrails(req.plan, {
    startYear: req.startYear,
    taxCalculator: taxCalculatorForPlan(req.plan),
    model: req.model,
    pathCount: req.pathCount,
    seed: req.seed,
    stochasticLongevity: req.stochasticLongevity,
    ltcShock: req.ltcShock,
    onProbeDone,
  })
}

export function runFrontierRequest(req: FrontierWorkerRequest): FrontierWorkerResult {
  const opts = {
    startYear: req.startYear,
    taxCalculator: taxCalculatorForPlan(req.plan),
    model: req.model,
    pathCount: req.pathCount,
    seed: req.seed,
    stochasticLongevity: req.stochasticLongevity,
    ltcShock: req.ltcShock,
  }
  return {
    spending: buildSpendingSuccessFrontier(req.plan, opts),
    retirement: buildRetirementAgeSuccessFrontier(req.plan, opts),
    annuitization: buildAnnuitizationSweep(req.plan, opts),
  }
}

function windowView(window: HistoricalStressWindow): HistoricalStressWindowView {
  return {
    suite: window.suite,
    label: window.label,
    startHistoricalYear: window.startHistoricalYear,
    endHistoricalYear: window.endHistoricalYear,
    reversed: window.reversed,
    success: window.success,
    projection: { depletionYear: window.projection.depletionYear },
    summary: { endingAfterTaxEstate: window.summary.endingAfterTaxEstate },
    totalShortfall: window.totalShortfall,
    totalRequiredShortfall: window.totalRequiredShortfall,
    totalTargetShortfall: window.totalTargetShortfall,
  }
}

export function runHistoricalStressSuiteRequest(req: HistoricalWorkerRequest): HistoricalStressSuiteViewResult {
  const result = runHistoricalStressSuites(req.plan, {
    startYear: req.startYear,
    taxCalculator: taxCalculatorForPlan(req.plan),
    equityWeightPct: req.equityWeightPct,
    classShocks: req.classShocks,
    worstWindowCount: req.worstWindowCount,
  })
  return {
    windowLengthYears: result.windowLengthYears,
    suites: result.suites.map((suite) => ({
      kind: suite.kind,
      name: suite.name,
      windowLengthYears: suite.windowLengthYears,
      worstByEndingAfterTaxEstate: suite.worstByEndingAfterTaxEstate.map(windowView),
      worstByTotalShortfall: suite.worstByTotalShortfall.map(windowView),
    })),
  }
}
