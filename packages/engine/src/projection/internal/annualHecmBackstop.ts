/**
 * Pure annual HECM portfolio-shortfall backstop planning.
 *
 * The caller supplies live line values after any coordinated draw has been
 * committed. This coordinator returns an immutable allocation plan only;
 * `simulatePlan` retains every line/map mutation, debt-total fold, cash-flow
 * publication, residual-shortfall publication, and depletion decision.
 *
 * Draw policy deliberately does not participate: `coordinated` governs only
 * proactive bad-return draws, while every open line remains a last backstop
 * before the household is reported depleted. Source order and duplicate-id
 * suppression are load-bearing because a valid Plan may contain unreferenced
 * duplicate account ids while the simulator owns one actual HECM line per id.
 */
import type { Account } from '../../model/plan.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'

export interface HecmBackstopLine {
  readonly principalLimit: number
  readonly loanBalance: number
}

export interface AnnualHecmBackstopInput {
  /** Whole `plan.accounts`; iteration order is load-bearing. */
  readonly accounts: readonly Readonly<Account>[]
  /** Live lines after the caller has committed any coordinated draw. */
  readonly hecmStates: ReadonlyMap<string, Readonly<HecmBackstopLine>>
  readonly portfolioShortfall: number
  readonly anyAlive: boolean
}

export interface AnnualHecmBackstopAllocationRow {
  readonly propertyAccountId: string
  readonly amount: number
}

export interface AnnualHecmBackstopPlan {
  /** Ordered unique line allocations for the caller to commit. */
  readonly allocations: readonly AnnualHecmBackstopAllocationRow[]
  /** Sequential source-order sum of the allocation rows. */
  readonly draw: number
  /** Portfolio shortfall left after applying `draw`. */
  readonly shortfallAfterHecm: number
}

export function annualHecmBackstopPlan(
  input: AnnualHecmBackstopInput,
): AnnualHecmBackstopPlan {
  const allocations: AnnualHecmBackstopAllocationRow[] = []
  let draw = 0
  if (
    input.portfolioShortfall > ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS &&
    input.anyAlive
  ) {
    let remaining = input.portfolioShortfall
    const visitedHecmLineIds = new Set<string>()
    for (const account of input.accounts) {
      if (account.type !== 'property' || !account.hecm) continue
      if (visitedHecmLineIds.has(account.id)) continue
      visitedHecmLineIds.add(account.id)
      const line = input.hecmStates.get(account.id)
      if (line === undefined) continue
      const amount = Math.min(
        remaining,
        Math.max(0, line.principalLimit - line.loanBalance),
      )
      if (amount <= 0) continue
      allocations.push({ propertyAccountId: account.id, amount })
      draw += amount
      remaining -= amount
      if (remaining <= ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS) break
    }
  }

  return {
    allocations,
    draw,
    shortfallAfterHecm: Math.max(0, input.portfolioShortfall - draw),
  }
}
