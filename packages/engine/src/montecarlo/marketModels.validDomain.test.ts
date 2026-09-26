/**
 * Refusals in place of silent clamps, and proof that valid inputs did not move.
 *
 * On 2026-09-25 the owner decided that nothing in the market models is silent
 * (decisions D-REVERSED-WINDOW-FLOOR, D-STUDENT-T-MIXTURE and D-GARCH-FEEDBACK,
 * rule 4 of decisions-2026-09-25.md): an input the engine used to change
 * quietly is now refused with a RangeError. This file checks both halves of
 * that change.
 *
 * 1. Every valid input produces byte-identical paths, with one stated
 *    exception: a positive-definite class correlation matrix whose Cholesky
 *    pivot is positive but below 1e-12 is now factored exactly, where
 *    origin/main raised that pivot to 1e-12 (pinned below). The functions below the
 *    "frozen" marker are a verbatim copy of origin/main aeb2861a
 *    (packages/engine/src/montecarlo/marketModels.ts lines 292-367, 369-468,
 *    520-700 and 760-958, and allocation/assetClasses.ts lines 256-277), with
 *    only `export function createX` renamed `function oldCreateX` and the
 *    sampler and Cholesky helpers renamed `old...`. Student-t and GARCH are
 *    left out: their math changed on purpose and their own evidence pins the
 *    new values. Every other model is compared, over a grid that includes the
 *    edges of each valid range, with class shocks off and on (default and
 *    custom positive-definite correlations), at three seeds, element by
 *    element with Object.is so even a signed zero would count as a change.
 * 2. Every refusal fires with its stated message, and the edges of each valid
 *    range are accepted.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSET_CLASS_PARAMS, DEFAULT_CLASS_CORRELATIONS, choleskyDecompose } from '../allocation/assetClasses.js'
import { ASSET_CLASS_IDS, type AssetClassId } from '../model/plan.js'
import type { MarketSeries } from '../projection/types.js'
import { HISTORICAL_YEARS, meanPortfolioReturnPct, portfolioReturnPct } from './historicalReturns.js'
import {
  type AR1ModelConfig,
  type CapeConditionedModelConfig,
  type ClassShockConfig,
  createAR1Model,
  createCapeConditionedModel,
  createEmpiricalModel,
  createGarchModel,
  createGaussianModel,
  createHistoricalModel,
  createInflationRegimeModel,
  createLognormalModel,
  createRegimeSwitchModel,
  createReversedHistoryModel,
  createStationaryBootstrapModel,
  createStudentTModel,
  createUserShockModel,
  type EmpiricalModelConfig,
  type GaussianModelConfig,
  type HistoricalModelConfig,
  type InflationRegimeModelConfig,
  type LognormalModelConfig,
  type MarketModel,
  type RegimeSwitchModelConfig,
  type ReversedHistoryModelConfig,
  sampleChiSquare,
  type StationaryBootstrapModelConfig,
  type UserShockModelConfig,
} from './marketModels.js'
import { createRng, type Rng } from './rng.js'

// ---------------------------------------------------------------------------
// Frozen: origin/main aeb2861a, verbatim apart from the renames stated above.
// ---------------------------------------------------------------------------

/**
 * Cholesky factor L (lower-triangular, LLᵀ = matrix) for correlated class
 * draws. For non-positive-definite input the diagonal term is clamped to a
 * small epsilon (1e-12) rather than failing, so the factorization always
 * returns (defensive: the shipped default matrix is PD).
 */
function oldCholeskyDecompose(matrix: readonly (readonly number[])[]): number[][] {
  const n = matrix.length
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0
      for (let k = 0; k < j; k++) sum += L[i]![k]! * L[j]![k]!
      if (i === j) {
        L[i]![j] = Math.sqrt(Math.max(1e-12, matrix[i]![i]! - sum))
      } else {
        L[i]![j] = (matrix[i]![j]! - sum) / L[j]![j]!
      }
    }
  }
  return L
}

/**
 * A model's centering convention, applied to one class's correlated draw.
 *
 * `x` is the standard-normal draw for the class after the Cholesky mix, `sigma`
 * its annual volatility as a decimal, and `id` the class — read only by
 * `user-shock`, which treats cash and equities differently in its shock year.
 * The return is a percentage-point shock, the same units as
 * `MarketSeries.returnShockPct`.
 */
type ClassShockTransform = (x: number, sigma: number, id: AssetClassId) => number

/**
 * Mean-preserving: E[exp(σx − σ²/2)] = 1, so the class shock averages out to
 * the class's expected return. Used by lognormal, cape-conditioned (before its
 * CAPE adjustment), inflation-regime, and user-shock's non-shock years.
 */
const meanPreservingLognormalShockPct: ClassShockTransform = (x, sigma) =>
  (Math.exp(sigma * x - (sigma * sigma) / 2) - 1) * 100

/**
 * Additive: the shock is the scaled draw itself, centered on zero rather than
 * on a gross multiplier of one. Used by student-t, garch, gaussian, and ar1,
 * whose single-factor return shocks are additive for the same reason.
 */
const additiveShockPct: ClassShockTransform = (x, sigma) => sigma * x * 100

interface OldClassShockSampler {
  /**
   * Write one year's per-class shocks into `series[id][yearIndex]`.
   *
   * `firstFactor` is the model's own return innovation, reused as the first
   * Gaussian so class shocks co-move with the single-factor path (and with
   * inflation through it), which is what keeps allocated and unallocated
   * accounts seeing the same market in the same year. The remaining
   * `ASSET_CLASS_IDS.length - 1` draws are taken here, in order, immediately
   * after the caller's own draws for the year — so a model configured without
   * class shocks consumes exactly the draws it always did.
   */
  sampleYear(
    rng: Rng,
    firstFactor: number,
    series: Record<AssetClassId, number[]>,
    yearIndex: number,
    transform: ClassShockTransform,
  ): void
}

