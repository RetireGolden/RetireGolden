/**
 * Ledger-native decision engine — shared candidate/evaluation contract
 * (DOCS/enhancements/ledger-native-decision-engine.md, Phase 1).
 *
 * A candidate is a concrete, bounded change to the plan (a scenario-style
 * patch, a Roth conversion schedule, or both). Candidates are proposed by
 * generators (MILP, detectors, heuristics, search); they are never trusted
 * directly. `evaluateCandidate` runs every candidate through the exact ledger
 * (`simulatePlan`) against a shared baseline, and only that exact comparison
 * decides whether a candidate is beneficial.
 */

import type { Plan } from '../model/plan'
import type { ProjectionSummary } from '../projection/compare'
import type { SimulateOptions } from '../projection/simulate'
import type { ProjectionResult, TaxCalculator } from '../projection/types'

export type DecisionSource = 'milp' | 'detector' | 'heuristic' | 'scenario-sweep' | 'search'

export type DecisionCategory =
  | 'roth'
  | 'withdrawal'
  | 'social-security'
  | 'tax-cliff'
  | 'spending'
  | 'insurance'
  | 'geography'
  | 'asset-location'
  | 'guaranteed-income'

export interface DecisionCandidate {
  id: string
  source: DecisionSource
  category: DecisionCategory
  label: string
  explanation: string
  /**
   * Scenario-style deep-override of the plan (same merge semantics as
   * `applyScenarioPatch`: objects merge, arrays/primitives replace).
   */
  planPatch?: Record<string, unknown>
  /**
   * Explicit Roth conversion schedule, installed as an `optimized` strategy
   * after any planPatch is applied. Requested amounts — the exact ledger may
   * execute less (balance caps), which evaluation reports as diagnostics.
   */
  conversions?: Array<{ year: number; amount: number }>
  metadata?: Record<string, unknown>
}

/** Everything a generator or evaluator needs; baseline is computed once and shared. */
export interface DecisionContext {
  plan: Plan
  baselineResult: ProjectionResult
  baselineSummary: ProjectionSummary
  simulateOptions: SimulateOptions
  /**
   * Build the tax stack from a candidate's own (patched) plan instead of
   * pricing it with `simulateOptions.taxCalculator`. Needed when a candidate
   * patch changes tax assumptions (flat state-rate override, local rate) —
   * e.g. relocation previews — so the evaluation matches the surface that
   * proposed it. Absent ⇒ the shared calculator, as before.
   */
  taxCalculatorForPlan?: (plan: Plan) => TaxCalculator
}

export interface DecisionDeltas {
  endingAfterTaxEstate: number
  endingNetWorth: number
  lifetimeTax: number
  moneyLastsYears: number
}

export interface StochasticDecisionMetrics {
  pathCount: number
  seed: number
  successRate: number
  requiredFloorSuccessRate: number
  targetLifestyleSuccessRate: number
  p10EndingAfterTaxEstate: number
  medianEndingAfterTaxEstate: number
  expectedShortfallDollars: number
  averageTargetShortfallDollars: number
}

export interface StochasticDecisionAttachment {
  baseline: StochasticDecisionMetrics
  candidate: StochasticDecisionMetrics
  deltas: {
    successRate: number
    requiredFloorSuccessRate: number
    targetLifestyleSuccessRate: number
    p10EndingAfterTaxEstate: number
    medianEndingAfterTaxEstate: number
    expectedShortfallDollars: number
    averageTargetShortfallDollars: number
  }
}

/**
 * 'beneficial' | 'neutral' | 'rejected' come from the exact after-tax-estate
 * comparison. 'diagnostic' marks evaluations that must not become
 * recommendations for structural reasons: an invalid patch, or a conversion
 * schedule the ledger could not materially execute as requested.
 */
export type DecisionRecommendationState = 'beneficial' | 'neutral' | 'rejected' | 'diagnostic'

/** Requested-vs-executed accounting for conversion-schedule candidates. */
export interface ConversionExecution {
  requestedTotal: number
  executedTotal: number
  /** min(1, executed/requested); 1 when nothing was requested. */
  executedRatio: number
  firstMateriallyUnexecutedYear: number | null
  /** Per-year amounts the exact ledger actually executed (years > $1 only). */
  executedByYear: Array<{ year: number; amount: number }>
}

export interface ExactDecisionEvaluation {
  candidate: DecisionCandidate
  baselineSummary: ProjectionSummary
  candidateSummary: ProjectionSummary
  /** Full exact-ledger run for the candidate; not structured-clone-light — strip before posting to workers/UI. */
  candidateResult: ProjectionResult
  deltas: DecisionDeltas
  /** Present when the candidate carries (or its patch produces) a conversion schedule. */
  conversionExecution: ConversionExecution | null
  /** First year the candidate's own (non-inherited) traditional balance hits zero, when the plan has any. */
  traditionalDepletionYear: number | null
  /** Optional same-path Monte Carlo attachment for opt-in robust ranking. */
  stochastic?: StochasticDecisionAttachment
  diagnostics: string[]
  recommendationState: DecisionRecommendationState
}

export interface CandidateGenerator {
  id: string
  /** Pure and bounded: no simulate() calls, small fixed candidate count. */
  generate(ctx: DecisionContext): DecisionCandidate[]
}
