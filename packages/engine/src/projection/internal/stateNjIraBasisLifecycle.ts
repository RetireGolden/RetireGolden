import type { KnownMoneyInput, StateNjIraBasisPoolComputationResult, StateNjIraOwnerPoolFactsInput, TaxComputationResult } from '../types.js'

export interface AcceptedStateNjIraBasisSnapshot extends StateNjIraBasisPoolComputationResult {
  readonly taxYear: number
}

/** The owner pool contains ALL annual IRA distributions across accounts.
 * Reprice candidates from the same opening pool; never consume event by event.
 */
export function applyAcceptedNjIraBasisToYearFacts(
  facts: readonly StateNjIraOwnerPoolFactsInput[] | undefined,
  year: number,
  snapshots: readonly AcceptedStateNjIraBasisSnapshot[],
  additions?: readonly { ownerPersonId: string; amount: KnownMoneyInput }[],
): readonly StateNjIraOwnerPoolFactsInput[] | undefined {
  if (facts === undefined) return undefined
  return facts.map((fact) => {
    const previous = snapshots.filter((row) => row.ownerPersonId === fact.ownerPersonId && row.state === 'NJ' && row.taxYear < year)
      .sort((a, b) => b.taxYear - a.taxYear)[0]
    if (previous === undefined) return fact
    const ownerAdditions = additions?.filter((row) => row.ownerPersonId === fact.ownerPersonId)
    const added = ownerAdditions?.length === 1 ? ownerAdditions[0]!.amount : undefined
    const known = fact.annualInputsComplete !== false && Number.isFinite(fact.december31IraValue) &&
      Number.isFinite(fact.allAnnualDistributions) && added?.known === true && Number.isFinite(added.amount) && added.amount >= 0 && previous.taxYear === year - 1 && previous.status === 'complete' &&
      previous.closingBasis !== undefined && Number.isFinite(previous.closingBasis) && previous.closingBasis >= 0
    // Current-year newly taxed contributions are distinct from carried basis.
    // An unknown addition is not zero; require explicit characterized amounts.
    return { ...fact, unrecoveredNjTaxedContributions: known
      ? { known: true as const, amount: previous.closingBasis! + (added?.known === true ? added.amount : 0) }
      : { known: false as const } }
  })
}

/** Commit one annual owner recovery only after accepting the annual tax result. */
export function commitAcceptedNjIraBasis(
  year: number,
  result: TaxComputationResult,
  previous: readonly AcceptedStateNjIraBasisSnapshot[],
): readonly AcceptedStateNjIraBasisSnapshot[] {
  const current = new Map<string, AcceptedStateNjIraBasisSnapshot>()
  for (const row of result.njIraBasisPools ?? []) {
    const valid = row.status === 'complete' &&
      [row.openingBasis, row.basisConsumed, row.closingBasis].every((amount) =>
        amount !== undefined && Number.isFinite(amount) && amount >= 0) &&
      Math.abs(row.openingBasis! - row.basisConsumed! - row.closingBasis!) < 0.000001
    current.set(row.ownerPersonId, current.has(row.ownerPersonId) || !valid
      ? { state: 'NJ', ownerPersonId: row.ownerPersonId, status: 'incomplete', taxYear: year }
      : { ...row, taxYear: year })
  }
  return [...previous.filter((row) => row.taxYear !== year), ...current.values()]
}
