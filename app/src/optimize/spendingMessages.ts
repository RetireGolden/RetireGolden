/**
 * Wire types between the "How much can I spend?" surface and its worker
 * (sustainable-spending plan, Step 4). Same rules as ./messages.ts: everything
 * must survive structured clone, so the solver's `bestEvaluation` (which holds
 * a full ProjectionResult) is summarized into `evidence` before posting.
 */

import type { Plan } from '../engine/model/plan'

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
  diagnostics: string[]
  evidence: SpendingSolveEvidence | null
}

export type SpendingSolveResponse =
  | { type: 'done'; result: SpendingSolveResult }
  | { type: 'error'; message: string }
