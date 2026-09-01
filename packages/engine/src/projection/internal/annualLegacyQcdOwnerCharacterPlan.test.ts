import { describe, expect, it } from 'vitest'

import {
  annualLegacyQcdOwnerCharacterPlan,
  materializeAnnualLegacyQcdOwnerCharacterPlanResult,
  type AnnualLegacyQcdOwnerCharacterPlanInput,
  type AnnualLegacyQcdOwnerCharacterRow,
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
    // IRC 408(d)(8)(D) supplies the aggregate-includible ceiling and Form 8606
    // line 7 excludes the qualified gift from the year's pro-rata denominator.
    // Thus the grouped 318 opening pool with 60 basis and a 50 qualified gift
    // leaves a 268 denominator and a 60 / 268 nontaxable fraction.
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
      contradictoryOffsetLedger: false,
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
    // IRC 408(d)(8)(A), sentence two, reduces the exclusion by post-70½
    // deductible section 219 contributions net of prior lifetime reductions.
    // When that lifetime evidence is unprovable, no exclusion or replacement
    // ledger figure can be derived safely from the current-year gift alone.
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
      contradictoryOffsetLedger: false,
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
    // The shared 408(d)(8)(A) worksheet contract rejects limb (ii) greater
    // than limb (i); treating the negative remainder as zero would silently
    // grant an exclusion from contradictory cross-year evidence.
    const contradictory = call({
      qcdGrossByOwner: new Map([['owner', 10]]),
      qcdFromRmdByOwner: new Map([['owner', 8]]),
      preDistributionAggregateIraBalance: new Map([['owner', 100]]),
      qcdSection219ByDonor: new Map([['owner', 5]]),
      qcdOffsetConsumedByDonor: new Map([['owner', 600]]),
      publishCashFlow: true,
    }).rows[0]!
    expect(contradictory).toMatchObject({
      contradictoryOffsetLedger: true,
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

  it('reconciles a sub-cent §219 total with its rounded cross-year ledger', () => {
    const first = call({
      qcdGrossByOwner: new Map([['owner', 1.006]]),
      qcdFromRmdByOwner: new Map([['owner', 1.006]]),
      preDistributionAggregateIraBalance: new Map([['owner', 100]]),
      qcdSection219ByDonor: new Map([['owner', 1.006]]),
    }).rows[0]!
    expect(first.incomeOffsetDelta).toBe(0)
    expect(first.qcdOffsetConsumedWrite).toBe(101)

    const second = call({
      qcdGrossByOwner: new Map([['owner', 2]]),
      qcdFromRmdByOwner: new Map([['owner', 2]]),
      preDistributionAggregateIraBalance: new Map([['owner', 100]]),
      qcdSection219ByDonor: new Map([['owner', 1.006]]),
      qcdOffsetConsumedByDonor: new Map([['owner', first.qcdOffsetConsumedWrite!]]),
    }).rows[0]!
    expect(second.incomeOffsetDelta).toBe(2)
    expect(second.qcdOffsetConsumedWrite).toBe(101)
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

  it('materializes hostile row/write iterables before returning caller-owned arrays', () => {
    const reads: string[] = []
    const proRata = {
      get basis() {
        reads.push('proRata.basis')
        return 25
      },
      get nontaxableFraction() {
        reads.push('proRata.nontaxableFraction')
        return 0.25
      },
    }
    const row = {
      get ownerId() { reads.push('row.ownerId'); return 'owner' },
      get contradictoryOffsetLedger() {
        reads.push('row.contradictory')
        return false
      },
      get qualifiedFromRmd() { reads.push('row.qualified'); return 10 },
      get nonQualifiedBeyondRmd() { reads.push('row.nonQualified'); return 2 },
      get incomeOffsetDelta() { reads.push('row.offset'); return 3 },
      get nonQualifiedOrdinaryIncomeDelta() {
        reads.push('row.ordinary')
        return 4
      },
      get qcdOffsetConsumedWrite() { reads.push('row.consumed'); return 500 },
      get iraProRataWrite() { reads.push('row.proRata'); return proRata },
      get cashFlowWrites() {
        reads.push('row.writes')
        return {
          *[Symbol.iterator]() {
            reads.push('writes.iterate')
            yield {
              get ownerId() { reads.push('write.ownerId'); return 'owner' },
              get target() {
                reads.push('write.target')
                return 'ordinaryBeyondRmd' as const
              },
              get value() { reads.push('write.value'); return 4 },
            }
          },
        }
      },
    } as unknown as AnnualLegacyQcdOwnerCharacterRow
    const result = materializeAnnualLegacyQcdOwnerCharacterPlanResult({
      rows: {
        *[Symbol.iterator]() {
          reads.push('rows.iterate')
          yield row
        },
      } as unknown as readonly AnnualLegacyQcdOwnerCharacterRow[],
    }, ['owner'])

    expect(reads).toEqual([
      'rows.iterate',
      'row.ownerId',
      'row.contradictory',
      'row.qualified',
      'row.nonQualified',
      'row.offset',
      'row.ordinary',
      'row.consumed',
      'row.proRata',
      'proRata.basis',
      'proRata.nontaxableFraction',
      'row.writes',
      'writes.iterate',
      'write.ownerId',
      'write.target',
      'write.value',
    ])
    expect(result.rows).toEqual([{
      ownerId: 'owner',
      contradictoryOffsetLedger: false,
      qualifiedFromRmd: 10,
      nonQualifiedBeyondRmd: 2,
      incomeOffsetDelta: 3,
      nonQualifiedOrdinaryIncomeDelta: 4,
      qcdOffsetConsumedWrite: 500,
      iraProRataWrite: proRata,
      iraProRataReadSnapshot: { basis: 25, nontaxableFraction: 0.25 },
      cashFlowWrites: [{
        ownerId: 'owner', target: 'ordinaryBeyondRmd', value: 4,
      }],
    }])
    expect(result.rows).not.toBe(row)
    expect(result.rows[0]!.cashFlowWrites).not.toBe(row.cashFlowWrites)
    expect(result.rows[0]!.iraProRataWrite).toBe(proRata)
    expect(result.rows[0]!.iraProRataReadSnapshot).not.toBe(proRata)
  })

  it('rejects an unknown cash-flow target during materialization', () => {
    const row = call({
      qcdGrossByOwner: new Map([['owner', 1]]),
      preDistributionAggregateIraBalance: new Map([['owner', 1]]),
      publishCashFlow: true,
    }).rows[0]!
    const hostile = {
      ...row,
      cashFlowWrites: [{
        ownerId: 'owner', target: 'future-target', value: 1,
      }],
    } as unknown as AnnualLegacyQcdOwnerCharacterRow

    expect(() => materializeAnnualLegacyQcdOwnerCharacterPlanResult({
      rows: [hostile],
    }, ['owner'])).toThrow('Unknown legacy QCD cash-flow target: future-target')
  })

  it.each([
    ['empty', [], ['p1']],
    ['truncated', [{ ownerId: 'p1' }], ['p1', 'p2']],
    ['reordered', [{ ownerId: 'p2' }, { ownerId: 'p1' }], ['p1', 'p2']],
    ['duplicate', [{ ownerId: 'p1' }, { ownerId: 'p1' }], ['p1', 'p2']],
    ['extra', [{ ownerId: 'p1' }, { ownerId: 'p2' }, { ownerId: 'p3' }], ['p1', 'p2']],
  ])('rejects %s owner rows before publication', (_name, shapes, expected) => {
    const rows = shapes.map(({ ownerId }) => ({
      ownerId,
      contradictoryOffsetLedger: false,
      qualifiedFromRmd: 0,
      nonQualifiedBeyondRmd: 0,
      incomeOffsetDelta: 0,
      nonQualifiedOrdinaryIncomeDelta: 0,
      qcdOffsetConsumedWrite: 100,
      iraProRataWrite: null,
      cashFlowWrites: [],
    }))

    expect(() => materializeAnnualLegacyQcdOwnerCharacterPlanResult(
      { rows },
      expected,
    )).toThrow(/Legacy QCD owner-character row|lost cardinality/u)
  })

  it('rejects a cash-flow write attributed to another owner', () => {
    const row = {
      ownerId: 'p1',
      contradictoryOffsetLedger: false,
      qualifiedFromRmd: 0,
      nonQualifiedBeyondRmd: 0,
      incomeOffsetDelta: 0,
      nonQualifiedOrdinaryIncomeDelta: 0,
      qcdOffsetConsumedWrite: null,
      iraProRataWrite: null,
      cashFlowWrites: [{
        ownerId: 'p2', target: 'exclusionFromRmd' as const, value: 1,
      }],
    }

    expect(() => materializeAnnualLegacyQcdOwnerCharacterPlanResult(
      { rows: [row] },
      ['p1'],
    )).toThrow('does not match row owner')
  })
})
