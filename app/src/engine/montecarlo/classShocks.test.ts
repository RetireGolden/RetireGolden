/**
 * Monte Carlo class-level correlated shocks
 * (asset-allocation-and-return-model-v2, step 6): seeded determinism, base
 * single-factor/inflation series preserved bit-for-bit with class shocks on,
 * correlation sanity, and mean preservation.
 */

import { describe, expect, it } from 'vitest'

import { DEFAULT_ASSET_CLASS_PARAMS } from '../allocation/assetClasses'
import { ASSET_CLASS_IDS, type AssetClassId } from '../model/plan'
import { createHistoricalModel, createLognormalModel } from './marketModels'
import { createRng } from './rng'

const YEARS = 2_000

const defaultVols = Object.fromEntries(
  ASSET_CLASS_IDS.map((id) => [id, DEFAULT_ASSET_CLASS_PARAMS[id].volatilityPct]),
) as Record<AssetClassId, number>

function correlation(a: number[], b: number[]): number {
  const n = a.length
  const meanA = a.reduce((x, y) => x + y, 0) / n
  const meanB = b.reduce((x, y) => x + y, 0) / n
  let cov = 0
  let varA = 0
  let varB = 0
  for (let i = 0; i < n; i++) {
    cov += (a[i]! - meanA) * (b[i]! - meanB)
    varA += (a[i]! - meanA) ** 2
    varB += (b[i]! - meanB) ** 2
  }
  return cov / Math.sqrt(varA * varB)
}

describe('lognormal class shocks', () => {
  const withClasses = createLognormalModel({
    type: 'lognormal',
    inflationMeanPct: 2.5,
    classShocks: { volatilityPctByClass: defaultVols },
  })

  it('class-free config emits no class series and stays on the pre-feature draw order', () => {
    // classShocks off consumes exactly two draws per year, so single-return
    // plans reproduce their current distributions bit-for-bit. (With class
    // shocks on, extra per-year draws legitimately shift later years.)
    const without = createLognormalModel({ type: 'lognormal', inflationMeanPct: 2.5 })
    const a = without.generatePath(createRng(42), 50)
    expect(a.classReturnShockPct).toBeUndefined()
    const b = withClasses.generatePath(createRng(42), 50)
    expect(b.classReturnShockPct).toBeDefined()
    for (const id of ASSET_CLASS_IDS) expect(b.classReturnShockPct![id]).toHaveLength(50)
    // Same seed ⇒ the first year's market draw is shared before any extra draws.
    expect(b.returnShockPct![0]).toBe(a.returnShockPct![0])
    expect(b.inflationPct![0]).toBe(a.inflationPct![0])
  })

  it('is deterministic for a fixed seed', () => {
    const a = withClasses.generatePath(createRng(7), 30)
    const b = withClasses.generatePath(createRng(7), 30)
    expect(b.classReturnShockPct).toEqual(a.classReturnShockPct)
  })

  it('correlated classes co-move under a fixed seed (correlation sanity)', () => {
    const path = withClasses.generatePath(createRng(11), YEARS)
    const c = path.classReturnShockPct!
    const usIntl = correlation(c.usStocks!, c.intlStocks!)
    const usBonds = correlation(c.usStocks!, c.bonds!)
    // Configured 0.75 vs 0.10 — sampled values sit near them and stay ordered.
    expect(usIntl).toBeGreaterThan(0.6)
    expect(usBonds).toBeLessThan(0.3)
    expect(usIntl).toBeGreaterThan(usBonds)
    // The US-stock class shock rides the same market factor as the single-factor shock.
    expect(correlation(c.usStocks!, path.returnShockPct!)).toBeGreaterThan(0.95)
  })

  it('class shocks are mean-preserving around the expected return', () => {
    const path = withClasses.generatePath(createRng(3), YEARS)
    for (const id of ASSET_CLASS_IDS) {
      const series = path.classReturnShockPct![id]!
      const mean = series.reduce((x, y) => x + y, 0) / series.length
      // E[shock] = 0 by construction; tolerance scales with class volatility.
      expect(Math.abs(mean)).toBeLessThan(Math.max(0.2, DEFAULT_ASSET_CLASS_PARAMS[id].volatilityPct / 10))
    }
  })
})

describe('historical class shocks', () => {
  it('keeps the sampled base series identical and keys class shocks off the same years', () => {
    const without = createHistoricalModel({ type: 'historical', mode: 'sequence' })
    const withClasses = createHistoricalModel({ type: 'historical', mode: 'sequence', classShocks: true })
    const a = without.generatePath(createRng(5), 60)
    const b = withClasses.generatePath(createRng(5), 60)
    expect(b.returnShockPct).toEqual(a.returnShockPct)
    expect(b.inflationPct).toEqual(a.inflationPct)
    const c = b.classReturnShockPct!
    // International proxies the US stock series; cash is stable value.
    expect(c.intlStocks).toEqual(c.usStocks)
    expect(c.cash!.every((v) => v === 0)).toBe(true)
    // Stocks and bonds differ (different historical series).
    expect(c.usStocks).not.toEqual(c.bonds)
  })

  it('centers each class on its own historical mean over a full replay', () => {
    const model = createHistoricalModel({ type: 'historical', mode: 'sequence', classShocks: true })
    // 96 years = one full wrap of the 1928–2023 dataset from any start.
    const path = model.generatePath(createRng(9), 96)
    for (const id of ['usStocks', 'bonds'] as const) {
      const series = path.classReturnShockPct![id]!
      const mean = series.reduce((x, y) => x + y, 0) / series.length
      expect(Math.abs(mean)).toBeLessThan(1e-9)
    }
  })
})
