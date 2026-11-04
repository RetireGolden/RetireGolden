import type { KnownMoneyInput, StateNjIraBasisPoolComputationResult, StateNjIraOwnerPoolFactsInput, TaxComputationResult } from '../types.js'
import { njIraBasisPools } from '../../tax/stateTax.js'

export interface AcceptedStateNjIraBasisSnapshot extends StateNjIraBasisPoolComputationResult {
  readonly taxYear: number
}

/** The owner pool contains ALL annual IRA distributions across accounts.
 * Reprice candidates from the same opening pool; never consume event by event.
 *
 * A projected ledger pool (an owner with no basis evidence this year) has no
 * basis of its own. It takes the accepted prior year's Worksheet C Part II
 * closing basis plus this year's characterized contributions, or it is
 * dropped: unknown basis is never priced as zero, and with no pool left the
 * year's QCD reports nj-qcd-basis-unknown as before.
 */
export function applyAcceptedNjIraBasisToYearFacts(
  facts: readonly StateNjIraOwnerPoolFactsInput[] | undefined,
  year: number,
  snapshots: readonly AcceptedStateNjIraBasisSnapshot[],
  additions?: readonly { ownerPersonId: string; amount: KnownMoneyInput }[],
): readonly StateNjIraOwnerPoolFactsInput[] | undefined {
  if (facts === undefined) return undefined
  const applied = facts.flatMap((fact) => {
    const previous = snapshots.filter((row) => row.ownerPersonId === fact.ownerPersonId && row.state === 'NJ' && row.taxYear < year)
      .sort((a, b) => b.taxYear - a.taxYear)[0]
    const carried = previous !== undefined && previous.taxYear === year - 1 && previous.status === 'complete' &&
      previous.closingBasis !== undefined && Number.isFinite(previous.closingBasis) && previous.closingBasis >= 0
    if (fact.projectedLedger !== undefined && !carried) return []
    if (previous === undefined) return [fact]
    const ownerAdditions = additions?.filter((row) => row.ownerPersonId === fact.ownerPersonId)
    const added = ownerAdditions?.length === 1 ? ownerAdditions[0]!.amount : undefined
    const known = carried && fact.annualInputsComplete !== false && Number.isFinite(fact.december31IraValue) &&
      Number.isFinite(fact.allAnnualDistributions) && added?.known === true && Number.isFinite(added.amount) && added.amount >= 0
    // Current-year newly taxed contributions are distinct from carried basis.
    // An unknown addition is not zero; require explicit characterized amounts.
    return [{ ...fact, unrecoveredNjTaxedContributions: known
      ? { known: true as const, amount: previous.closingBasis! + (added?.known === true ? added.amount : 0) }
      : { known: false as const } }]
  })
  // A year whose only pools were projected ones with no carry keeps no pool.
  return applied.length === 0 && facts.length > 0 && facts.every((fact) => fact.projectedLedger !== undefined)
    ? undefined
    : applied
}

/**
 * Each owner's newly NJ-taxed contributions for the year: the traditional IRA
 * contributions the ledger made, plus the post-year contributions through the
 * filing deadline a basis row reports. An owner with no row is a projected
 * ledger pool; every contribution it adds is modeled and none is made after
 * December 31. A row that omits its post-year amount leaves the addition
 * unknown, never zero.
 */
export function njIraYearContributionAdditions(
  rows: readonly { readonly taxYear: number; readonly state: string; readonly ownerPersonId: string; readonly postYearContributionsThroughFilingDeadline?: number }[],
  year: number,
  ownerPersonIds: readonly string[],
  modeledContributions: ReadonlyMap<string, number>,
): readonly { ownerPersonId: string; amount: KnownMoneyInput }[] {
  return ownerPersonIds.map((ownerPersonId) => {
    const owned = rows.filter((row) => row.taxYear === year && row.state.toUpperCase() === 'NJ' && row.ownerPersonId === ownerPersonId)
    const complete = owned.every((row) => row.postYearContributionsThroughFilingDeadline !== undefined)
    return { ownerPersonId, amount: complete
      ? { known: true as const, amount: (modeledContributions.get(ownerPersonId) ?? 0) + owned.reduce((sum, row) => sum + row.postYearContributionsThroughFilingDeadline!, 0) }
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

/**
 * Open the carry from the year before the projection starts. That year's
 * basis evidence is a filed Worksheet C: its Part II closing basis (line 4b
 * less the excludable portion recovered that year) is what the first
 * projected year starts from. Rows that do not make a complete pool open an
 * incomplete snapshot, which carries nothing.
 */
export function seedAcceptedNjIraBasisFromEvidence(
  priorYear: number,
  pools: readonly StateNjIraOwnerPoolFactsInput[] | undefined,
): readonly AcceptedStateNjIraBasisSnapshot[] {
  const transitions = njIraBasisPools('NJ', pools)
  if (transitions === undefined) return []
  return commitAcceptedNjIraBasis(priorYear, { amount: 0, status: 'complete', issues: [], njIraBasisPools: transitions }, [])
}

/**
 * Check a projected ledger pool's December 31 value against the year-end
 * ledger after growth. The pool was priced inside the funding solve from the
 * candidate's balances and the growth factors; any IRA movement it did not
 * see makes the year incomplete and stops the basis carry, instead of
 * standing as a Worksheet C line 1 the ledger never held.
 */
export function reconcileProjectedNjIraYearEnd(
  year: number,
  result: TaxComputationResult,
  pools: readonly StateNjIraOwnerPoolFactsInput[] | undefined,
  yearEndBalance: (accountId: string) => number,
): TaxComputationResult {
  const mismatched = (pools ?? []).filter((pool) => {
    if (pool.projectedLedger === undefined || pool.unrecoveredNjTaxedContributions.known !== true) return false
    const ledger = pool.projectedLedger.accounts.reduce((sum, account) => sum + yearEndBalance(account.accountId), 0)
    return !(Math.abs(ledger - pool.december31IraValue) < 0.005)
  }).map((pool) => pool.ownerPersonId)
  if (mismatched.length === 0) return result
  return {
    ...result,
    status: 'incomplete',
    issues: [...result.issues, ...mismatched.map((ownerPersonId) => ({
      code: 'nj-ira-projected-year-end-mismatch',
      state: 'NJ',
      year,
      message: `New Jersey Worksheet C line 1 for ${ownerPersonId} does not match the year-end IRA ledger; the year's IRA basis transition is not certified.`,
      missingFacts: ['december31IraValue'],
      ruleId: 'nj-direct-qcd-ira-basis-treatment',
    }))],
    ...(result.njIraBasisPools === undefined ? {} : {
      njIraBasisPools: result.njIraBasisPools.map((row) => mismatched.includes(row.ownerPersonId)
        ? { state: 'NJ' as const, ownerPersonId: row.ownerPersonId, status: 'incomplete' as const }
        : row),
    }),
  }
}
