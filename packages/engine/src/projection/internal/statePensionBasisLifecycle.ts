import type { StatePensionBasisPoolComputationResult, StateRetirementDistributionFactInput, TaxComputationResult } from '../types.js'

export interface AcceptedStatePensionBasisSnapshot extends StatePensionBasisPoolComputationResult {
  readonly taxYear: number
}

function poolKind(state: string): StatePensionBasisPoolComputationResult['kind'] | undefined {
  if (state.toUpperCase() === 'MA') return 'pension'
  if (state.toUpperCase() === 'VA') return 'eligiblePlan'
  if (state.toUpperCase() === 'UT') return 'otherState401a'
  return undefined
}

/** Enrich annual facts from accepted prior closings, without consuming on probes.
 * Every event sharing a source sees one opening; the state leaf owns annual
 * aggregation and returns one transition, so callers never subtract per event.
 */
export function applyAcceptedPensionBasisToYearFacts(
  facts: readonly StateRetirementDistributionFactInput[] | undefined,
  state: string,
  year: number,
  snapshots: readonly AcceptedStatePensionBasisSnapshot[],
): readonly StateRetirementDistributionFactInput[] | undefined {
  const kind = poolKind(state)
  if (facts === undefined || kind === undefined) return facts
  return facts.map((fact) => {
    const previous = snapshots.filter((row) => row.state.toUpperCase() === state.toUpperCase() &&
      row.accountId === fact.accountId && row.ownerPersonId === fact.ownerPersonId && row.kind === kind && row.taxYear < year)
      .sort((a, b) => b.taxYear - a.taxYear)[0]
    if (previous === undefined) return fact
    const { knownPreviouslyTaxedBasis: _opening, ...withoutOpening } = fact
    void _opening
    return previous.taxYear === year - 1 && previous.status === 'complete' &&
      previous.closingBasis !== undefined && Number.isFinite(previous.closingBasis) && previous.closingBasis >= 0
      ? { ...withoutOpening, knownPreviouslyTaxedBasis: previous.closingBasis }
      : withoutOpening
  })
}

/**
 * One accepted annual transition per state/account/owner/kind.
 *
 * Previously taxed basis is recovered only against distributions, so a
 * settled year with no distribution from an account leaves its basis as it
 * was (M.G.L. c. 62 s. 2(a)(2) for MA; the VA and UT subtractions likewise
 * recover only against amounts received). That year is known, not a gap: a
 * complete prior-year closing in the year's own state, with no transition
 * this year, is carried forward as a zero-consumption snapshot. A year in
 * another state, an incomplete closing, or a year never committed still
 * leaves a gap, which the next year reads as unknown basis.
 */
export function commitAcceptedPensionBasis(
  year: number,
  state: string,
  result: TaxComputationResult,
  previous: readonly AcceptedStatePensionBasisSnapshot[],
): readonly AcceptedStatePensionBasisSnapshot[] {
  const current = new Map<string, AcceptedStatePensionBasisSnapshot>()
  for (const row of result.pensionBasisPools ?? []) {
    const key = JSON.stringify([row.state.toUpperCase(), row.accountId, row.ownerPersonId, row.kind])
    const valid = row.status === 'complete' && [row.openingBasis, row.basisConsumed, row.closingBasis]
      .every((amount) => amount !== undefined && Number.isFinite(amount) && amount >= 0) &&
      Math.abs(row.openingBasis! - row.basisConsumed! - row.closingBasis!) < 0.000001
    current.set(key, current.has(key) || !valid
      ? { state: row.state, accountId: row.accountId, ownerPersonId: row.ownerPersonId,
          kind: row.kind, status: 'incomplete', taxYear: year }
      : { ...row, taxYear: year })
  }
  const kind = poolKind(state)
  for (const row of previous) {
    if (kind === undefined || row.taxYear !== year - 1 || row.state.toUpperCase() !== state.toUpperCase() ||
      row.kind !== kind || row.status !== 'complete' || row.closingBasis === undefined ||
      !Number.isFinite(row.closingBasis) || row.closingBasis < 0) continue
    const key = JSON.stringify([row.state.toUpperCase(), row.accountId, row.ownerPersonId, row.kind])
    if (current.has(key)) continue
    current.set(key, { state: row.state, accountId: row.accountId, ownerPersonId: row.ownerPersonId, kind: row.kind,
      status: 'complete', openingBasis: row.closingBasis, basisConsumed: 0, closingBasis: row.closingBasis, taxYear: year })
  }
  return [...previous.filter((row) => row.taxYear !== year), ...current.values()]
}
