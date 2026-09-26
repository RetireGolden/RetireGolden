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
    centering: 'additive: s * m * x * 100, zero-centered, with the market factor\'s t scale m shared by every class',
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
    centering: 'additive: s * x * 100, scaled each year by the market factor\'s sqrt(v_t) / sigmaBar, so classes cluster with it',
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
      // Every year is 0 here, but that is not evidence about the shock year:
      // cash is the zero-vol class, so the lognormal centre and the shock
      // year's flat-cash rule produce the same 0. This case pins the
      // non-shock years only. The id-driven shock year is pinned at non-zero
      // volatility by the dedicated suite below, which is what would fail if
      // the transform stopped reading AssetClassId.
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

/**
 * user-shock owns the only per-class transform that reads `AssetClassId`, so
 * it is the one model the generic table above cannot discriminate: at the
 * zero-vol class the id rule and the lognormal centre agree on 0. These cases
 * run every class at its real volatility, where the two disagree in every
 * class, and pin the documented rule — in the shock year cash is held flat,
 * equities take the shock in full, everything else takes 60% of it.
 */
describe('user-shock class shocks — the id-driven shock year', () => {
  const SHOCK_YEAR = 3 // 1-based, so index 2
  const SHOCK_PCT = -25
  const shocked = createUserShockModel({
    type: 'user-shock',
    shockYear: SHOCK_YEAR,
    shockPct: SHOCK_PCT,
    inflationMeanPct: 2.5,
    classShocks: { volatilityPctByClass: defaultVols },
  })
  const path = shocked.generatePath(createRng(19), 40).classReturnShockPct!
  const shockIndex = SHOCK_YEAR - 1

  it('holds cash flat and prices the risk classes off the shock, not the draw', () => {
    expect(path.cash![shockIndex]).toBe(0)
    expect(path.usStocks![shockIndex]).toBe(SHOCK_PCT)
    expect(path.intlStocks![shockIndex]).toBe(SHOCK_PCT)
    expect(path.bonds![shockIndex]).toBeCloseTo(SHOCK_PCT * 0.6, 12)
  })

  it('leaves every other year on the lognormal centre, cash included', () => {
    // Cash carries real volatility here, so a shock-year rule that leaked into
    // the neighbouring years would show up as an exact 0 or an exact -25.
    for (const id of ASSET_CLASS_IDS) {
      for (let i = 0; i < path[id]!.length; i++) {
        if (i === shockIndex) continue
        expect(path[id]![i]).not.toBe(0)
        expect(path[id]![i]).not.toBe(SHOCK_PCT)
      }
    }
  })

  it('applies the rule in the configured year only, wherever that year is', () => {
    // Guards against the index being read off `i` rather than the 1-based
    // `shockYear`: move the shock and the flat-cash year moves with it.
    const later = createUserShockModel({
      type: 'user-shock',
      shockYear: 9,
      shockPct: SHOCK_PCT,
      inflationMeanPct: 2.5,
      classShocks: { volatilityPctByClass: defaultVols },
    }).generatePath(createRng(19), 40).classReturnShockPct!
    expect(later.cash![8]).toBe(0)
    expect(later.usStocks![8]).toBe(SHOCK_PCT)
    expect(later.cash![shockIndex]).not.toBe(0)
  })
})

/**
 * Student-t and GARCH share one scale between the market factor and every
 * class (D-STUDENT-T-MIXTURE and D-GARCH-FEEDBACK, decided 2026-09-25). A
 * sampler fed only the first factor would still pass every table case above,
 * because those look at one class at a time and at the draw count. These cases
 * drive the same scripted draws through the model and through the Gaussian
 * model, which mixes the same Cholesky draw with no shared scale, so the ratio
 * of the two class series is the shared scale itself.
 */
