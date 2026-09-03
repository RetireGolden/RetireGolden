/**
 * Monte Carlo class-level correlated shocks
 * (asset-allocation-and-return-model-v2, step 6): seeded determinism, base
 * single-factor/inflation series preserved bit-for-bit with class shocks on,
 * correlation sanity, and mean preservation.
 */

import { describe, expect, it } from 'vitest'

import { DEFAULT_ASSET_CLASS_PARAMS } from '../allocation/assetClasses.js'
import { ASSET_CLASS_IDS, type AssetClassId } from '../model/plan.js'
import {
  type ClassShockConfig,
  createAR1Model,
  createCapeConditionedModel,
  createGarchModel,
  createGaussianModel,
  createHistoricalModel,
  createInflationRegimeModel,
  createLognormalModel,
  createRegimeSwitchModel,
  createStudentTModel,
  createUserShockModel,
  type MarketModel,
} from './marketModels.js'
import { createRng, type Rng } from './rng.js'

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

/**
 * Every model that mixes its class shocks through the shared Cholesky sampler,
 * table-driven. Two of eleven class-shock-capable models used to be covered
 * here, so "mean-preserving around the expected return" was pinned for
 * lognormal only while three others use the same formula and four deliberately
 * use the additive one, and nothing recorded which was intended where.
 *
 * Two assertions pin the convention, and neither is statistical.
 *
 * `centeringConstant` — a class configured at zero volatility collapses its
 * transform to whatever the model adds on top of the draw, so the whole series
 * equals that constant exactly.
 *
 * `family` — the constant alone cannot tell mean-preserving lognormal from
 * additive, since both collapse to the same value at zero volatility. A class
 * at a deliberately extreme volatility separates them by shape: a lognormal
 * gross multiplier is positive, so its shock can never reach -100%, while an
 * additive shock is unbounded and crosses it easily at that volatility.
 */
const ZERO_VOL_CLASS = 'cash' satisfies AssetClassId

/** Class vols with `cash` forced to zero so its series exposes the centering constant. */
const volsWithFlatCash: Record<AssetClassId, number> = { ...defaultVols, [ZERO_VOL_CLASS]: 0 }

/** Absurd on purpose: 200% annual vol makes the two families' shapes diverge. */
const EXTREME_VOL_PCT = 200
const volsWithExtremeCash: Record<AssetClassId, number> = {
  ...defaultVols,
  [ZERO_VOL_CLASS]: EXTREME_VOL_PCT,
}

/** An Rng that reports how many standard normals were drawn through it. */
function countingRng(seed: number): { rng: Rng; normalsDrawn: () => number } {
  const inner = createRng(seed)
  let normals = 0
  return {
    rng: {
      next: () => inner.next(),
      nextInt: (n: number) => inner.nextInt(n),
      nextNormal: () => {
        normals += 1
        return inner.nextNormal()
      },
    },
    normalsDrawn: () => normals,
  }
}

interface CholeskyModelCase {
  readonly name: string
  /** The convention this model applies on top of the correlated draw. */
  readonly centering: string
  /** What every year of a zero-volatility class must equal under that convention. */
  readonly centeringConstant: number
  /** Bounded below by the centering constant less 100 (lognormal), or not (additive). */
  readonly family: 'mean-preserving-lognormal' | 'additive'
  readonly build: (classShocks?: ClassShockConfig) => MarketModel
}

const CHOLESKY_MODELS: readonly CholeskyModelCase[] = [
  {
    name: 'lognormal',
    family: 'mean-preserving-lognormal',
    centering: 'mean-preserving lognormal: (exp(sx - s^2/2) - 1) * 100',
    centeringConstant: 0,
    build: (classShocks) => createLognormalModel({ type: 'lognormal', inflationMeanPct: 2.5, classShocks }),
  },
  {
    name: 'student-t',
    family: 'additive',
    centering: 'additive: s * x * 100, zero-centered like its own fat-tailed return shock',
    centeringConstant: 0,
    build: (classShocks) => createStudentTModel({ type: 'student-t', df: 4, inflationMeanPct: 2.5, classShocks }),
  },
  {
    name: 'regime-switch',
    family: 'additive',
    centering: 'additive around the current regime mean: (mu + s * x) * 100',
    // Deliberately NOT zero: with bull and bear vol both zeroed out for this
    // class the series still steps between the two regime means, which is the
    // whole point of the convention. Asserted below as a two-valued set.
    centeringConstant: Number.NaN,
    build: (classShocks) => createRegimeSwitchModel({ type: 'regime-switch', inflationMeanPct: 2.5, classShocks }),
  },
  {
    name: 'cape-conditioned',
    family: 'mean-preserving-lognormal',
    centering: 'mean-preserving lognormal plus the CAPE mean adjustment',
    // startingCape 30, sensitivity 0.15 => -(30 - 20) * 0.15 = -1.5pp, inside
    // the model's [-4, +2] clamp.
    centeringConstant: -1.5,
    build: (classShocks) =>
      createCapeConditionedModel({
        type: 'cape-conditioned',
        startingCape: 30,
        capeSensitivity: 0.15,
        inflationMeanPct: 2.5,
        classShocks,
      }),
  },
  {
    name: 'garch',
    family: 'additive',
    centering: 'additive: s * x * 100 (class vol is static; only the single factor is GARCH)',
    centeringConstant: 0,
    build: (classShocks) => createGarchModel({ type: 'garch', inflationMeanPct: 2.5, classShocks }),
  },
  {
    name: 'inflation-regime',
    family: 'mean-preserving-lognormal',
    centering: 'mean-preserving lognormal (the regime moves inflation, not the class shocks)',
    centeringConstant: 0,
    build: (classShocks) =>
      createInflationRegimeModel({ type: 'inflation-regime', baseInflationMeanPct: 2.5, classShocks }),
  },
  {
    name: 'gaussian',
    family: 'additive',
    centering: 'additive: s * x * 100',
    centeringConstant: 0,
    build: (classShocks) => createGaussianModel({ type: 'gaussian', inflationMeanPct: 2.5, classShocks }),
  },
  {
    name: 'ar1',
    family: 'additive',
    centering: 'additive: s * x * 100, mixed off the AR(1) innovation rather than the level',
    centeringConstant: 0,
    build: (classShocks) => createAR1Model({ type: 'ar1', phi: 0.35, inflationMeanPct: 2.5, classShocks }),
  },
  {
    name: 'user-shock',
    family: 'mean-preserving-lognormal',
    centering: 'mean-preserving lognormal outside the shock year; the shock year is id-driven',
    centeringConstant: 0,
    build: (classShocks) =>
      createUserShockModel({ type: 'user-shock', shockYear: 3, shockPct: -25, inflationMeanPct: 2.5, classShocks }),
  },
]

