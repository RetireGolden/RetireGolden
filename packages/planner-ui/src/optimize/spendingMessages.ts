/**
 * Wire types between the "How much can I spend?" surface and its worker
 * (sustainable-spending plan, Step 4). Same rules as ./messages.ts: everything
 * must survive structured clone, so the solver's `bestEvaluation` (which holds
 * a full ProjectionResult) is summarized into `evidence` before posting.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import type { AcaSupportCode } from '@retiregolden/engine/projection/types'

export interface SpendingSolveRequest {
  plan: Plan
  startYear: number
  /** Exact-ledger simulation budget; defaults to SPENDING_SOLVER_UI_BUDGET. */
  maxSimulations?: number
}

/** Exact-ledger evidence for the plan run at the solved spending level. */
export interface SpendingSolveEvidence {
  endingAfterTaxEstate: number
  endingNetWorth: number
  lifetimeTaxesAndPenalties: number
  depletionYear: number | null
  endYear: number
}

export interface SpendingSolveResult {
  /** Highest feasible annual base spending (today's dollars), or null. */
  maxBaseAnnual: number | null
  /** maxBaseAnnual − current base spending (negative ⇒ overspending today). */
  spendingSlackDollars: number | null
  /** The plan's own base spending the slack is measured against. */
  currentBaseAnnual: number
  /** The bequest target the solve enforced (today's dollars; 0 = none). */
  estateFloorTodayDollars: number
  converged: boolean
  limitingConstraint: 'depletion' | 'estate-floor' | null
  simulationCount: number
  /**
   * Years whose ACA premium tax credit the projection could not price in the
   * run the answer rests on; that run pays the full Marketplace premium in
   * each. Empty when every Marketplace year is priced or there is none.
   */
  acaGrossPremiumYears: number[]
  /** Why those years are unpriced: the engine's support codes, distinct. */
  acaGrossPremiumReasons: AcaSupportCode[]
  diagnostics: string[]
  evidence: SpendingSolveEvidence | null
}

export type SpendingSolveResponse =
  | { type: 'done'; result: SpendingSolveResult }
  | { type: 'error'; message: string }
