/**
 * Contract tests for the annual rebalance-to-target phase.
 *
 * These pin the helper in isolation: selection, the per-row arithmetic operand
 * for operand, the retarget-as-you-go rule, and the structural promises the
 * delegation test's positional attribution rests on. What they CANNOT see is
 * whether `simulatePlan` actually calls this function — a byte-identical
 * differential dump passes an orphaned helper, and so do these. That is
 * `simulate.annualRebalanceDelegation.test.ts`'s job.
 */
import { describe, expect, it } from 'vitest'

import { targetWeightsAt, weightsToVector } from '../../allocation/assetClasses.js'
import type { AssetAllocationPolicy } from '../../model/plan.js'
import { aggregateBasisSale } from '../../tax/aggregateBasisSale.js'
import {
  annualRebalanceToTarget,
  type AnnualRebalanceAccountState,
  type AnnualRebalanceTrack,
} from './annualRebalanceToTarget.js'

const W = (usStocks: number, intlStocks: number, bonds: number, cash: number) => ({
  usStocks,
  intlStocks,
  bonds,
  cash,
})

const staticPolicy = (
  rebalancing: 'annual' | 'none',
  weights = W(50, 0, 50, 0),
): AssetAllocationPolicy => ({ mode: 'static', rebalancing, weights })

const state = (
  id: string,
  type: string,
  balance: number,
  costBasis: number,
): AnnualRebalanceAccountState => ({ account: { id, type }, balance, costBasis })

/** A track whose weights have DRIFTED away from the static 50/50 target. */
const driftedTrack = (policy: AssetAllocationPolicy = staticPolicy('annual')): AnnualRebalanceTrack => ({
  policy,
  weights: weightsToVector(W(60, 0, 40, 0)),
})

const trackMap = (...entries: readonly (readonly [string, AnnualRebalanceTrack])[]) =>
  new Map<string, AnnualRebalanceTrack>(entries)

const YEAR = 2027
const START_YEAR = 2026

describe('annualRebalanceToTarget — selection and row shape', () => {
  it('returns exactly one row per state, in states order', () => {
    const rows = annualRebalanceToTarget({
      states: [state('a', 'taxable', 200_000, 100_000), state('b', 'traditional', 50_000, 0), state('c', 'cash', 10_000, 0)],
      allocationTrack: trackMap(['a', driftedTrack()], ['b', driftedTrack()]),
      year: YEAR,
      startYear: START_YEAR,
    })
    expect(rows.length).toBe(3)
    expect(rows.map((r) => r.kind)).toEqual(['sale', 'retarget', 'none'])
  })

  it('returns all-none rows in the start year, and the gate is the year, not the tracks', () => {
    const input = {
      states: [state('a', 'taxable', 200_000, 100_000), state('b', 'traditional', 50_000, 0)],
      allocationTrack: trackMap(['a', driftedTrack()], ['b', driftedTrack()]),
      startYear: START_YEAR,
    }
    expect(annualRebalanceToTarget({ ...input, year: START_YEAR }).map((r) => r.kind)).toEqual(['none', 'none'])
    // One year later the same tracks DO produce work, so the assertion above is
    // about the year gate rather than about a fixture that never rebalances.
    expect(annualRebalanceToTarget({ ...input, year: START_YEAR + 1 }).map((r) => r.kind)).toEqual(['sale', 'retarget'])
  })

  it('skips a state with no track and a track that opts out with rebalancing: none', () => {
    const rows = annualRebalanceToTarget({
      states: [state('untracked', 'taxable', 200_000, 100_000), state('optout', 'taxable', 200_000, 100_000)],
      allocationTrack: trackMap(['optout', driftedTrack(staticPolicy('none'))]),
      year: YEAR,
      startYear: START_YEAR,
    })
    expect(rows.map((r) => r.kind)).toEqual(['none', 'none'])
  })

  it('retargets without selling for every account type that is not taxable', () => {
    const rows = annualRebalanceToTarget({
      states: [
        state('trad', 'traditional', 200_000, 0),
        state('roth', 'roth', 200_000, 0),
        state('hsa', 'hsa', 200_000, 0),
      ],
      allocationTrack: trackMap(['trad', driftedTrack()], ['roth', driftedTrack()], ['hsa', driftedTrack()]),
      year: YEAR,
      startYear: START_YEAR,
    })
    expect(rows.map((r) => r.kind)).toEqual(['retarget', 'retarget', 'retarget'])
    for (const row of rows) {
      if (row.kind !== 'retarget') throw new Error('unreachable')
      expect(row.targetWeights).toEqual(targetWeightsAt(staticPolicy('annual'), YEAR))
    }
  })

  it('retargets without selling when the taxable balance is not positive', () => {
    const rows = annualRebalanceToTarget({
      states: [state('a', 'taxable', 0, 0), state('b', 'taxable', -5, 0)],
      allocationTrack: trackMap(['a', driftedTrack()], ['b', driftedTrack()]),
      year: YEAR,
      startYear: START_YEAR,
    })
    expect(rows.map((r) => r.kind)).toEqual(['retarget', 'retarget'])
  })

  it('retargets without selling when turnover is at or below the 1e-9 gate', () => {
    // Weights already AT target: turnover is exactly 0.
    const atTarget: AnnualRebalanceTrack = {
      policy: staticPolicy('annual'),
      weights: weightsToVector(W(50, 0, 50, 0)),
    }
    // Drifted by 5e-10 in one class: turnover 5e-10, still under the gate.
    const barelyDrifted: AnnualRebalanceTrack = {
      policy: staticPolicy('annual'),
      weights: [0.5 + 5e-10, 0, 0.5 - 5e-10, 0],
    }
    const rows = annualRebalanceToTarget({
      states: [state('a', 'taxable', 200_000, 100_000), state('b', 'taxable', 200_000, 100_000)],
      allocationTrack: trackMap(['a', atTarget], ['b', barelyDrifted]),
      year: YEAR,
      startYear: START_YEAR,
    })
    expect(rows.map((r) => r.kind)).toEqual(['retarget', 'retarget'])
  })
})

