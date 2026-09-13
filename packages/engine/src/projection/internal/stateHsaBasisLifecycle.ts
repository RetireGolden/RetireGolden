import type {
  StateHsaAccountYearFactsInput,
  StateHsaBasisPoolComputationResult,
  TaxComputationResult,
} from '../types.js'

export interface AcceptedStateHsaBasisSnapshot extends StateHsaBasisPoolComputationResult {
  readonly taxYear: number
}

function key(row: { state: string; accountId: string; ownerPersonId: string }): string {
  return JSON.stringify([row.state.toUpperCase(), row.accountId, row.ownerPersonId])
}

/** Reprice the entire candidate year from its opening, never a rejected probe's closing.
 * A prior accepted closing overrides a stale asserted next-year opening, including
 * an incomplete prior result: unknown cannot be repaired by replaying old basis.
 */
export function applyAcceptedHsaBasisToYearFacts(
  facts: readonly StateHsaAccountYearFactsInput[] | undefined,
  state: string,
  year: number,
  snapshots: readonly AcceptedStateHsaBasisSnapshot[],
): readonly StateHsaAccountYearFactsInput[] | undefined {
  if (facts === undefined) return undefined
  return facts.map((fact) => {
    const matching = snapshots.filter((row) => key(row) === key({ ...fact, state }) && row.taxYear < year)
      .sort((a, b) => b.taxYear - a.taxYear)
    const previous = matching[0]
    if (previous === undefined) return fact
    const known = previous.taxYear === year - 1 && previous.status === 'complete' &&
      previous.closingBasis !== undefined && Number.isFinite(previous.closingBasis) && previous.closingBasis >= 0
    return { ...fact, stateBasisBeforeYear: known
      ? { known: true as const, amount: previous.closingBasis! }
      : { known: false as const } }
  })
}

/** Called once after the annual candidate is accepted; no mutation during probes.
 * Duplicate transitions for the same state/account/owner are ambiguous and are
 * preserved as incomplete, never summed or applied twice.
 */
export function commitAcceptedHsaBasis(
  year: number,
  result: TaxComputationResult,
  previous: readonly AcceptedStateHsaBasisSnapshot[],
): readonly AcceptedStateHsaBasisSnapshot[] {
  const current = new Map<string, AcceptedStateHsaBasisSnapshot>()
  for (const row of result.hsaBasisPools ?? []) {
    const poolKey = key(row)
    const fields = [row.openingBasis, row.basisAdded, row.basisConsumed, row.closingBasis]
    const valid = row.status === 'complete' && fields.every((amount) =>
      amount !== undefined && Number.isFinite(amount) && amount >= 0) &&
      Math.abs(row.openingBasis! + row.basisAdded! - row.basisConsumed! - row.closingBasis!) < 0.000001
    current.set(poolKey, current.has(poolKey) || !valid
      ? { state: row.state, accountId: row.accountId, ownerPersonId: row.ownerPersonId,
          status: 'incomplete', taxYear: year }
      : { ...row, taxYear: year })
  }
  // Retain history for auditing and same-year whole-year re-pricing. An absent
  // transition in an intervening year is unknown, not permission to reuse an
  // older exact closing when the account next appears.
  return [...previous.filter((row) => row.taxYear !== year), ...current.values()]
}
