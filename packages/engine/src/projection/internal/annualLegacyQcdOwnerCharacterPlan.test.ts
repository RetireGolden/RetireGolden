import { describe, expect, it } from 'vitest'

import {
  annualLegacyQcdOwnerCharacterPlan,
  type AnnualLegacyQcdOwnerCharacterPlanInput,
} from './annualLegacyQcdOwnerCharacterPlan.js'

function call(
  overrides: Partial<AnnualLegacyQcdOwnerCharacterPlanInput> = {},
) {
  return annualLegacyQcdOwnerCharacterPlan({
    qcdGrossByOwner: new Map(),
    qcdFromRmdByOwner: new Map(),
    iraBasisByOwner: new Map(),
    preDistributionAggregateIraBalance: new Map(),
    qcdSection219ByDonor: new Map(),
    qcdOffsetConsumedByDonor: new Map(),
    preProjectionQcdOffsetUnprovable: new Set(),
    publishCashFlow: false,
    ...overrides,
  })
}

describe('annualLegacyQcdOwnerCharacterPlan', () => {
  it('consumes already-aggregated owner maps without sorting or re-canonicalizing them', () => {
    const gross = new Map([
      ['z-owner', 50],
      ['m-owner', 10],
    ])
    const fromRmd = new Map([
      ['z-owner', 20],
      ['m-owner', 5],
    ])
    const basis = new Map([
      ['a-basis-only', 10],
      ['z-owner', 60],
    ])
    const preDistribution = new Map([
      // 318 models compatible physical rows of 265 + 53 already grouped by
      // the caller. The helper must treat it as one owner aggregate exactly.
      ['z-owner', 318],
      ['m-owner', 100],
      ['a-basis-only', 50],
    ])

    const result = call({
      qcdGrossByOwner: gross,
      qcdFromRmdByOwner: fromRmd,
      iraBasisByOwner: basis,
      preDistributionAggregateIraBalance: preDistribution,
      qcdSection219ByDonor: new Map([['z-owner', 10]]),
      qcdOffsetConsumedByDonor: new Map([['z-owner', 300]]),
      publishCashFlow: true,
    })

    expect(result.rows.map((row) => row.ownerId)).toEqual([
      'z-owner',
      'm-owner',
      'a-basis-only',
    ])
    expect(result.rows[0]).toMatchObject({
      ownerId: 'z-owner',
      qualifiedFromRmd: 20,
      nonQualifiedBeyondRmd: 0,
      incomeOffsetDelta: 20,
      nonQualifiedOrdinaryIncomeDelta: 7,
      qcdOffsetConsumedWrite: 1_000,
      cashFlowWrites: [
        { ownerId: 'z-owner', target: 'exclusionFromRmd', value: 20 },
        { ownerId: 'z-owner', target: 'exclusionBeyondRmd', value: 23 },
        { ownerId: 'z-owner', target: 'ordinaryBeyondRmd', value: 7 },
      ],
    })
    expect(result.rows[0]!.iraProRataWrite).toEqual({
      basis: 60,
      nontaxableFraction: 60 / 268,
    })
    expect(result.rows[2]!.iraProRataWrite).toEqual({
      basis: 10,
      nontaxableFraction: 0.2,
    })
    expect([...gross]).toEqual([['z-owner', 50], ['m-owner', 10]])
    expect([...fromRmd]).toEqual([['z-owner', 20], ['m-owner', 5]])
    expect([...basis]).toEqual([['a-basis-only', 10], ['z-owner', 60]])
    expect([...preDistribution]).toEqual([
      ['z-owner', 318],
      ['m-owner', 100],
      ['a-basis-only', 50],
    ])
  })

  it('fails closed on unprovable offset history without inventing a ledger write', () => {
    const row = call({
      qcdGrossByOwner: new Map([['owner', 10]]),
      qcdFromRmdByOwner: new Map([['owner', 8]]),
      iraBasisByOwner: new Map([['owner', 20]]),
      preDistributionAggregateIraBalance: new Map([['owner', 100]]),
      qcdSection219ByDonor: new Map([['owner', 5]]),
      qcdOffsetConsumedByDonor: new Map([['owner', 200]]),
      preProjectionQcdOffsetUnprovable: new Set(['owner']),
      publishCashFlow: true,
    }).rows[0]!

    expect(row).toMatchObject({
      qualifiedFromRmd: 8,
      incomeOffsetDelta: 0,
      nonQualifiedOrdinaryIncomeDelta: 2,
      qcdOffsetConsumedWrite: null,
      cashFlowWrites: [
        { ownerId: 'owner', target: 'exclusionFromRmd', value: 0 },
        { ownerId: 'owner', target: 'ordinaryFromRmd', value: 8 },
        { ownerId: 'owner', target: 'exclusionBeyondRmd', value: 0 },
        { ownerId: 'owner', target: 'ordinaryBeyondRmd', value: 2 },
      ],
    })
    expect(row.iraProRataWrite).toEqual({
      basis: 20,
      nontaxableFraction: 20 / 90,
    })
  })

  it('rejects a contradictory consumed-offset ledger and preserves exact cents', () => {
    const contradictory = call({
      qcdGrossByOwner: new Map([['owner', 10]]),
      qcdFromRmdByOwner: new Map([['owner', 8]]),
      preDistributionAggregateIraBalance: new Map([['owner', 100]]),
      qcdSection219ByDonor: new Map([['owner', 5]]),
      qcdOffsetConsumedByDonor: new Map([['owner', 600]]),
      publishCashFlow: true,
    }).rows[0]!
    expect(contradictory).toMatchObject({
      incomeOffsetDelta: 0,
      nonQualifiedOrdinaryIncomeDelta: 2,
      qcdOffsetConsumedWrite: null,
    })

    const cents = call({
      qcdGrossByOwner: new Map([['owner', 1.006]]),
      qcdFromRmdByOwner: new Map([['owner', 1.006]]),
      preDistributionAggregateIraBalance: new Map([['owner', 100]]),
      qcdSection219ByDonor: new Map([['owner', 100]]),
      qcdOffsetConsumedByDonor: new Map([['owner', 1]]),
    }).rows[0]!
    expect(cents.incomeOffsetDelta).toBe(0)
    expect(cents.qcdOffsetConsumedWrite).toBe(102)
  })

  it('preserves cancellation-sensitive left-fold row order', () => {
    const result = call({
      qcdGrossByOwner: new Map([
        ['large', 10_000_000_000_000_000],
        ['small-a', 1],
        ['small-b', 1],
      ]),
      qcdFromRmdByOwner: new Map([
        ['large', 10_000_000_000_000_000],
        ['small-a', 1],
        ['small-b', 1],
      ]),
      preDistributionAggregateIraBalance: new Map([
        ['large', 10_000_000_000_000_000],
        ['small-a', 1],
        ['small-b', 1],
      ]),
    })
    const deltas = result.rows.map((row) => row.incomeOffsetDelta)
    const leftAssociated = deltas.reduce((total, value) => total + value, 0)
    const regrouped = deltas[0]! + (deltas[1]! + deltas[2]!)

    expect(result.rows.map((row) => row.ownerId)).toEqual([
      'large',
      'small-a',
      'small-b',
    ])
    expect(leftAssociated).not.toBe(regrouped)
  })
})