describe('annualRebalanceToTarget — the sale arithmetic', () => {
  const SALE_STATES = [state('brok', 'taxable', 211_000, 100_000)]
  const SALE_TRACK = trackMap(['brok', driftedTrack()])

  it('prices the sale through aggregateBasisSale on the clamped sell amount', () => {
    const [row] = annualRebalanceToTarget({
      states: SALE_STATES,
      allocationTrack: SALE_TRACK,
      year: YEAR,
      startYear: START_YEAR,
    })
    if (row?.kind !== 'sale') throw new Error('expected a sale row')
    // Re-derived here operand for operand from the fixture's own inputs, never
    // read back off the row: turnover is the single 10-point overweight.
    const turnover = 0.6 - 0.5
    const sellAmount = Math.min(211_000, Math.max(0, turnover * 211_000))
    const sale = aggregateBasisSale({
      openingFairMarketValue: 211_000,
      openingCostBasis: 100_000,
      saleProceeds: sellAmount,
    })
    expect(row.realizedCapitalGainOrLoss).toBe(sale.realizedCapitalGainOrLoss)
    expect(row.closingCostBasis).toBe(sale.remainingCostBasis + sellAmount)
    expect(row.accountId).toBe('brok')
  })

  it('keeps a realized LOSS signed rather than flooring it at zero', () => {
    const [row] = annualRebalanceToTarget({
      states: [state('brok', 'taxable', 211_000, 400_000)],
      allocationTrack: SALE_TRACK,
      year: YEAR,
      startYear: START_YEAR,
    })
    if (row?.kind !== 'sale') throw new Error('expected a sale row')
    expect(row.realizedCapitalGainOrLoss).toBeLessThan(0)
  })

  it('clamps turnover noise above 1 to the whole balance instead of throwing', () => {
    // A weight vector whose overweight sums above 1 against an all-cash target.
    // `aggregateBasisSale` throws RangeError when proceeds exceed opening FMV,
    // so the Math.min clamp is what keeps this a sale rather than a crash.
    const noisy: AnnualRebalanceTrack = {
      policy: staticPolicy('annual', W(0, 0, 0, 100)),
      weights: [0.5, 0.4, 0.2, 0],
    }
    const [row] = annualRebalanceToTarget({
      states: [state('brok', 'taxable', 200_000, 50_000)],
      allocationTrack: trackMap(['brok', noisy]),
      year: YEAR,
      startYear: START_YEAR,
    })
    if (row?.kind !== 'sale') throw new Error('expected a sale row')
    const whole = aggregateBasisSale({
      openingFairMarketValue: 200_000,
      openingCostBasis: 50_000,
      saleProceeds: 200_000,
    })
    expect(row.realizedCapitalGainOrLoss).toBe(whole.realizedCapitalGainOrLoss)
    expect(row.closingCostBasis).toBe(whole.remainingCostBasis + 200_000)
  })

  it('builds the ledger payload from the row’s own double, not a recomputation', () => {
    const [row] = annualRebalanceToTarget({
      states: SALE_STATES,
      allocationTrack: SALE_TRACK,
      year: YEAR,
      startYear: START_YEAR,
    })
    if (row?.kind !== 'sale') throw new Error('expected a sale row')
    expect(row.record.accountId).toBe(row.accountId)
    expect(row.record.realizedCapitalGainOrLoss).toBe(row.realizedCapitalGainOrLoss)
  })
})

