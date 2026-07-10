/**
 * Wire types between the Optimize UI and its worker (roadmap V8). Everything
 * here must survive structured clone — note the tax calculator is NOT passed
 * (it's a closure); the worker rebuilds the standard stack from the plan, just
 * like the Monte Carlo worker (see src/mc/runRequest.ts).
 */

import type { ObjectivePolicyId } from '../engine/decisions'
import type { Plan } from '../engine/model/plan'
import type {
  ClaimAgeCoOptimization,
  ExactLedgerConvergenceDiagnostics,
  ExactLedgerRecommendationSchedule,
  ExactLedgerScheduleAdjustment,
  ExactLedgerTournament,
  ExactLedgerValidation,
} from '../engine/projection/optimizePlan'
import type { OptimizedSchedule } from '../engine/strategies/optimizer'

export interface OptimizeRequest {
  plan: Plan
  startYear: number
  /** Haircut on leftover traditional; defaults to the plan's heirTaxRatePct. */
  liquidationRatePct?: number
  /** HiGHS time limit (seconds). */
  timeLimitSec?: number
  /**
   * Exact-ledger local-search budget for refining winning schedules. Omitted =
   * default 96 simulations. This is a PER-SEED budget: search refines the top
   * two candidates (and a winning MILP schedule), so total search simulations
   * can reach ~2–3× this value. 0 or negative disables search.
   */
  searchSimulationBudget?: number
  /**
   * Objective policy the tournament ranks by. Omitted = `max-after-tax-estate`
   * (the original behavior). Floor-style policies pick up the plan's bequest
   * target inside the worker (`objectivePolicyForPlan`).
   */
  objectivePolicyId?: ObjectivePolicyId
  /**
   * Exact-ledger convergence-loop iteration cap (optimizer-exact-ledger-convergence Track 1, Step 1).
   * Omitted = worker default; `≤ 1` disables the loop (single solve = the
   * pre-convergence schedule).
   */
  convergenceIterations?: number
  /**
   * Co-optimize the SS claim age with the conversion optimum
   * (optimizer-exact-ledger-convergence Track 1, Step 5). Off by default: it runs a bounded alternate-minimization over the
   * claim grid (a small multiple of a single optimize) and can recommend a claim
   * change alongside the schedule, so the caller must surface `claimAge` when on.
   */
  coOptimizeClaimAge?: boolean
}

export interface OptimizeResult {
  schedule: OptimizedSchedule
  postProcessed: OptimizePostProcessing | null
  /** Bounded simple-candidate tournament; contains no ProjectionResult, so it is structured-clone safe as-is. */
  tournament: ExactLedgerTournament
  /** Convergence-loop diagnostics (Step 1); plain scalars, structured-clone safe. */
  convergence: ExactLedgerConvergenceDiagnostics
  /**
   * Claim-age co-optimization diagnostics (Step 5); null unless requested. The
   * `winningClaimPatch` (a plain incomes array) is structured-clone safe.
   */
  claimAge: ClaimAgeCoOptimization | null
}

export interface OptimizePostProcessing {
  rawSchedule: OptimizedSchedule
  cleanedSchedule: OptimizedSchedule
  rawValidation: ExactLedgerValidation
  cleanedValidation: ExactLedgerValidation
  adjustments: ExactLedgerScheduleAdjustment[]
  stabilized: boolean
  iterationCount: number
  pruneIterationCount: number
  recommendationSchedule: ExactLedgerRecommendationSchedule
  cleanedExecutionByYear: { year: number; rothConversion: number }[]
}

export type OptimizeResponse =
  | { type: 'done'; result: OptimizeResult }
  | { type: 'error'; message: string }
