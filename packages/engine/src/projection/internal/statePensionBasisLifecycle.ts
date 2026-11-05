import type { StateTaxPlanFacts } from '../../model/stateTaxPlanFacts.js'
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

type BasisPoolEvidence = StateTaxPlanFacts['basisPoolEvidence']

/**
 * Previously taxed basis the plan records as added to one pool in `year`
 * (newly taxed contributions; MA counts "all amounts previously subjected to
 * taxation"). As in `stateBasisPoolState.ts`, a year's additions belong to
 * that year's opening.
 */
function recordedAdditions(evidence: BasisPoolEvidence, year: number,
  pool: { readonly state: string; readonly accountId: string; readonly ownerPersonId: string; readonly kind: string }): number {
  return (evidence ?? []).filter((row) => row.taxYear === year && row.state.toUpperCase() === pool.state.toUpperCase() &&
    row.accountId === pool.accountId && row.ownerPersonId === pool.ownerPersonId && row.kind === pool.kind)
    .reduce((sum, row) => sum + (row.additions ?? 0), 0)
}

/** Enrich annual facts from accepted prior closings, without consuming on probes.
 * Every event sharing a source sees one opening; the state leaf owns annual
 * aggregation and returns one transition, so callers never subtract per event.
 * A carried opening is the prior closing plus the year's recorded additions.
 * With no accepted prior year the plan-authored opening is used as given.
 */
export function applyAcceptedPensionBasisToYearFacts(
  facts: readonly StateRetirementDistributionFactInput[] | undefined,
  state: string,
  year: number,
  snapshots: readonly AcceptedStatePensionBasisSnapshot[],
  basisPoolEvidence?: BasisPoolEvidence,
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
      ? { ...withoutOpening, knownPreviouslyTaxedBasis: previous.closingBasis + recordedAdditions(basisPoolEvidence, year, previous) }
      : withoutOpening
  })
}

/**
 * What a settled year shows about accounts it made no transition for: the
 * year's own state, its accepted distribution facts (`undefined` when they
 * are not known), and the plan's basis-pool evidence.
 */
export interface PensionBasisSettledYear {
  readonly state: string
  readonly distributions: readonly StateRetirementDistributionFactInput[] | undefined
  readonly basisPoolEvidence?: BasisPoolEvidence
}

/**
 * One accepted annual transition per state/account/owner/kind.
 *
 * Previously taxed basis is recovered only against distributions (MA: Mass.
 * Gen. Laws ch.62 §2(a)(2)(F), "until an aggregate amount of such income has
 * been deducted ... equal to the aggregate of all amounts previously
 * subjected to taxation"), so a settled year with no distribution from an
 * account leaves its basis unchanged. That year is known, not a gap: a
 * complete prior-year closing is carried forward as a zero-consumption
 * snapshot when all of these hold:
 * - the year is in the closing's own state;
 * - the year's accepted distribution facts are known and none comes from
 *   that account and owner (a distribution whose transition is missing
 *   proves nothing, so it stays a gap);
 * The carried opening and closing are the prior closing plus the year's
 * recorded basis additions for that pool, the same opening a distribution in
 * that year would have seen.
 * Anything else, including a year never committed, still leaves a gap, which
 * the next year reads as unknown basis.
 */
export function commitAcceptedPensionBasis(
  year: number,
  result: TaxComputationResult,
  previous: readonly AcceptedStatePensionBasisSnapshot[],
  settled?: PensionBasisSettledYear,
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
  const kind = settled === undefined ? undefined : poolKind(settled.state)
  for (const row of settled?.distributions === undefined || kind === undefined ? [] : previous) {
    if (row.taxYear !== year - 1 || row.state.toUpperCase() !== settled!.state.toUpperCase() ||
      row.kind !== kind || row.status !== 'complete' || row.closingBasis === undefined ||
      !Number.isFinite(row.closingBasis) || row.closingBasis < 0) continue
    const key = JSON.stringify([row.state.toUpperCase(), row.accountId, row.ownerPersonId, row.kind])
    if (current.has(key)) continue
    if (settled!.distributions!.some((fact) => fact.accountId === row.accountId && fact.ownerPersonId === row.ownerPersonId)) continue
    const opening = row.closingBasis + recordedAdditions(settled!.basisPoolEvidence, year, row)
    current.set(key, { state: row.state, accountId: row.accountId, ownerPersonId: row.ownerPersonId, kind: row.kind,
      status: 'complete', openingBasis: opening, basisConsumed: 0, closingBasis: opening, taxYear: year })
  }
  return [...previous.filter((row) => row.taxYear !== year), ...current.values()]
}
