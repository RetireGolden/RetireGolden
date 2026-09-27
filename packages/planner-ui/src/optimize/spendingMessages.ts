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

/** Exact-ledger evidence for the plan run at the level that passed (`feasibleBaseAnnual`). */
export interface SpendingSolveEvidence {
  endingAfterTaxEstate: number
  /**
   * The same estate in start-year (today's) dollars, divided by that run's own
   * inflation factor for its end year. Optional on the wire so results built
   * before it existed still type-check; the worker always sets it.
   */
  endingAfterTaxEstateTodayDollars?: number
  endingNetWorth: number
  lifetimeTaxesAndPenalties: number
  depletionYear: number | null
  endYear: number
}

export interface SpendingSolveResult {
  /**
   * The solver's published answer (today's dollars), or null: the amount the
   * page shows, applies and measures slack from. Rounded down to a whole $100
   * unless `maxBaseAnnualRounding` is 'none'.
   */
  maxBaseAnnual: number | null
  /**
   * maxBaseAnnual − current base spending. Negative means the published amount
   * is below today's base, which by less than $100 can still be a plan whose
   * own spending passes (the amount is rounded down); `sustainsCurrentBase`
   * says whether it does.
   */
  spendingSlackDollars: number | null
  /**
   * The highest level that passed (a whole dollar). The next four fields are
   * optional on the wire so results built before they existed still
   * type-check; the worker always sets them.
   */
  feasibleBaseAnnual?: number | null
  /**
   * Whether today's base spending passes (the solve's first probe, at the
   * current base rounded to a whole dollar or the required floor rounded up);
   * null when no probe could be evaluated.
   */
  sustainsCurrentBase?: boolean | null
  /**
   * 'down-to-hundred' when maxBaseAnnual is feasibleBaseAnnual rounded down to
   * a whole $100; 'none' when it is feasibleBaseAnnual itself, because under
   * guardrail spending the rounded amount was run and failed (or would fall
   * below the required floor). Null with no answer.
   */
  maxBaseAnnualRounding?: 'down-to-hundred' | 'none' | null
  /** maxBaseAnnual as a percent of today's investable balances; null when those are not positive. */
  initialWithdrawalRatePct?: number | null
  /** The plan's own base spending the slack is measured against. */
  currentBaseAnnual: number
  /** The bequest target the solve enforced (today's dollars; 0 = none). */
  estateFloorTodayDollars: number
  converged: boolean
  limitingConstraint: 'depletion' | 'estate-floor' | null
  simulationCount: number
  /** True only when the solve ran a probe at zero base spending and it depleted. */
  zeroSpendingDepletes: boolean
  /**
   * Years whose ACA premium tax credit the projection could not price in the
   * run the answer rests on; that run pays the full Marketplace premium in
   * each. Empty when every Marketplace year is priced or there is none.
   */
  acaGrossPremiumYears: number[]
  /** Why those years are unpriced: the engine's blocking support codes, distinct. */
  acaGrossPremiumReasons: AcaSupportCode[]
  /**
   * Which way a credit in those years would move the answer: 'conservative'
   * at fixed-target spending, 'uncertain' under guardrails; null when none.
   */
  acaGrossPremiumDirection: 'conservative' | 'uncertain' | null
  diagnostics: string[]
  evidence: SpendingSolveEvidence | null
}

export type SpendingSolveResponse =
  | { type: 'done'; result: SpendingSolveResult }
  | { type: 'error'; message: string }