describe.each(CHOLESKY_MODELS)('$name class shocks', (model) => {
  const withClasses = model.build({ volatilityPctByClass: defaultVols })

  it('is deterministic for a fixed seed', () => {
    const a = withClasses.generatePath(createRng(7), 30)
    const b = withClasses.generatePath(createRng(7), 30)
    expect(b.classReturnShockPct).toEqual(a.classReturnShockPct)
    expect(b.returnShockPct).toEqual(a.returnShockPct)
  })

  it('takes its extra draws after the year\'s own, so year one is unmoved', () => {
    // The class draws are appended per year, never interleaved: at the same
    // seed the first year's single-factor and inflation values are identical
    // with class shocks on and off. (Later years legitimately diverge — the
    // extra draws have been consumed by then.)
    const without = model.build()
    const a = without.generatePath(createRng(42), 50)
    const b = withClasses.generatePath(createRng(42), 50)
    expect(a.classReturnShockPct).toBeUndefined()
    expect(b.returnShockPct![0]).toBe(a.returnShockPct![0])
    expect(b.inflationPct![0]).toBe(a.inflationPct![0])
    for (const id of ASSET_CLASS_IDS) expect(b.classReturnShockPct![id]).toHaveLength(50)
  })

  it('draws one extra normal per class beyond the first, sized from ASSET_CLASS_IDS', () => {
    // The draw vector used to be a hardcoded 4-element literal in each model,
    // so a fifth asset class would have truncated the Cholesky mix in every
    // copy. This counts the actual consumption instead of trusting the shape.
    const years = 12
    const on = countingRng(31)
    model.build({ volatilityPctByClass: defaultVols }).generatePath(on.rng, years)
    const off = countingRng(31)
    model.build().generatePath(off.rng, years)
    expect(on.normalsDrawn() - off.normalsDrawn()).toBe(years * (ASSET_CLASS_IDS.length - 1))
  })

  it(`centers class shocks as: ${model.centering}`, () => {
    const flatCash = model.build({ volatilityPctByClass: volsWithFlatCash })
    const series = flatCash.generatePath(createRng(19), 200).classReturnShockPct![ZERO_VOL_CLASS]!
    if (model.name === 'regime-switch') {
      // Two regime means, ±4pp by default, and nothing else.
      expect([...new Set(series)].sort((x, y) => x - y)).toEqual([-4, 4])
      return
    }
    if (model.name === 'user-shock') {
      // Year 3 (1-based) holds cash flat at 0 by class id, which coincides with
      // this convention's constant; every other year is the lognormal centre.
      expect(series.every((v) => v === 0)).toBe(true)
      return
    }
    for (const value of series) expect(value).toBeCloseTo(model.centeringConstant, 12)
  })

  it(`has the ${model.family} shape at extreme volatility`, () => {
    const extreme = model.build({ volatilityPctByClass: volsWithExtremeCash })
    const series = extreme.generatePath(createRng(23), 400).classReturnShockPct![ZERO_VOL_CLASS]!
    const min = Math.min(...series)
    if (model.family === 'mean-preserving-lognormal') {
      // exp() is positive, so the gross multiplier never reaches zero: the
      // shock floor is -100% plus whatever the model adds on top. user-shock's
      // shock year holds cash at 0, which is above the floor either way.
      const floor = -100 + (Number.isNaN(model.centeringConstant) ? 0 : model.centeringConstant)
      expect(min).toBeGreaterThan(floor)
      // ...and the same asymmetry gives it a tail the additive form cannot reach.
      expect(Math.max(...series)).toBeGreaterThan(1_000)
    } else {
      // s * x * 100 is symmetric and unbounded; at 200% vol a 400-year path
      // crosses -100% many times over, which the lognormal form never can.
      expect(min).toBeLessThan(-100)
    }
  })
})