describe('class shocks that share the market factor\'s scale', () => {
  function scripted(normals: readonly number[], uniforms: readonly number[] = []): Rng {
    let n = 0
    let u = 0
    return {
      nextNormal: () => {
        const draw = normals[n]
        if (draw === undefined) throw new RangeError(`normal ${n} was not scripted`)
        n += 1
        return draw
      },
      next: () => {
        const draw = uniforms[u]
        if (draw === undefined) throw new RangeError(`uniform ${u} was not scripted`)
        u += 1
        return draw
      },
      nextInt: () => {
        throw new RangeError('no integer draw was scripted')
      },
    }
  }
  const classShocks = { volatilityPctByClass: defaultVols }
  // Per year: Z (the market factor), z2 (inflation), then one normal per class beyond the first.
  const yearOne = [1, 0, 0.3, -1.2, 0.7]
  const yearTwo = [-0.4, 0.2, 1.1, 0.5, -0.9]
  const gaussian = createGaussianModel({ type: 'gaussian', inflationMeanPct: 2.5, classShocks }).generatePath(
    scripted([...yearOne, ...yearTwo]),
    2,
  ).classReturnShockPct!

  it('student-t: every class draw is the Gaussian one times m = sqrt((df − 2) / V), and usStocks equals the market t', () => {
    // Uniforms 0.5, 0, 0.5 give V = 8.805870575472607 (the worksheet case B1), so m = 0.5836795510996967.
    const m = 0.5836795510996967
    const path = createStudentTModel({ type: 'student-t', df: 5, returnVolPct: 12, inflationMeanPct: 2.5, classShocks })
      .generatePath(scripted(yearOne, [0.5, 0, 0.5]), 1)
    for (const id of ASSET_CLASS_IDS) {
      expect(path.classReturnShockPct![id]![0]!).toBeCloseTo(gaussian[id]![0]! * m, 12)
    }
    // usStocks at the market's own 12% volatility would equal the market shock; at its class
    // volatility it is that shock times usStocks vol / 12, because Cholesky row 0 is [1, 0, 0, 0].
    expect(path.classReturnShockPct!.usStocks![0]!).toBeCloseTo((path.returnShockPct![0]! * defaultVols.usStocks) / 12, 12)
  })

  it('garch: year 1 has scale 1 (v_1 = sigmaBar^2); after Z1 = 1 the year-2 scale is sqrt(v_2) / sigmaBar = 1', () => {
    // Z1 = 1 leaves v_2 = 0.00072 + 0.1 * 0.0144 + 0.85 * 0.0144 = 0.0144, so the scale stays 1.
    const path = createGarchModel({ type: 'garch', inflationMeanPct: 2.5, classShocks }).generatePath(
      scripted([...yearOne, ...yearTwo]),
      2,
    ).classReturnShockPct!
    for (const id of ASSET_CLASS_IDS) {
      expect(path[id]![0]!).toBeCloseTo(gaussian[id]![0]!, 12)
      expect(path[id]![1]!).toBeCloseTo(gaussian[id]![1]!, 12)
    }
  })

  it('garch: after a 2-sigma year the next year\'s class shocks are sqrt(1.3) times the static ones', () => {
    // Z1 = 2: e_1 = 0.24, v_2 = 0.00072 + 0.1 * 0.0576 + 0.85 * 0.0144 = 0.01872 = 1.3 * 0.0144.
    const bigYear = [2, ...yearOne.slice(1)]
    const staticPath = createGaussianModel({ type: 'gaussian', inflationMeanPct: 2.5, classShocks }).generatePath(
      scripted([...bigYear, ...yearTwo]),
      2,
    ).classReturnShockPct!
    const garchPath = createGarchModel({ type: 'garch', inflationMeanPct: 2.5, classShocks }).generatePath(
      scripted([...bigYear, ...yearTwo]),
      2,
    ).classReturnShockPct!
    for (const id of ASSET_CLASS_IDS) {
      expect(garchPath[id]![0]!).toBeCloseTo(staticPath[id]![0]!, 12)
      if (id === 'cash' && defaultVols.cash === 0) continue
      expect(garchPath[id]![1]! / staticPath[id]![1]!).toBeCloseTo(Math.sqrt(1.3), 12)
    }
  })

  it('garch at returnVolPct 0: the market is flat, so the class shocks keep their static volatilities', () => {
    const flat = createGarchModel({ type: 'garch', returnVolPct: 0, inflationMeanPct: 2.5, classShocks }).generatePath(
      scripted([...yearOne, ...yearTwo]),
      2,
    )
    // 0 · Z1 is a signed zero (−0 when Z1 < 0); either way the market shock is zero.
    expect(flat.returnShockPct!.every((shock) => shock === 0)).toBe(true)
    for (const id of ASSET_CLASS_IDS) {
      expect(flat.classReturnShockPct![id]![1]!).toBeCloseTo(gaussian[id]![1]!, 12)
    }
  })
})
