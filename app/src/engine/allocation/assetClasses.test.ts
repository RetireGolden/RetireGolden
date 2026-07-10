import { describe, expect, it } from 'vitest'

import type { AssetAllocationPolicy } from '../model/plan'
import {
  blendedReturnPct,
  blendedTaxableYield,
  choleskyDecompose,
  DEFAULT_ASSET_CLASS_PARAMS,
  DEFAULT_CLASS_CORRELATIONS,
  driftWeights,
  expectedAccountReturnPct,
  rebalanceTurnoverFraction,
  resolveAssetClassParams,
  targetWeightsAt,
  weightsToVector,
} from './assetClasses'
import { createEmptyPlan } from '../model/plan'

const W = (usStocks: number, intlStocks: number, bonds: number, cash: number) => ({ usStocks, intlStocks, bonds, cash })

describe('weightsToVector', () => {
  it('normalizes percent weights to fractions', () => {
    expect(weightsToVector(W(60, 0, 40, 0))).toEqual([0.6, 0, 0.4, 0])
  })

  it('falls back to all-cash when everything is zero', () => {
    expect(weightsToVector(W(0, 0, 0, 0))).toEqual([0, 0, 0, 1])
  })
})

describe('targetWeightsAt (glidepath compilation)', () => {
  it('static holds constant', () => {
    const policy: AssetAllocationPolicy = { mode: 'static', rebalancing: 'annual', weights: W(60, 10, 25, 5) }
    expect(targetWeightsAt(policy, 2026)).toEqual(targetWeightsAt(policy, 2060))
  })

  it('linear hits both endpoints and interpolates halfway', () => {
    const policy: AssetAllocationPolicy = {
      mode: 'linear',
      rebalancing: 'annual',
      from: W(80, 0, 20, 0),
      to: W(40, 0, 60, 0),
      startYear: 2026,
      endYear: 2046,
    }
    expect(targetWeightsAt(policy, 2026)).toEqual([0.8, 0, 0.2, 0])
    expect(targetWeightsAt(policy, 2046)).toEqual([0.4, 0, 0.6, 0])
    // Clamped outside the window.
    expect(targetWeightsAt(policy, 2020)).toEqual([0.8, 0, 0.2, 0])
    expect(targetWeightsAt(policy, 2080)).toEqual([0.4, 0, 0.6, 0])
    const mid = targetWeightsAt(policy, 2036)
    expect(mid[0]).toBeCloseTo(0.6, 10)
    expect(mid[2]).toBeCloseTo(0.4, 10)
  })

  it('staged is a step function (latest stage at/before the year)', () => {
    const policy: AssetAllocationPolicy = {
      mode: 'staged',
      rebalancing: 'annual',
      stages: [
        { fromYear: 2040, weights: W(40, 0, 60, 0) },
        { fromYear: 2026, weights: W(80, 0, 20, 0) },
      ],
    }
    expect(targetWeightsAt(policy, 2026)).toEqual([0.8, 0, 0.2, 0])
    expect(targetWeightsAt(policy, 2039)).toEqual([0.8, 0, 0.2, 0])
    expect(targetWeightsAt(policy, 2040)).toEqual([0.4, 0, 0.6, 0])
    // Before the first stage: the first stage's weights apply.
    expect(targetWeightsAt(policy, 2020)).toEqual([0.8, 0, 0.2, 0])
  })

  it('custom interpolates between year targets and clamps outside', () => {
    const policy: AssetAllocationPolicy = {
      mode: 'custom',
      rebalancing: 'annual',
      targets: [
        { year: 2030, weights: W(100, 0, 0, 0) },
        { year: 2040, weights: W(50, 0, 50, 0) },
        { year: 2050, weights: W(30, 0, 60, 10) },
      ],
    }
    expect(targetWeightsAt(policy, 2025)).toEqual([1, 0, 0, 0])
    const at2035 = targetWeightsAt(policy, 2035)
    expect(at2035[0]).toBeCloseTo(0.75, 10)
    expect(at2035[2]).toBeCloseTo(0.25, 10)
    const at2045 = targetWeightsAt(policy, 2045)
    expect(at2045[0]).toBeCloseTo(0.4, 10)
    expect(at2045[3]).toBeCloseTo(0.05, 10)
    expect(targetWeightsAt(policy, 2055)).toEqual([0.3, 0, 0.6, 0.1])
  })
})

