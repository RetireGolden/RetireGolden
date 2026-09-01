import { describe, expect, it, vi } from 'vitest'

import {
  driftWeights,
  type AssetClassParams,
} from '../../allocation/assetClasses.js'
import {
  ASSET_CLASS_IDS,
  type AssetClassId,
} from '../../model/plan.js'
import type { PhysicalBalanceAccount } from './annualLogicalBalanceLedger.js'
import {
  annualPostSolveAccountGrowth,
  type AnnualPostSolveAccountGrowthInput,
  type AnnualPostSolveAccountGrowthState,
} from './annualPostSolveAccountGrowth.js'

type TestGrowthState = AnnualPostSolveAccountGrowthState & {
  readonly costBasis: number
}

const classParams = (returns: readonly number[]): Record<AssetClassId, AssetClassParams> =>
  Object.fromEntries(
    ASSET_CLASS_IDS.map((id, index) => [id, {
      label: id,
      returnPct: returns[index]!,
      volatilityPct: 0,
      interestYieldPct: 0,
      dividendYieldPct: 0,
      qualifiedRatioPct: 0,
    }]),
  ) as Record<AssetClassId, AssetClassParams>

const state = (
  type: PhysicalBalanceAccount['type'],
  balance: number,
  annualReturnPct: number | null,
  costBasis = 0,
): TestGrowthState => ({
  account: { type, annualReturnPct },
  balance,
  costBasis,
})

const baseInput = (
  states: readonly AnnualPostSolveAccountGrowthState[],
): AnnualPostSolveAccountGrowthInput => ({
  states,
  allocationTrack: new Map(),
  distributedYieldByBalanceIndex: new Map(),
  classParams: classParams([7, 7, 4, 2.5]),
  defaultReturnPct: 6,
  shockPct: -3,
  year: 2030,
  classShockAt: () => 0,
})

