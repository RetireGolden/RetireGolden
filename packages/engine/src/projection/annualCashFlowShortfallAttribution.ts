/**
 * Pure residual shortfall attribution for annual cash-flow use lines.
 *
 * Starts from ledger-attempted funded amounts (guardrail cuts, skipped goals,
 * contribution caps already reflected as own-line unfunded) and then applies
 * `shortfallAfterHecm` in contract order: excess → ideal → target → required,
 * then settled tax, then penalties, then contributions last. Surplus is never
 * reduced. Leftover remaining after the contribution group is returned, not
 * plugged — assemble then fails the cash identity rather than inventing Other.
 *
 * Does not call `simulatePlan` / `evaluateWithdrawalNeed` and does not rewrite
 * `YearResult` layer scalars.
 *
 * @see DOCS/features/year-cash-flow.md (deterministic-attribution paragraph)
 */

import type { YearCashFlowLineId } from './types.js'

export type CashFlowShortfallLayer =
  | 'excess'
  | 'ideal'
  | 'target'
  | 'required'
  | 'tax'
  | 'penalty'
  | 'contribution'
  | 'surplus'

export interface CashFlowShortfallLineInput {
  readonly id: YearCashFlowLineId
  readonly layer: CashFlowShortfallLayer
  readonly requestedPlanDollars: number
  /** Ledger-attempted, before the portfolio/HECM residual. */
  readonly attemptedFundedPlanDollars: number
}

export interface YearCashFlowUseLineFunding {
  readonly id: YearCashFlowLineId
  readonly requestedPlanDollars: number
  readonly fundedPlanDollars: number
  readonly unfundedPlanDollars: number
}

export interface AttributeCashFlowShortfallInput {
  readonly lines: readonly CashFlowShortfallLineInput[]
  readonly shortfallAfterHecm: number
}

export interface AttributeCashFlowShortfallResult {
  readonly lines: readonly YearCashFlowUseLineFunding[]
  /** > 0 means a need term had no use line. Assemble must not plug Other. */
  readonly remainingUnattributed: number
}

const SPENDING_LAYERS: readonly CashFlowShortfallLayer[] = [
  'excess',
  'ideal',
  'target',
  'required',
]

const NON_SPENDING_LAYERS: readonly CashFlowShortfallLayer[] = [
  'tax',
  'penalty',
  'contribution',
]

interface WorkingLine {
  id: YearCashFlowLineId
  layer: CashFlowShortfallLayer
  requestedPlanDollars: number
  fundedPlanDollars: number
  unfundedPlanDollars: number
}

/**
 * Apply `take` of residual shortfall to `layer` candidates, pro rata by each
 * line's current funded amount. The last candidate in input order receives the
 * IEEE residue so the group's take sums exactly.
 */
function applyLayerResidual(working: WorkingLine[], layer: CashFlowShortfallLayer, remaining: number): number {
  if (remaining <= 0) return remaining
  const idxs: number[] = []
  for (let i = 0; i < working.length; i++) {
    if (working[i]!.layer === layer && working[i]!.fundedPlanDollars > 0) idxs.push(i)
  }
  if (idxs.length === 0) return remaining
  const weights = idxs.map((i) => working[i]!.fundedPlanDollars)
  let totalWeight = 0
  for (const weight of weights) totalWeight += weight
  const take = Math.min(remaining, totalWeight)
  if (take <= 0) return remaining
  let assigned = 0
  for (let k = 0; k < idxs.length; k++) {
    const line = working[idxs[k]!]!
    const isLast = k === idxs.length - 1
    const cut = isLast ? take - assigned : take * (weights[k]! / totalWeight)
    const actual = Math.min(line.fundedPlanDollars, Math.max(0, cut))
    line.fundedPlanDollars -= actual
    line.unfundedPlanDollars += actual
    assigned += actual
  }
  return remaining - assigned
}

export function attributeCashFlowShortfall(
  input: AttributeCashFlowShortfallInput,
): AttributeCashFlowShortfallResult {
  const working: WorkingLine[] = input.lines.map((line) => {
    const requested = Math.max(0, line.requestedPlanDollars)
    const attempted = Math.max(0, line.attemptedFundedPlanDollars)
    const funded0 = Math.min(attempted, requested)
    return {
      id: line.id,
      layer: line.layer,
      requestedPlanDollars: requested,
      fundedPlanDollars: funded0,
      unfundedPlanDollars: requested - funded0,
    }
  })

  let remaining = Math.max(0, input.shortfallAfterHecm)
  for (const layer of SPENDING_LAYERS) {
    remaining = applyLayerResidual(working, layer, remaining)
  }
  if (remaining > 0) {
    for (const layer of NON_SPENDING_LAYERS) {
      remaining = applyLayerResidual(working, layer, remaining)
    }
  }

  return {
    lines: working.map((line) => ({
      id: line.id,
      requestedPlanDollars: line.requestedPlanDollars,
      fundedPlanDollars: line.fundedPlanDollars,
      unfundedPlanDollars: line.unfundedPlanDollars,
    })),
    remainingUnattributed: remaining,
  }
}
