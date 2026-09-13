import type { Plan } from '../../model/plan.js'
import type { KnownMoneyInput } from '../types.js'

export interface StateBasisPool {
  readonly key: string
  readonly state: string
  readonly accountId: string
  readonly ownerPersonId: string
  readonly kind: 'pension' | 'eligiblePlan' | 'otherState401a' | 'hsa' | 'njIra'
  readonly taxYear: number
  readonly opening: KnownMoneyInput
  readonly remaining: KnownMoneyInput
  readonly consumedByEvent: Readonly<Record<string, number>>
}

export function stateBasisPoolsForYear(plan: Readonly<Plan>, year: number,
  prior: readonly StateBasisPool[] = []): readonly StateBasisPool[] {
  const rows = plan.stateTaxFacts.basisPoolEvidence?.filter((row) => row.taxYear === year) ?? []
  const current = rows.map((row): StateBasisPool => {
    const key = JSON.stringify([row.state.toUpperCase(), row.accountId, row.ownerPersonId, row.kind])
    const previous = prior.find((pool) => pool.key === key && pool.taxYear === year - 1)
    const asserted = row.openingBasis === undefined ? previous?.remaining : { known: true as const, amount: row.openingBasis }
    const opening: KnownMoneyInput = asserted?.known === true && row.additions !== undefined
      ? { known: true, amount: asserted.amount + row.additions } : { known: false }
    return { key, state: row.state.toUpperCase(), accountId: row.accountId,
      ownerPersonId: row.ownerPersonId, kind: row.kind, taxYear: year,
      opening, remaining: opening, consumedByEvent: {} }
  })
  // Missing next-year activity evidence cannot erase the account's basis
  // obligation or silently assume no new contributions.
  return [...current, ...prior.filter((pool) => pool.taxYear === year - 1 &&
    !current.some((entry) => entry.key === pool.key)).map((pool): StateBasisPool => ({
      ...pool, taxYear: year, opening: pool.remaining, remaining: { known: false }, consumedByEvent: {},
    }))]
}

/** Commit the recovery computed by the state leaf once, after choosing a candidate.
 * Probes keep their own immutable pool arrays; rejected candidates consume nothing.
 */
export function consumeStateBasis(pools: readonly StateBasisPool[], input: {
  readonly key: string; readonly eventId: string; readonly recoveredBasis: number
}): { readonly status: 'complete' | 'incomplete'; readonly pools: readonly StateBasisPool[] } {
  const pool = pools.find((entry) => entry.key === input.key)
  if (pool === undefined || !pool.remaining.known || !Number.isFinite(input.recoveredBasis) || input.recoveredBasis < 0) {
    return { status: 'incomplete', pools }
  }
  const prior = pool.consumedByEvent[input.eventId]
  if (prior !== undefined) return { status: prior === input.recoveredBasis ? 'complete' : 'incomplete', pools }
  if (input.recoveredBasis > pool.remaining.amount) return { status: 'incomplete', pools }
  const remaining = { known: true as const, amount: pool.remaining.amount - input.recoveredBasis }
  return { status: 'complete', pools: pools.map((entry) => entry.key === pool.key ? {
    ...entry, remaining, consumedByEvent: { ...entry.consumedByEvent, [input.eventId]: input.recoveredBasis },
  } : entry) }
}
