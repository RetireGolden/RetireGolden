/**
 * Capture-after-commit publisher for `YearResult.cashFlow`.
 *
 * Stage 1 emits no physical lines. `assembleYearCashFlow` still runs on every
 * capture-on committed year so `yearResult` shape is stable (`cashFlow`
 * present iff the option is on) and the incomplete-inventory heuristic can
 * refuse a lying 0=0 `reconciled` status for a nonempty year.
 *
 * @see DOCS/features/year-cash-flow.md
 */

import {
  type CashFlowIncompleteInventoryProbes,
  reconcileYearCashFlow,
} from './annualCashFlowReconciliation.js'
import type {
  YearCashFlow,
  YearCashFlowSourceLine,
  YearCashFlowStandaloneTaxCharacter,
  YearCashFlowTransferLine,
  YearCashFlowUseLine,
} from './types.js'

/**
 * Applied engine floating-point tolerance for both conservation identities
 * and the stage-1–4 incomplete-inventory probes. Not display rounding, not
 * funding `EPSILON` (0.005), not Monte Carlo `SHORTFALL_EPSILON` (0.5).
 * Compare with `Math.abs(difference) > tolerance` (strict greater than).
 */
export const CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS = 1e-6

/**
 * Values `assembleYearCashFlow` may read at stage 1: the committed economic
 * scalars the incomplete-inventory heuristic probes. Later stages widen this
 * with year-site snapshots, pass-local maps, and surviving economic structures.
 * It does not close over `simulatePlan` or `evaluateWithdrawalNeed`.
 */
export type AssembleYearCashFlowInput = CashFlowIncompleteInventoryProbes

/**
 * Publish one year's cash-flow report from frozen committed scalars.
 * Stage 1: empty line arrays plus an honest reconciliation status.
 */
export function assembleYearCashFlow(input: AssembleYearCashFlowInput): YearCashFlow {
  const sourceLines: readonly YearCashFlowSourceLine[] = []
  const useLines: readonly YearCashFlowUseLine[] = []
  const transferLines: readonly YearCashFlowTransferLine[] = []
  const taxCharacterMetadata: readonly YearCashFlowStandaloneTaxCharacter[] = []
  return {
    sourceLines,
    useLines,
    transferLines,
    taxCharacterMetadata,
    reconciliation: reconcileYearCashFlow({
      sourceLines,
      useLines,
      transferLines,
      probes: input,
      tolerancePlanDollars: CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
    }),
  }
}