describe('blend math', () => {
  const params = resolveAssetClassParams(undefined)

  it('blended return is the weighted class return', () => {
    // 60/40 usStocks/bonds at the default 7/4 ⇒ 5.8.
    expect(blendedReturnPct([0.6, 0, 0.4, 0], params)).toBeCloseTo(0.6 * 7 + 0.4 * 4, 10)
  })

  it('blended taxable yield weights interest, dividends, and the qualified share', () => {
    const y = blendedTaxableYield([0.5, 0, 0.5, 0], params)
    expect(y.interestYieldPct).toBeCloseTo(0.5 * 4.0, 10)
    expect(y.dividendYieldPct).toBeCloseTo(0.5 * 1.5, 10)
    expect(y.qualifiedRatio).toBeCloseTo(0.95, 10) // all dividends come from US stocks
  })

  it('assumption overrides replace only the overridden fields', () => {
    const overridden = resolveAssetClassParams({ bonds: { returnPct: 5 } })
    expect(overridden.bonds.returnPct).toBe(5)
    expect(overridden.bonds.interestYieldPct).toBe(DEFAULT_ASSET_CLASS_PARAMS.bonds.interestYieldPct)
    expect(overridden.usStocks).toEqual(DEFAULT_ASSET_CLASS_PARAMS.usStocks)
  })
})

describe('drift + rebalance turnover', () => {
  it('weights drift toward the faster-growing class and turnover restores them', () => {
    const start = [0.5, 0, 0.5, 0]
    const drifted = driftWeights(start, [20, 0, 0, 0])
    expect(drifted[0]).toBeCloseTo(0.6 / 1.1, 10)
    expect(drifted[0]! + drifted[2]!).toBeCloseTo(1, 10)
    const turnover = rebalanceTurnoverFraction(drifted, start)
    expect(turnover).toBeCloseTo(drifted[0]! - 0.5, 10)
  })

  it('turnover is zero when already at target', () => {
    expect(rebalanceTurnoverFraction([0.6, 0, 0.4, 0], [0.6, 0, 0.4, 0])).toBe(0)
  })
})

describe('expectedAccountReturnPct', () => {
  it('uses the blend for allocated accounts, superseding annualReturnPct', () => {
    const plan = createEmptyPlan({ newId: () => 'id', now: () => new Date('2026-01-01') })
    const account = {
      type: 'taxable' as const,
      id: 'a',
      name: 'a',
      ownerPersonId: null,
      annualReturnPct: 99,
      balance: 100,
      costBasis: 100,
      annualContribution: 0,
      allocation: { mode: 'static' as const, rebalancing: 'annual' as const, weights: W(60, 0, 40, 0) },
    }
    expect(expectedAccountReturnPct(account, plan.assumptions, 2026)).toBeCloseTo(0.6 * 7 + 0.4 * 4, 10)
    expect(expectedAccountReturnPct({ ...account, allocation: undefined }, plan.assumptions, 2026)).toBe(99)
  })
})

describe('choleskyDecompose', () => {
  it('reproduces the default correlation matrix (LLᵀ = C)', () => {
    const L = choleskyDecompose(DEFAULT_CLASS_CORRELATIONS)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let v = 0
        for (let k = 0; k < 4; k++) v += L[i]![k]! * L[j]![k]!
        expect(v).toBeCloseTo(DEFAULT_CLASS_CORRELATIONS[i]![j]!, 8)
      }
    }
  })
})