describe('annualPostSolveAccountGrowth', () => {
  it('keeps cash stable, shocks invested accounts, and carves taxable yield only from price growth', () => {
    const states = [
      state('cash', 100, 2),
      state('taxable', 200, 8, 50),
      state('traditional', 300, null),
    ]
    const distributedYieldByBalanceIndex = new Map([
      [1, { gross: 8, distributedYieldPct: 2, reinvest: true }],
      // This cannot be emitted by annualIncomeSetup, but proves the growth
      // contract still ignores a non-taxable row's distributed-yield percent.
      [2, { gross: 99, distributedYieldPct: 99, reinvest: false }],
    ])
    const classShockAt = vi.fn(() => 999)

    const result = annualPostSolveAccountGrowth({
      ...baseInput(states),
      distributedYieldByBalanceIndex,
      classShockAt,
    })

    expect(result.rows).toEqual([
      { kind: 'singleReturn', marketClosingBalance: 102, reinvestedYield: 0 },
      { kind: 'singleReturn', marketClosingBalance: 206, reinvestedYield: 8 },
      { kind: 'singleReturn', marketClosingBalance: 309, reinvestedYield: 0 },
    ])
    // Total return keeps the distributed 2%; only price growth carves it out.
    expect(result.priorYearPortfolioReturnPct).toBe(
      (100 * 2 + 200 * 5 + 300 * 3) / 600,
    )
    expect(classShockAt).not.toHaveBeenCalled()
    expect(states.map((entry) => [entry.balance, entry.costBasis])).toEqual([
      [100, 0],
      [200, 50],
      [300, 0],
    ])
  })

  it('blends allocated returns in physical-row order and returns drifted weights without mutating tracks', () => {
    const states = [
      state('taxable', 100, 99, 40),
      state('roth', 50, 99),
    ]
    const firstWeights = [0.5, 0.25, 0.25, 0]
    const secondWeights = [0, 0, 0, 1]
    const allocationTrack = new Map([
      ['0', { weights: firstWeights }],
      ['1', { weights: secondWeights }],
    ])
    const shocks = [1, 2, 3, 4]
    const classShockAt = vi.fn((_year: number, classIndex: number) => shocks[classIndex]!)
    const params = classParams([10, 0, -10, 2])

    const result = annualPostSolveAccountGrowth({
      ...baseInput(states),
      allocationTrack,
      distributedYieldByBalanceIndex: new Map([
        [0, { gross: 5, distributedYieldPct: 1.25, reinvest: true }],
      ]),
      classParams: params,
      classShockAt,
    })

    const classRates = [11, 2, -7, 6]
    const firstBlend = 4.25
    const secondBlend = 6
    expect(result.rows).toEqual([
      {
        kind: 'allocated',
        marketClosingBalance: 103,
        driftedWeights: driftWeights(firstWeights, classRates),
        reinvestedYield: 5,
      },
      {
        kind: 'allocated',
        marketClosingBalance: 53,
        driftedWeights: driftWeights(secondWeights, classRates),
        reinvestedYield: 0,
      },
    ])
    expect(result.priorYearPortfolioReturnPct).toBe(
      (100 * firstBlend + 50 * secondBlend) / 150,
    )
    expect(classShockAt.mock.calls).toEqual([
      [2030, 0], [2030, 1], [2030, 2], [2030, 3],
      [2030, 0], [2030, 1], [2030, 2], [2030, 3],
    ])
    expect(allocationTrack.get('0')!.weights).toBe(firstWeights)
    expect(allocationTrack.get('1')!.weights).toBe(secondWeights)
  })

  it('keeps compatible duplicate rows positional for yield carve-out and reinvestment', () => {
    const states = [
      state('taxable', 100, 10, 20),
      state('taxable', 100, 10, 80),
    ]
    const result = annualPostSolveAccountGrowth({
      ...baseInput(states),
      shockPct: 0,
      distributedYieldByBalanceIndex: new Map([
        [0, { gross: 1, distributedYieldPct: 1, reinvest: true }],
        [1, { gross: 8, distributedYieldPct: 4, reinvest: true }],
      ]),
    })

    expect(result.rows).toEqual([
      {
        kind: 'singleReturn',
        marketClosingBalance: 100 * Math.max(0, 1 + (10 - 1) / 100),
        reinvestedYield: 1,
      },
      {
        kind: 'singleReturn',
        marketClosingBalance: 100 * Math.max(0, 1 + (10 - 4) / 100),
        reinvestedYield: 8,
      },
    ])
    expect(result.priorYearPortfolioReturnPct).toBe(10)
  })

  it('floors a market loss at zero without flooring the realized return signal', () => {
    const result = annualPostSolveAccountGrowth({
      ...baseInput([state('traditional', 10, -250)]),
      shockPct: 0,
    })

    expect(result.rows).toEqual([
      { kind: 'singleReturn', marketClosingBalance: 0, reinvestedYield: 0 },
    ])
    expect(result.priorYearPortfolioReturnPct).toBe(-250)
  })

  it('also floors an allocated market loss without flooring its return signal', () => {
    const weights = [1, 0, 0, 0]
    const result = annualPostSolveAccountGrowth({
      ...baseInput([state('traditional', 10, 999)]),
      allocationTrack: new Map([['0', { weights }]]),
      classParams: classParams([-250, 0, 0, 0]),
    })

    expect(result.rows[0]).toEqual({
      kind: 'allocated',
      marketClosingBalance: 0,
      driftedWeights: weights,
      reinvestedYield: 0,
    })
    expect(result.priorYearPortfolioReturnPct).toBe(-250)
  })

  it('returns a zero portfolio signal for a zero wealth base', () => {
    const result = annualPostSolveAccountGrowth({
      ...baseInput([
        state('cash', 0, 2),
        state('taxable', 0, 8),
      ]),
      distributedYieldByBalanceIndex: new Map([
        [1, { gross: 3, distributedYieldPct: 2, reinvest: true }],
      ]),
    })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[1]!.reinvestedYield).toBe(3)
    expect(result.priorYearPortfolioReturnPct).toBe(0)
  })

  it('returns no rows and does not read shocks when there are no balance states', () => {
    const classShockAt = vi.fn(() => 999)

    const result = annualPostSolveAccountGrowth({
      ...baseInput([]),
      classShockAt,
    })

    expect(result).toEqual({ rows: [], priorYearPortfolioReturnPct: 0 })
    expect(classShockAt).not.toHaveBeenCalled()
  })
})
