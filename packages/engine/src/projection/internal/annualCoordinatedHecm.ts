/**
 * Pure boundaries around the annual coordinated-HECM fixed point.
 *
 * Eligibility is established before the ACA/tax solver runs. Allocation is
 * derived after that solver accepts one scalar draw. The solver itself stays
 * in `simulate.ts`: it owns spending, tax, premium, and withdrawal state that
 * is intentionally broader than this HECM domain.
 *
 * Both helpers preserve account/source order and keep their duplicate-id
 * shadows local to one call. A valid plan may contain unreferenced duplicate
 * account ids, while the simulator owns one actual HECM line per id. The first
 * HECM-bearing property row owns that shared line's policy, matching line
 * growth; an earlier property alias without HECM metadata does not claim it.
 * Each actual line contributes capacity and receives an allocation only once.
 */
import type { Account } from '../../model/plan.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'

export interface CoordinatedHecmLine {
  readonly principalLimit: number
  readonly loanBalance: number
}

export interface AnnualCoordinatedHecmEligibilityInput {
  /** Whole `plan.accounts`; iteration order is load-bearing. */
  readonly accounts: readonly Readonly<Account>[]
  readonly hecmStates: ReadonlyMap<string, Readonly<CoordinatedHecmLine>>
  readonly anyAlive: boolean
  readonly year: number
  readonly startYear: number
  readonly priorYearPortfolioReturnPct: number
}

export interface AnnualCoordinatedHecmEligibility {
  /** Ordered unique ids of actual lines eligible for this year's draw. */
  readonly propertyAccountIds: readonly string[]
  /** Sequential source-order fold of each admitted line's availability. */
  readonly capacity: number
}

export function annualCoordinatedHecmEligibility(
  input: AnnualCoordinatedHecmEligibilityInput,
): AnnualCoordinatedHecmEligibility {
  const propertyAccountIds: string[] = []
  let capacity = 0
  if (
    !input.anyAlive ||
    input.year <= input.startYear ||
    input.priorYearPortfolioReturnPct >= 0
  ) {
    return { propertyAccountIds, capacity }
  }

  const visitedHecmLineIds = new Set<string>()
  for (const account of input.accounts) {
    if (account.type !== 'property' || !account.hecm) continue
    if (visitedHecmLineIds.has(account.id)) continue
    visitedHecmLineIds.add(account.id)
    if (account.hecm.drawPolicy !== 'coordinated') continue
    const line = input.hecmStates.get(account.id)
    if (line === undefined) continue
    const available = Math.max(0, line.principalLimit - line.loanBalance)
    if (available <= 0) continue
    propertyAccountIds.push(account.id)
    capacity += available
  }
  return { propertyAccountIds, capacity }
}

export interface AnnualCoordinatedHecmAllocationInput {
  /** The scalar accepted by the caller's fixed point; never recomputed here. */
  readonly acceptedDraw: number
  readonly propertyAccountIds: readonly string[]
  readonly hecmStates: ReadonlyMap<string, Readonly<CoordinatedHecmLine>>
}

export interface AnnualCoordinatedHecmAllocationRow {
  readonly propertyAccountId: string
  readonly amount: number
}

export function annualCoordinatedHecmAllocations(
  input: AnnualCoordinatedHecmAllocationInput,
): readonly AnnualCoordinatedHecmAllocationRow[] {
  const rows: AnnualCoordinatedHecmAllocationRow[] = []
  const remainingCapacityById = new Map<string, number>()
  let remaining = input.acceptedDraw

  for (const propertyAccountId of input.propertyAccountIds) {
    if (remaining <= ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS) break
    let available = remainingCapacityById.get(propertyAccountId)
    if (available === undefined) {
      const line = input.hecmStates.get(propertyAccountId)
      if (line === undefined) continue
      available = Math.max(0, line.principalLimit - line.loanBalance)
    }
    const amount = Math.min(remaining, available)
    if (amount <= 0) continue
    rows.push({ propertyAccountId, amount })
    remaining -= amount
    remainingCapacityById.set(propertyAccountId, available - amount)
  }
  return rows
}