describe('annualRebalanceToTarget — the retarget-as-you-go rule', () => {
  it('gives a second state sharing an account id the FIRST one’s retarget', () => {
    // `model/plan.ts` raises `duplicate account id` only when a retirement
    // action references the id, so two taxable accounts may legally share one
    // and both BalanceStates then resolve to the SAME track object. The inlined
    // phase snapped that track's weights inside its own loop, so the second
    // account measured turnover against the target and sold nothing.
    const shared = driftedTrack()
    const rows = annualRebalanceToTarget({
      states: [state('dup', 'taxable', 211_000, 100_000), state('dup', 'taxable', 211_000, 100_000)],
      allocationTrack: trackMap(['dup', shared]),
      year: YEAR,
      startYear: START_YEAR,
    })
    expect(rows.map((r) => r.kind)).toEqual(['sale', 'retarget'])
    // Distinct ids on the same inputs give TWO sales, so the assertion above is
    // about the shared track rather than about a fixture that only ever sells once.
    const distinct = annualRebalanceToTarget({
      states: [state('one', 'taxable', 211_000, 100_000), state('two', 'taxable', 211_000, 100_000)],
      allocationTrack: trackMap(['one', driftedTrack()], ['two', driftedTrack()]),
      year: YEAR,
      startYear: START_YEAR,
    })
    expect(distinct.map((r) => r.kind)).toEqual(['sale', 'sale'])
  })

  it('records the retarget for a NON-taxable first row too, not just for sales', () => {
    // The inlined phase wrote `track.weights = target` on EVERY non-skipped
    // row, sale or not, so a traditional account ahead of a taxable one sharing
    // its id must still suppress the taxable sale.
    const shared = driftedTrack()
    const rows = annualRebalanceToTarget({
      states: [state('dup', 'traditional', 211_000, 0), state('dup', 'taxable', 211_000, 100_000)],
      allocationTrack: trackMap(['dup', shared]),
      year: YEAR,
      startYear: START_YEAR,
    })
    expect(rows.map((r) => r.kind)).toEqual(['retarget', 'retarget'])
  })
})

describe('annualRebalanceToTarget — purity and structure', () => {
  const INPUT = {
    states: [state('brok', 'taxable', 211_000, 100_000), state('trad', 'traditional', 50_000, 0)],
    allocationTrack: trackMap(['brok', driftedTrack()], ['trad', driftedTrack()]),
    year: YEAR,
    startYear: START_YEAR,
  }

  it('returns a materialized array, not a lazy iterable', () => {
    const rows = annualRebalanceToTarget(INPUT)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBe(INPUT.states.length)
  })

  it('holds no state between calls', () => {
    const first = annualRebalanceToTarget(INPUT)
    const second = annualRebalanceToTarget(INPUT)
    expect(second).toEqual(first)
    // Not the same objects: the retarget overlay is per-call, so a second call
    // against the same drifted tracks sells again rather than seeing itself.
    expect(second[0]).not.toBe(first[0])
  })

  it('mutates neither the states nor the tracks it was handed', () => {
    const track = driftedTrack()
    const before = [...track.weights]
    const s = state('brok', 'taxable', 211_000, 100_000)
    annualRebalanceToTarget({
      states: [s],
      allocationTrack: trackMap(['brok', track]),
      year: YEAR,
      startYear: START_YEAR,
    })
    expect(track.weights).toEqual(before)
    expect(s.balance).toBe(211_000)
    expect(s.costBasis).toBe(100_000)
  })

  it('gives every row its own target vector, never a shared one', () => {
    const policy = staticPolicy('annual')
    // Both tracks share ONE policy object, which is the case a hoisted
    // per-policy target would collapse.
    const rows = annualRebalanceToTarget({
      states: [state('a', 'traditional', 100_000, 0), state('b', 'roth', 100_000, 0)],
      allocationTrack: trackMap(
        ['a', { policy, weights: weightsToVector(W(60, 0, 40, 0)) }],
        ['b', { policy, weights: weightsToVector(W(60, 0, 40, 0)) }],
      ),
      year: YEAR,
      startYear: START_YEAR,
    })
    const [a, b] = rows
    if (a?.kind !== 'retarget' || b?.kind !== 'retarget') throw new Error('expected two retarget rows')
    expect(a.targetWeights).toEqual(b.targetWeights)
    expect(a.targetWeights).not.toBe(b.targetWeights)
  })
})