/**
 * The per-class shock scaffolding every Cholesky-based model shares: decompose
 * the correlation matrix once, resolve the per-class volatilities once, and
 * mix a correlated draw vector sized from ASSET_CLASS_IDS rather than from a
 * hardcoded 4 — a fifth asset class used to silently truncate the mix in each
 * of the nine copies of this code.
 *
 * Returns null when the model was configured without class shocks, so callers
 * keep the same single guard they had before.
 */
function oldMakeClassShockSampler(classCfg: ClassShockConfig | undefined): OldClassShockSampler | null {
  if (!classCfg) return null
  const chol = oldCholeskyDecompose(classCfg.correlations ?? DEFAULT_CLASS_CORRELATIONS.map((r) => [...r]))
  const sigmas = ASSET_CLASS_IDS.map((id) => Math.max(0, classCfg.volatilityPctByClass[id] ?? 0) / 100)
  // Reused across years: every element is overwritten before it is read.
  const g = new Array<number>(ASSET_CLASS_IDS.length)
  return {
    sampleYear(rng, firstFactor, series, yearIndex, transform) {
      g[0] = firstFactor
      for (let k = 1; k < g.length; k++) g[k] = rng.nextNormal()
      for (let c = 0; c < ASSET_CLASS_IDS.length; c++) {
        let x = 0
        for (let k = 0; k <= c && k < g.length; k++) x += chol[c]![k]! * g[k]!
        const id = ASSET_CLASS_IDS[c]!
        series[id]![yearIndex] = transform(x, sigmas[c]!, id)
      }
    },
  }
}

/**
 * Lognormal-correlated model: the yearly gross return multiplier is
 * lognormal with mean 1 (so the shock is mean-preserving around each
 * account's expected return); inflation is normal and correlated with the
 * return shock via a Gaussian copula.
 */
function oldCreateLognormalModel(config: LognormalModelConfig): MarketModel {
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  // Per-class correlated shocks (optional). z1 — the single market factor —
  // doubles as the first Gaussian source, so class shocks co-move with the
  // single-factor shock (and with inflation through it) and allocated vs
  // unallocated accounts see the same market in the same year.
  const classCfg = config.classShocks
  const classShocks = oldMakeClassShockSampler(classCfg)
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = classCfg
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      for (let i = 0; i < yearCount; i++) {
        const z1 = rng.nextNormal()
        const z2 = rng.nextNormal()
        // E[exp(σz − σ²/2)] = 1: shocks average out to the expected return.
        returnShockPct[i] = (Math.exp(sigma * z1 - (sigma * sigma) / 2) - 1) * 100
        inflationPct[i] = inflMean + inflVol * (rho * z1 + Math.sqrt(1 - rho * rho) * z2)
        if (classSeries && classShocks) {
          // Extra draws only in class mode, after z1/z2 — the single-factor
          // and inflation paths above are bit-identical with classShocks off.
          classShocks.sampleYear(rng, z1, classSeries, i, meanPreservingLognormalShockPct)
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/**
 * Historical bootstrap over the embedded Shiller/Damodaran annual series.
 * The sampled blended-portfolio return is centered on its historical mean,
 * preserving the plan's expected return while replaying historical
 * dispersion and the realized co-movement of returns and inflation.
 */
function oldCreateHistoricalModel(config: HistoricalModelConfig): MarketModel {
  const equityWeightPct = config.equityWeightPct ?? 60
  const blockLength = Math.max(1, Math.round(config.blockLengthYears ?? 5))
  const mean = meanPortfolioReturnPct(equityWeightPct)
  const meanStocks = meanPortfolioReturnPct(100)
  const meanBonds = meanPortfolioReturnPct(0)
  const n = HISTORICAL_YEARS.length
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = config.classShocks
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      let cursor = 0
      let leftInBlock = 0
      for (let i = 0; i < yearCount; i++) {
        if (config.mode === 'iid') {
          cursor = rng.nextInt(n)
        } else if (config.mode === 'sequence') {
          if (i === 0) cursor = rng.nextInt(n)
          else cursor = (cursor + 1) % n
        } else {
          if (leftInBlock === 0) {
            cursor = rng.nextInt(n)
            leftInBlock = blockLength
          } else {
            cursor = (cursor + 1) % n
          }
          leftInBlock--
        }
        const sample = HISTORICAL_YEARS[cursor]!
        returnShockPct[i] = portfolioReturnPct(sample, equityWeightPct) - mean
        inflationPct[i] = sample.inflationPct
        if (classSeries) {
          // Keyed by class off the same sampled year: the dataset carries US
          // stocks and Treasuries, so international equity replays the stock
          // series (proxy, documented) and cash stays stable-value.
          const stockShock = sample.stocksPct - meanStocks
          classSeries.usStocks[i] = stockShock
          classSeries.intlStocks[i] = stockShock
          classSeries.bonds[i] = sample.bondsPct - meanBonds
          classSeries.cash[i] = 0
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/**
 * Simple two-regime Markov switching (bull/bear) on mean and vol.
 * State persists with 1-p switch. Regime means (bullMeanPct / bearMeanPct) are *deviations*
 * from zero so the unconditional expected shock is near zero when bull/bear are symmetric.
 * Inflation is always centered on the provided mean (no regime bias).
 */
function oldCreateRegimeSwitchModel(config: RegimeSwitchModelConfig): MarketModel {
  const bullMean = (config.bullMeanPct ?? 4) / 100
  const bearMean = (config.bearMeanPct ?? -4) / 100
  const bullVol = (config.bullVolPct ?? 10) / 100
  const bearVol = (config.bearVolPct ?? 20) / 100
  const pSwitch = Math.max(0.001, Math.min(0.5, config.switchProb ?? 0.05))
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const classCfg = config.classShocks
  const classShocks = oldMakeClassShockSampler(classCfg)
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = classCfg
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      let bull = rng.next() > 0.5 // random start state
      for (let i = 0; i < yearCount; i++) {
        if (rng.next() < pSwitch) bull = !bull
        const mu = bull ? bullMean : bearMean
        const sig = bull ? bullVol : bearVol
        const z = rng.nextNormal()
        const shock = mu + sig * z
        returnShockPct[i] = shock * 100
        const z2 = rng.nextNormal()
        // Always center inflation on provided mean; correlate via the return innovation z
        inflationPct[i] = inflMean + inflVol * (0.3 * z + Math.sqrt(1 - 0.3*0.3) * z2)
        if (classSeries && classShocks) {
          classShocks.sampleYear(rng, z, classSeries, i, (x, s) => (mu + s * x) * 100)
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/**
 * CAPE-conditioned: starting high CAPE lowers the mean return (linear taper).
 * Uses lognormal base but shifts mu down.
 */
function oldCreateCapeConditionedModel(config: CapeConditionedModelConfig): MarketModel {
  const startCape = config.startingCape ?? 25
  const sens = config.capeSensitivity ?? 0.15
  const baseMuAdj = Math.max(-4, Math.min(2, -(startCape - 20) * sens)) // pp adjustment
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  const classCfg = config.classShocks
  const classShocks = oldMakeClassShockSampler(classCfg)
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = classCfg
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      for (let i = 0; i < yearCount; i++) {
        const z1 = rng.nextNormal()
        const z2 = rng.nextNormal()
        // mean adj applied additively after lognormal centering for preservation
        const adj = baseMuAdj
        returnShockPct[i] = (Math.exp(sigma * z1 - (sigma * sigma) / 2) - 1) * 100 + adj
        inflationPct[i] = inflMean + inflVol * (rho * z1 + Math.sqrt(1 - rho * rho) * z2)
        if (classSeries && classShocks) {
          classShocks.sampleYear(rng, z1, classSeries, i, (x, s, id) => meanPreservingLognormalShockPct(x, s, id) + adj)
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/**
 * Stationary bootstrap: historical years replayed in contiguous blocks of random
 * length, wrapping at the end of the table.
 *
 * With L = max(2, meanBlockLength ?? 5) and n the number of historical rows, the
 * path draws a start row cursor = nextInt(n) and then a block length
 *   remaining = floor(−ln(1 − U) · L) || 1        (U = next uniform draw)
 * (the inverse CDF of an exponential with mean L, floored, and 1 when the floor is
 * 0). Each path year publishes the row at cursor (blended return at equityWeightPct
 * minus the dataset mean at that weight; inflation as-is), then advances cursor by
 * one with wrap and decrements remaining; when remaining reaches 0 a new start row
 * and a new block length are drawn in that order. Draw order per block: nextInt(n),
 * then next(). Note: the block length is drawn once per block, so this is NOT a
 * per-year continuation coin with probability 1/L; the two laws differ (a coin can
 * restart in consecutive years, and the floor and the "|| 1" clamp shape the length
 * distribution), even though both have mean block length near L.
 */
function oldCreateStationaryBootstrapModel(config: StationaryBootstrapModelConfig): MarketModel {
  const equityWeightPct = config.equityWeightPct ?? 60
  const meanBlock = Math.max(2, config.meanBlockLength ?? 5)
  const mean = meanPortfolioReturnPct(equityWeightPct)
  const meanS = meanPortfolioReturnPct(100)
  const meanB = meanPortfolioReturnPct(0)
  const n = HISTORICAL_YEARS.length
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = config.classShocks
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      let cursor = rng.nextInt(n)
      let remaining = Math.floor(-Math.log(1 - rng.next()) * meanBlock) || 1
      for (let i = 0; i < yearCount; i++) {
        if (remaining <= 0) {
          cursor = rng.nextInt(n)
          remaining = Math.floor(-Math.log(1 - rng.next()) * meanBlock) || 1
        }
        const sample = HISTORICAL_YEARS[cursor]!
        returnShockPct[i] = portfolioReturnPct(sample, equityWeightPct) - mean
        inflationPct[i] = sample.inflationPct
        if (classSeries) {
          classSeries.usStocks[i] = sample.stocksPct - meanS
          classSeries.intlStocks[i] = sample.stocksPct - meanS
          classSeries.bonds[i] = sample.bondsPct - meanB
          classSeries.cash[i] = 0
        }
        cursor = (cursor + 1) % n
        remaining--
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/** Empirical historical: optionally non-centered (raw history mean).
 * Note: non-centered mode outputs raw historical portfolio returns as the "shock".
 * Because the projection always does expected + shock, non-centered will add the
 * historical mean on top of the plan's assumption (potential double-count).
 * UI defaults to centered for correctness; non-centered kept for advanced use.
 */
function oldCreateEmpiricalModel(config: EmpiricalModelConfig): MarketModel {
  const equityWeightPct = config.equityWeightPct ?? 60
  const centered = config.centered !== false // default true (mean preserving)
  const mean = centered ? meanPortfolioReturnPct(equityWeightPct) : 0
  const meanS = meanPortfolioReturnPct(100)
  const meanB = meanPortfolioReturnPct(0)
  const n = HISTORICAL_YEARS.length
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = config.classShocks
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      let cursor = rng.nextInt(n)
      for (let i = 0; i < yearCount; i++) {
        if (i > 0) cursor = (cursor + 1) % n // simple sequence-like for demo; or iid, here use iid for variety
        if (rng.next() < 0.5) cursor = rng.nextInt(n) // mix iid/seq
        const sample = HISTORICAL_YEARS[cursor]!
        returnShockPct[i] = portfolioReturnPct(sample, equityWeightPct) - mean
        inflationPct[i] = sample.inflationPct
        if (classSeries) {
          classSeries.usStocks[i] = sample.stocksPct - (centered ? meanS : 0)
          classSeries.intlStocks[i] = sample.stocksPct - (centered ? meanS : 0)
          classSeries.bonds[i] = sample.bondsPct - (centered ? meanB : 0)
          classSeries.cash[i] = 0
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/** Fat-tailed / regime inflation correlated to returns. */
function oldCreateInflationRegimeModel(config: InflationRegimeModelConfig): MarketModel {
  const highMu = config.highInflationMean ?? 8
  const pHigh = Math.max(0.01, Math.min(0.3, config.highInflationProb ?? 0.08))
  const sigma = (config.returnVolPct ?? 12) / 100
  const baseInfl = config.baseInflationMeanPct
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  const classCfg = config.classShocks
  const classShocks = oldMakeClassShockSampler(classCfg)
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = classCfg
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      let high = false
      for (let i = 0; i < yearCount; i++) {
        if (rng.next() < (high ? 0.7 : pHigh)) high = !high
        const z1 = rng.nextNormal()
        returnShockPct[i] = (Math.exp(sigma * z1 - (sigma * sigma) / 2) - 1) * 100
        const baseI = high ? highMu : baseInfl
        const z2 = rng.nextNormal()
        inflationPct[i] = baseI + 1.5 * (rho * z1 + Math.sqrt(1 - rho * rho) * z2)
        if (classSeries && classShocks) {
          classShocks.sampleYear(rng, z1, classSeries, i, meanPreservingLognormalShockPct)
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/**
 * Reversed-history replay: one window of consecutive historical rows, played backwards.
 *
 * With L the effective window length (see windowLengthYears) and n the number of historical rows,
 * the path draws one start index uniformly from 0..n-L (rng.nextInt(n - L + 1)) and then, for path
 * year i (0-based), replays the row at index start + L - 1 - (i mod L): the window's last row first,
 * back to its first row, then wrapping to the last row again for paths longer than L. Each replayed
 * year publishes the blended-portfolio return of that row at equityWeightPct minus the dataset mean at
 * that weight (meanPortfolioReturnPct, so shocks are centered), and the row's inflation rate as-is.
 * Class shocks, when configured: US and international stocks both take the row's stock return minus the
 * all-stock dataset mean, bonds take the row's bond return minus the all-bond mean, and cash is zero.
 */
function oldCreateReversedHistoryModel(config: ReversedHistoryModelConfig): MarketModel {
  const equityWeightPct = config.equityWeightPct ?? 60
  const winLen = Math.max(5, Math.min(HISTORICAL_YEARS.length, config.windowLengthYears ?? 10))
  const mean = meanPortfolioReturnPct(equityWeightPct)
  const meanS = meanPortfolioReturnPct(100)
  const meanB = meanPortfolioReturnPct(0)
  const n = HISTORICAL_YEARS.length
  const maxStart = n - winLen
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = config.classShocks
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      const start = rng.nextInt(Math.max(1, maxStart + 1))
      for (let i = 0; i < yearCount; i++) {
        const off = i % winLen
        const idx = start + winLen - 1 - off
        const hidx = ((idx % n) + n) % n
        const sample = HISTORICAL_YEARS[hidx]!
        returnShockPct[i] = portfolioReturnPct(sample, equityWeightPct) - mean
        inflationPct[i] = sample.inflationPct
        if (classSeries) {
          classSeries.usStocks[i] = sample.stocksPct - meanS
          classSeries.intlStocks[i] = sample.stocksPct - meanS
          classSeries.bonds[i] = sample.bondsPct - meanB
          classSeries.cash[i] = 0
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/** User-specified deterministic shock in one year, then lognormal-ish. */
function oldCreateUserShockModel(config: UserShockModelConfig): MarketModel {
  const shockYear = Math.max(1, config.shockYear ?? 1) // 1-based
  const shock = config.shockPct ?? -20
  const sigma = (config.baseReturnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const classCfg = config.classShocks
  const classShocks = oldMakeClassShockSampler(classCfg)
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = classCfg
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      for (let i = 0; i < yearCount; i++) {
        const yearIdx = i + 1
        const z1 = rng.nextNormal()
        const z2 = rng.nextNormal()
        if (yearIdx === shockYear) {
          returnShockPct[i] = shock
          inflationPct[i] = inflMean + 3 * z2 // noisy around
        } else {
          returnShockPct[i] = (Math.exp(sigma * z1 - (sigma * sigma) / 2) - 1) * 100
          inflationPct[i] = inflMean + 1.5 * ( -0.2 * z1 + Math.sqrt(0.96) * z2)
        }
        if (classSeries && classShocks) {
          // The only per-class transform that reads the class id: in the shock
          // year cash is held flat, equities take the full shock, everything
          // else 60% of it. Other years centre like the lognormal model.
          classShocks.sampleYear(rng, z1, classSeries, i, (x, s, id) =>
            yearIdx === shockYear
              ? (id === 'cash') ? 0 : shock * (id === 'usStocks' || id === 'intlStocks' ? 1 : 0.6)
              : meanPreservingLognormalShockPct(x, s, id))
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/**
 * Additive multivariate Gaussian (normal) shocks. Distinct from lognormal:
 * returns can be <-100% in theory (rare), symmetric, no built-in compounding skew.
 * Mean-preserving (shocks centered at 0).
 */
function oldCreateGaussianModel(config: GaussianModelConfig): MarketModel {
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  const classCfg = config.classShocks
  const classShocks = oldMakeClassShockSampler(classCfg)
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = classCfg
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      for (let i = 0; i < yearCount; i++) {
        const z1 = rng.nextNormal()
        const z2 = rng.nextNormal()
        returnShockPct[i] = sigma * z1 * 100   // additive normal, centered
        inflationPct[i] = inflMean + inflVol * (rho * z1 + Math.sqrt(1 - rho * rho) * z2)
        if (classSeries && classShocks) {
          classShocks.sampleYear(rng, z1, classSeries, i, additiveShockPct)
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/**
 * AR(1) mean-reverting shocks. Introduces serial correlation (momentum or reversion)
 * controlled by phi. Distinct dynamics from iid models. Shocks remain mean-zero.
 */
function oldCreateAR1Model(config: AR1ModelConfig): MarketModel {
  const phi = Math.max(-0.9, Math.min(0.95, config.phi ?? 0.25))
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  const classCfg = config.classShocks
  const classShocks = oldMakeClassShockSampler(classCfg)
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = classCfg
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      let prevShock = 0
      for (let i = 0; i < yearCount; i++) {
        const eps = rng.nextNormal()
        const shock = phi * prevShock + sigma * eps
        returnShockPct[i] = shock * 100
        const z2 = rng.nextNormal()
        inflationPct[i] = inflMean + inflVol * (rho * eps + Math.sqrt(1 - rho * rho) * z2)  // innovation driven
        prevShock = shock
        if (classSeries && classShocks) {
          classShocks.sampleYear(rng, eps, classSeries, i, additiveShockPct)
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

// ---------------------------------------------------------------------------
// End of the frozen copy.
// ---------------------------------------------------------------------------

const classVols = Object.fromEntries(
  ASSET_CLASS_IDS.map((id) => [id, DEFAULT_ASSET_CLASS_PARAMS[id].volatilityPct]),
) as Record<AssetClassId, number>

/** Positive definite (its Cholesky pivots are 1, 0.75, 0.9067 and 0.8329), and not the default. */
const CUSTOM_CORRELATIONS = [
  [1, 0.5, 0.2, 0],
  [0.5, 1, 0.3, 0.1],
  [0.2, 0.3, 1, 0.4],
  [0, 0.1, 0.4, 1],
]

const CLASS_SHOCK_VARIANTS: readonly (ClassShockConfig | undefined)[] = [
  undefined,
  { volatilityPctByClass: classVols },
  { volatilityPctByClass: { ...classVols, cash: 0 }, correlations: CUSTOM_CORRELATIONS },
]

const SEEDS = [1, 20260925, 0xdeadbeef] as const

/** Every combination of the listed option values. */
function grid<T extends Record<string, readonly unknown[]>>(axes: T): { [K in keyof T]: T[K][number] }[] {
  let rows: Record<string, unknown>[] = [{}]
  for (const [key, values] of Object.entries(axes)) {
    rows = rows.flatMap((row) => values.map((value) => ({ ...row, [key]: value })))
  }
  return rows as { [K in keyof T]: T[K][number] }[]
}

/** Drops keys whose value is undefined, so the default branch is what runs. */
function defined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T
}

function firstDifference(label: string, before: readonly number[] | undefined, after: readonly number[] | undefined): string | null {
  if (before === undefined || after === undefined) return before === after ? null : `${label}: one side is missing`
  if (before.length !== after.length) return `${label}: length ${before.length} became ${after.length}`
  for (let i = 0; i < before.length; i++) {
    if (!Object.is(before[i], after[i])) return `${label}[${i}]: ${before[i]} became ${after[i]}`
  }
  return null
}

function pathDifference(before: MarketSeries, after: MarketSeries): string | null {
  const differences = [
    firstDifference('returnShockPct', before.returnShockPct, after.returnShockPct),
    firstDifference('inflationPct', before.inflationPct, after.inflationPct),
  ]
  if ((before.classReturnShockPct === undefined) !== (after.classReturnShockPct === undefined)) {
    differences.push('classReturnShockPct: one side is missing')
  } else if (before.classReturnShockPct && after.classReturnShockPct) {
    for (const id of ASSET_CLASS_IDS) {
      differences.push(firstDifference(`class ${id}`, before.classReturnShockPct[id], after.classReturnShockPct[id]))
    }
  }
  return differences.find((difference) => difference !== null) ?? null
}

interface Comparison {
  readonly label: string
  readonly before: MarketModel
  readonly after: MarketModel
  readonly years: number
}

function comparisons(): Comparison[] {
  const out: Comparison[] = []
  const add = <C>(name: string, config: C, before: (c: C) => MarketModel, after: (c: C) => MarketModel, years = 60) => {
    out.push({ label: `${name} ${JSON.stringify(config)}`, before: before(config), after: after(config), years })
  }
  const correlations = [undefined, -1, -0.2, 0, 0.35, 1] as const

  for (const row of grid({ returnVolPct: [undefined, 0, 12, 25], correlation: correlations, classShocks: CLASS_SHOCK_VARIANTS })) {
    add('lognormal', defined<LognormalModelConfig>({ type: 'lognormal', inflationMeanPct: 2.5, ...row }), oldCreateLognormalModel, createLognormalModel)
  }
  for (const row of grid({
    mode: ['iid', 'block', 'sequence'] as const,
    blockLengthYears: [undefined, 1, 3, 96],
    equityWeightPct: [undefined, 0, 100],
    classShocks: [undefined, false, true],
  })) {
    add('historical', defined<HistoricalModelConfig>({ type: 'historical', ...row }), oldCreateHistoricalModel, createHistoricalModel)
  }
  for (const row of grid({ switchProb: [undefined, 0.001, 0.2, 0.5], bearVolPct: [undefined, 0], classShocks: CLASS_SHOCK_VARIANTS })) {
    add('regime-switch', defined<RegimeSwitchModelConfig>({ type: 'regime-switch', inflationMeanPct: 2.5, ...row }), oldCreateRegimeSwitchModel, createRegimeSwitchModel)
  }
  for (const row of grid({
    startingCape: [undefined, 10, 50],
    capeSensitivity: [undefined, 0.3],
    correlation: [undefined, -1, 1],
    classShocks: CLASS_SHOCK_VARIANTS,
  })) {
    add('cape-conditioned', defined<CapeConditionedModelConfig>({ type: 'cape-conditioned', inflationMeanPct: 2.5, ...row }), oldCreateCapeConditionedModel, createCapeConditionedModel)
  }
  for (const row of grid({ meanBlockLength: [undefined, 2, 2.5, 7, 40], equityWeightPct: [undefined, 30], classShocks: [undefined, true] })) {
    add('stationary', defined<StationaryBootstrapModelConfig>({ type: 'stationary', ...row }), oldCreateStationaryBootstrapModel, createStationaryBootstrapModel)
  }
  for (const row of grid({ centered: [undefined, false, true], equityWeightPct: [undefined, 80], classShocks: [undefined, true] })) {
    add('empirical', defined<EmpiricalModelConfig>({ type: 'empirical', ...row }), oldCreateEmpiricalModel, createEmpiricalModel)
  }
  for (const row of grid({ highInflationProb: [undefined, 0.01, 0.3], correlation: [undefined, -1, 1], classShocks: CLASS_SHOCK_VARIANTS })) {
    add('inflation-regime', defined<InflationRegimeModelConfig>({ type: 'inflation-regime', baseInflationMeanPct: 2.5, ...row }), oldCreateInflationRegimeModel, createInflationRegimeModel)
  }
  const windows = [undefined, ...Array.from({ length: HISTORICAL_YEARS.length - 4 }, (_, i) => i + 5)]
  for (const row of grid({ windowLengthYears: windows, classShocks: [undefined, true] })) {
    add('reversed-history', defined<ReversedHistoryModelConfig>({ type: 'reversed-history', ...row }), oldCreateReversedHistoryModel, createReversedHistoryModel, 120)
  }
  for (const row of grid({ shockYear: [undefined, 1, 3, 60, 200], classShocks: CLASS_SHOCK_VARIANTS })) {
    add('user-shock', defined<UserShockModelConfig>({ type: 'user-shock', inflationMeanPct: 2.5, ...row }), oldCreateUserShockModel, createUserShockModel)
  }
  for (const row of grid({ returnVolPct: [undefined, 0, 20], correlation: correlations, classShocks: CLASS_SHOCK_VARIANTS })) {
    add('gaussian', defined<GaussianModelConfig>({ type: 'gaussian', inflationMeanPct: 2.5, ...row }), oldCreateGaussianModel, createGaussianModel)
  }
  for (const row of grid({ phi: [undefined, -0.9, 0, 0.95], correlation: [undefined, -1, 1], classShocks: CLASS_SHOCK_VARIANTS })) {
    add('ar1', defined<AR1ModelConfig>({ type: 'ar1', inflationMeanPct: 2.5, ...row }), oldCreateAR1Model, createAR1Model)
  }
  return out
}

describe('valid inputs produce the same paths as origin/main aeb2861a', () => {
  const cases = comparisons()

  it('compares every model whose math did not change, including the edges of each valid range', () => {
    const models = new Set(cases.map((c) => c.label.split(' ')[0]))
    expect([...models].sort()).toEqual(
      ['ar1', 'cape-conditioned', 'empirical', 'gaussian', 'historical', 'inflation-regime', 'lognormal', 'regime-switch', 'reversed-history', 'stationary', 'user-shock'],
    )
    expect(cases.length).toBeGreaterThan(600)
  })

  it('is byte-identical at every grid point and seed', () => {
    const mismatches: string[] = []
    for (const c of cases) {
      for (const seed of SEEDS) {
        const difference = pathDifference(c.before.generatePath(createRng(seed), c.years), c.after.generatePath(createRng(seed), c.years))
        if (difference !== null) mismatches.push(`${c.label} seed ${seed}: ${difference}`)
      }
    }
    expect(mismatches).toEqual([])
  })

  it('the one valid input whose factor changed: a pivot in (0, 1e-12) is no longer raised to 1e-12', () => {
    // [[1, r], [r, 1]] with r = 1 − 1e-13 is positive definite; its second pivot is 1 − r^2 =
    // 2.000621890374532e-13 in doubles. origin/main raised it to 1e-12 (L[1][1] = 1e-6); it is now
    // factored exactly, and L L^T reproduces the matrix.
    const r = 1 - 1e-13
    const matrix = [
      [1, r],
      [r, 1],
    ]
    expect(oldCholeskyDecompose(matrix)[1]![1]).toBe(0.000001)
    const after = choleskyDecompose(matrix)
    expect(after[1]![1]).toBe(4.4728311955343587e-7)
    expect(after[1]![0]).toBe(r)
    expect(after[1]![0]! ** 2 + after[1]![1]! ** 2).toBeCloseTo(1, 15)
  })

  it('factors every positive-definite matrix with pivots of at least 1e-12 the way origin/main did', () => {
    for (const matrix of [DEFAULT_CLASS_CORRELATIONS, CUSTOM_CORRELATIONS, [[1, 0.5], [0.5, 1]], [[4, 2], [2, 3]]]) {
      const before = oldCholeskyDecompose(matrix)
      const after = choleskyDecompose(matrix)
      before.forEach((row, i) => row.forEach((value, j) => expect(Object.is(after[i]![j], value), `L[${i}][${j}]`).toBe(true)))
    }
  })
})

describe('inputs the market models used to change without a word are refused', () => {
  const correlationModels: readonly [string, (correlation: number) => MarketModel][] = [
    ['Lognormal', (correlation) => createLognormalModel({ type: 'lognormal', inflationMeanPct: 2.5, correlation })],
    ['Student-t', (correlation) => createStudentTModel({ type: 'student-t', inflationMeanPct: 2.5, correlation })],
    ['CAPE-conditioned', (correlation) => createCapeConditionedModel({ type: 'cape-conditioned', inflationMeanPct: 2.5, correlation })],
    ['GARCH', (correlation) => createGarchModel({ type: 'garch', inflationMeanPct: 2.5, correlation })],
    ['Inflation-regime', (correlation) => createInflationRegimeModel({ type: 'inflation-regime', baseInflationMeanPct: 2.5, correlation })],
    ['Gaussian', (correlation) => createGaussianModel({ type: 'gaussian', inflationMeanPct: 2.5, correlation })],
    ['AR(1)', (correlation) => createAR1Model({ type: 'ar1', inflationMeanPct: 2.5, correlation })],
  ]

  it.each(correlationModels)('%s refuses a return-inflation correlation outside [-1, 1] or not finite', (name, build) => {
    for (const correlation of [1.0000001, -1.5, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => build(correlation)).toThrow(new RangeError(`${name} correlation must be a finite number from -1 to 1; got ${correlation}.`))
    }
    for (const correlation of [-1, 0, 1]) expect(() => build(correlation)).not.toThrow()
  })

  it('refuses a class volatility that is missing, negative or not finite, and accepts 0', () => {
    for (const cash of [-0.5, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      const volatilityPctByClass = { ...classVols, cash } as Record<AssetClassId, number>
      expect(() => createGaussianModel({ type: 'gaussian', inflationMeanPct: 2.5, classShocks: { volatilityPctByClass } })).toThrow(
        new RangeError(`Class volatility for cash must be a finite number of at least 0 percentage points; got ${cash}.`),
      )
    }
    expect(() =>
      createGaussianModel({ type: 'gaussian', inflationMeanPct: 2.5, classShocks: { volatilityPctByClass: { ...classVols, cash: 0 } } }),
    ).not.toThrow()
  })

  it('refuses a custom class correlation matrix that is not positive definite, and keeps the default working', () => {
    // Pivots 1, 0.19, then 1 − 0.81 − (−0.9 − 0.81)^2 / 0.19 < 0: an indefinite matrix, so no factor
    // with a positive diagonal exists.
    const notPositiveDefinite = [
      [1, 0.9, 0.9, 0],
      [0.9, 1, -0.9, 0],
      [0.9, -0.9, 1, 0],
      [0, 0, 0, 1],
    ]
    expect(() =>
      createLognormalModel({ type: 'lognormal', inflationMeanPct: 2.5, classShocks: { volatilityPctByClass: classVols, correlations: notPositiveDefinite } }),
    ).toThrow(/^Correlation matrix is not positive definite: the Cholesky pivot at row 2 is -\d/u)
    // Perfect correlation is positive semidefinite, not definite: its second pivot is exactly 0.
    const perfectlyCorrelated = [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ]
    expect(() => choleskyDecompose(perfectlyCorrelated)).toThrow(
      new RangeError('Correlation matrix is not positive definite: the Cholesky pivot at row 1 is 0, not a positive number.'),
    )
    expect(() => createLognormalModel({ type: 'lognormal', inflationMeanPct: 2.5, classShocks: { volatilityPctByClass: classVols } })).not.toThrow()
    expect(() => choleskyDecompose(DEFAULT_CLASS_CORRELATIONS)).not.toThrow()
  })

  it('refuses a historical block length that is not a whole number of at least 1, in every mode', () => {
    for (const mode of ['iid', 'block', 'sequence'] as const) {
      for (const blockLengthYears of [0, 2.5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() => createHistoricalModel({ type: 'historical', mode, blockLengthYears })).toThrow(
          new RangeError(`Historical blockLengthYears must be a whole number of at least 1; got ${blockLengthYears}.`),
        )
      }
      for (const blockLengthYears of [1, 5, 96]) expect(() => createHistoricalModel({ type: 'historical', mode, blockLengthYears })).not.toThrow()
    }
  })

  // Owner decision (review finding F6): the two probabilities accept any probability in [0, 1] and
  // AR(1) phi any value strictly between -1 and 1, the mathematical domains, instead of the old
  // arbitrary clamp bounds. Values inside the old bounds stay in the byte-identity grid above; the
  // new edges run as set, where origin/main moved them to the nearest old bound.
  function scripted(script: { uniforms?: readonly number[]; normals?: readonly number[] }): Rng {
    let u = 0
    let n = 0
    return {
      next: () => {
        const draw = script.uniforms?.[u]
        if (draw === undefined) throw new RangeError(`uniform ${u} was not scripted`)
        u += 1
        return draw
      },
      nextNormal: () => {
        const draw = script.normals?.[n]
        if (draw === undefined) throw new RangeError(`normal ${n} was not scripted`)
        n += 1
        return draw
      },
      nextInt: () => {
        throw new RangeError('no integer draw was scripted')
      },
    }
  }
  const zeros = (count: number) => new Array<number>(count).fill(0)

  it('refuses a regime switch probability outside [0, 1] or not finite, and accepts 0 and 1', () => {
    for (const switchProb of [-0.01, 1.01, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createRegimeSwitchModel({ type: 'regime-switch', inflationMeanPct: 2.5, switchProb })).toThrow(
        new RangeError(`Regime-switch switchProb must be a number from 0 to 1; got ${switchProb}.`),
      )
    }
    for (const switchProb of [0, 0.001, 0.5, 1]) {
      expect(() => createRegimeSwitchModel({ type: 'regime-switch', inflationMeanPct: 2.5, switchProb })).not.toThrow()
    }
  })

  it('runs switchProb 0 as never switching and 1 as switching every year (origin/main ran 0.001 and 0.5)', () => {
    // Zero volatilities: each year's shock is the regime mean, +4 bull or -4 bear. The first uniform
    // 0.6 starts bull; each later uniform is that year's switch draw.
    const flat = { type: 'regime-switch' as const, inflationMeanPct: 0, inflationVolPct: 0, bullVolPct: 0, bearVolPct: 0 }
    const never = { uniforms: [0.6, 0, 0, 0], normals: zeros(6) }
    const always = { uniforms: [0.6, 0.999, 0.999, 0.999], normals: zeros(6) }
    expect(createRegimeSwitchModel({ ...flat, switchProb: 0 }).generatePath(scripted(never), 3).returnShockPct).toEqual([4, 4, 4])
    expect(oldCreateRegimeSwitchModel({ ...flat, switchProb: 0 }).generatePath(scripted(never), 3).returnShockPct).toEqual([-4, 4, -4])
    expect(createRegimeSwitchModel({ ...flat, switchProb: 1 }).generatePath(scripted(always), 3).returnShockPct).toEqual([-4, 4, -4])
    expect(oldCreateRegimeSwitchModel({ ...flat, switchProb: 1 }).generatePath(scripted(always), 3).returnShockPct).toEqual([4, 4, 4])
  })

  it('refuses a high-inflation probability outside [0, 1] or not finite, and accepts 0 and 1', () => {
    for (const highInflationProb of [-0.01, 1.0001, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(() => createInflationRegimeModel({ type: 'inflation-regime', baseInflationMeanPct: 2.5, highInflationProb })).toThrow(
        new RangeError(`Inflation-regime highInflationProb must be a number from 0 to 1; got ${highInflationProb}.`),
      )
    }
    for (const highInflationProb of [0, 0.01, 0.3, 1]) {
      expect(() => createInflationRegimeModel({ type: 'inflation-regime', baseInflationMeanPct: 2.5, highInflationProb })).not.toThrow()
    }
  })

  it('runs highInflationProb 0 as never entering the high regime and 1 as entering it at once (origin/main ran 0.01 and 0.3)', () => {
    // Zero normals: inflation is the regime mean, 8 high or 3 normal. The high regime is left when a
    // year's uniform is below 0.7.
    const base = { type: 'inflation-regime' as const, baseInflationMeanPct: 3, highInflationMean: 8, returnVolPct: 0 }
    const low = { uniforms: [0, 0, 0], normals: zeros(6) }
    const high = { uniforms: [0.999, 0.9, 0.999], normals: zeros(6) }
    expect(createInflationRegimeModel({ ...base, highInflationProb: 0 }).generatePath(scripted(low), 3).inflationPct).toEqual([3, 3, 3])
    expect(oldCreateInflationRegimeModel({ ...base, highInflationProb: 0 }).generatePath(scripted(low), 3).inflationPct).toEqual([8, 3, 8])
    expect(createInflationRegimeModel({ ...base, highInflationProb: 1 }).generatePath(scripted(high), 3).inflationPct).toEqual([8, 8, 8])
    expect(oldCreateInflationRegimeModel({ ...base, highInflationProb: 1 }).generatePath(scripted(high), 3).inflationPct).toEqual([3, 3, 3])
  })

  it('refuses an AR(1) phi of 1 or more in size, or not finite, and accepts values strictly inside', () => {
    for (const phi of [1, -1, 1.5, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createAR1Model({ type: 'ar1', inflationMeanPct: 2.5, phi })).toThrow(
        new RangeError(
          `AR(1) phi must be a number strictly between -1 and 1 (at |phi| of 1 or more the process is not stationary); got ${phi}.`,
        ),
      )
    }
    for (const phi of [-0.97, -0.9, 0, 0.95, 0.97, 0.9999]) {
      expect(() => createAR1Model({ type: 'ar1', inflationMeanPct: 2.5, phi })).not.toThrow()
    }
  })

  it('runs phi 0.97 and −0.97 as set: a 10-point shock is followed by 9.7 and −9.7 (origin/main ran 0.95 and −0.9)', () => {
    const base = { type: 'ar1' as const, inflationMeanPct: 0, inflationVolPct: 0, returnVolPct: 10 }
    const draws = { normals: [1, 0, 0, 0] }
    for (const [phi, next, oldNext] of [
      [0.97, 9.7, 9.5],
      [-0.97, -9.7, -9],
    ] as const) {
      const now = createAR1Model({ ...base, phi }).generatePath(scripted(draws), 2).returnShockPct!
      const before = oldCreateAR1Model({ ...base, phi }).generatePath(scripted(draws), 2).returnShockPct!
      expect(now[0]).toBe(10)
      expect(Math.abs(now[1]! - next)).toBeLessThan(1e-12)
      expect(Math.abs(before[1]! - oldNext)).toBeLessThan(1e-12)
    }
  })

  it('the new edges run on seeded paths with class shocks, and every value is finite', () => {
    const classShocks = { volatilityPctByClass: classVols }
    const models = [
      createRegimeSwitchModel({ type: 'regime-switch', inflationMeanPct: 2.5, switchProb: 0, classShocks }),
      createRegimeSwitchModel({ type: 'regime-switch', inflationMeanPct: 2.5, switchProb: 1, classShocks }),
      createInflationRegimeModel({ type: 'inflation-regime', baseInflationMeanPct: 2.5, highInflationProb: 0, classShocks }),
      createInflationRegimeModel({ type: 'inflation-regime', baseInflationMeanPct: 2.5, highInflationProb: 1, classShocks }),
      createAR1Model({ type: 'ar1', inflationMeanPct: 2.5, phi: 0.97, classShocks }),
      createAR1Model({ type: 'ar1', inflationMeanPct: 2.5, phi: -0.97, classShocks }),
    ]
    for (const model of models) {
      for (const seed of SEEDS) {
        const path = model.generatePath(createRng(seed), 60)
        const values = [...path.returnShockPct!, ...path.inflationPct!, ...ASSET_CLASS_IDS.flatMap((id) => path.classReturnShockPct![id]!)]
        expect(values.every(Number.isFinite)).toBe(true)
      }
    }
  })

  it('refuses a stationary mean block length below 2 or not finite', () => {
    for (const meanBlockLength of [1.99, 1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createStationaryBootstrapModel({ type: 'stationary', meanBlockLength })).toThrow(
        new RangeError(`Stationary bootstrap meanBlockLength must be a finite number of at least 2; got ${meanBlockLength}.`),
      )
    }
    for (const meanBlockLength of [2, 2.5]) expect(() => createStationaryBootstrapModel({ type: 'stationary', meanBlockLength })).not.toThrow()
  })

  it('refuses a user-shock year that is not a whole number of at least 1', () => {
    // origin/main ran 1.5 with no shock year at all (no whole path year equals 1.5).
    const before = oldCreateUserShockModel({ type: 'user-shock', inflationMeanPct: 2.5, shockYear: 1.5, shockPct: -40 })
    expect(before.generatePath(createRng(3), 5).returnShockPct).not.toContain(-40)
    for (const shockYear of [0, 1.5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createUserShockModel({ type: 'user-shock', inflationMeanPct: 2.5, shockYear })).toThrow(
        new RangeError(`User-shock shockYear must be a whole number of at least 1 (a 1-based path year); got ${shockYear}.`),
      )
    }
    for (const shockYear of [1, 2]) expect(() => createUserShockModel({ type: 'user-shock', inflationMeanPct: 2.5, shockYear })).not.toThrow()
  })

  it('refuses a chi-square draw below 2 degrees of freedom, where Marsaglia and Tsang is not exact', () => {
    const rng: Rng = createRng(1)
    for (const df of [1.99, 0, Number.NaN]) {
      expect(() => sampleChiSquare(rng, df)).toThrow(
        new RangeError(`sampleChiSquare needs a finite df of at least 2 (shape df/2 of at least 1); got ${df}.`),
      )
    }
  })
})
