/**
 * Pluggable stochastic market models (roadmap V4, feature catalog §11).
 *
 * Each model turns an injected RNG into one path of per-year market
 * conditions for the deterministic ledger: an additive return shock (single
 * market factor applied to non-cash investable accounts), a realized
 * inflation rate, and — for plans with allocated accounts — per-class
 * correlated shocks sharing the same allocation schema as the deterministic
 * ledger. Shocks are centered so the expected return stays the plan's own
 * assumption; the models supply dispersion, skew, and the return/inflation
 * co-movement.
 *
 * Configs are plain JSON so they can cross the Web Worker boundary.
 *
 * Extended in the stochastic-market-model-library plan (Track 2) to 15+
 * models. All new models are mean-preserving by default (path avg shock ~0),
 * respect RNG draw ordering (new draws after core for classShocks parity),
 * and default lognormal/historical paths are byte-identical.
 */

import {
  choleskyDecompose,
  DEFAULT_CLASS_CORRELATIONS,
  planUsesAssetAllocation,
  resolveAssetClassParams,
} from '../allocation/assetClasses.js'
import { ASSET_CLASS_IDS, type AssetClassId, type Plan } from '../model/plan.js'
import type { MarketSeries } from '../projection/types.js'
import { HISTORICAL_YEARS, meanPortfolioReturnPct, portfolioReturnPct } from './historicalReturns.js'
import type { Rng } from './rng.js'

export interface MarketModel {
  /** One simulation path of per-year market conditions. */
  generatePath(rng: Rng, yearCount: number): MarketSeries
}

/**
 * Per-class shock generation for plans with allocated accounts
 * (asset-allocation-and-return-model-v2, step 6). Volatilities come from the
 * resolved Assumptions-level class parameters; the correlation matrix defaults
 * to the documented long-horizon historical one. Enabling this consumes extra
 * RNG draws per year, so it is only switched on when the plan actually has an
 * allocated account — single-return plans keep their exact current paths.
 */
export interface ClassShockConfig {
  /**
   * Annual volatility per class, percentage points, ASSET_CLASS_IDS keys. Every class must carry a
   * finite number of at least 0; a missing, negative or non-finite value is refused with a RangeError.
   */
  volatilityPctByClass: Record<AssetClassId, number>
  /**
   * Correlation matrix over ASSET_CLASS_IDS order; default: the documented long-horizon matrix. A
   * matrix that is not positive definite is refused by choleskyDecompose with a RangeError.
   */
  correlations?: number[][]
}

export interface LognormalModelConfig {
  type: 'lognormal'
  /** Annual volatility of the portfolio return, percentage points (default 12). */
  returnVolPct?: number
  /** Mean inflation, percent (default: the plan's assumption — pass it explicitly). */
  inflationMeanPct: number
  /** Annual volatility of inflation, percentage points (default 1.5). */
  inflationVolPct?: number
  /** Correlation between the return shock and inflation (default −0.2); a finite number from −1 to 1, refused otherwise. */
  correlation?: number
  /** Emit per-class correlated shocks for allocated accounts; omit for single-factor only. */
  classShocks?: ClassShockConfig
}

export interface HistoricalModelConfig {
  type: 'historical'
  /**
   * iid: each year sampled independently; block: contiguous blocks keep
   * multi-year momentum/mean-reversion; sequence: full historical replay
   * from a random start. Blocks and sequences wrap around.
   */
  mode: 'iid' | 'block' | 'sequence'
  /** Stocks share of the sampled portfolio (default 60 ⇒ 60/40). */
  equityWeightPct?: number
  /**
   * Block length in years for mode 'block' (default 5): a whole number of at least 1. Any other value
   * is refused with a RangeError, in every mode, rather than rounded.
   */
  blockLengthYears?: number
  /**
   * Emit per-class shocks keyed off the same sampled historical years: stock
   * classes replay the S&P series, bonds the Treasury series (each centered on
   * its own mean), cash stays unshocked. No extra RNG draws, so the sampled
   * year sequence — and every unallocated account — is unchanged.
   */
  classShocks?: boolean
}

export interface StudentTModelConfig {
  type: 'student-t'
  /**
   * Degrees of freedom of the Student-t variate (lower = fatter tails; default 5). Must be a
   * finite number greater than 2; the model refuses anything else, because at 2 or below the
   * t variance is infinite and no volatility can be matched. Non-integer values are exact.
   */
  df?: number
  /** Standard deviation of the annual return shock, percentage points (default 12). */
  returnVolPct?: number
  inflationMeanPct: number
  inflationVolPct?: number
  /** Correlation between the return shock and inflation (default −0.2); a finite number from −1 to 1, refused otherwise. */
  correlation?: number
  classShocks?: ClassShockConfig
}

export interface RegimeSwitchModelConfig {
  type: 'regime-switch'
  /** Bull regime mean *deviation* (real, %; default +4 so symmetric with bear). */
  bullMeanPct?: number
  /** Bear regime mean *deviation* (real, %; default -4). */
  bearMeanPct?: number
  /** Bull vol (default 10). */
  bullVolPct?: number
  /** Bear vol (default 20). */
  bearVolPct?: number
  /** Probability of switching regime each year (default 0.05): a number from 0.001 to 0.5, refused otherwise. */
  switchProb?: number
  inflationMeanPct: number
  inflationVolPct?: number
  classShocks?: ClassShockConfig
}

export interface CapeConditionedModelConfig {
  type: 'cape-conditioned'
  /** Starting (or current) CAPE; high values reduce forward mean (default 25). */
  startingCape?: number
  /**
   * Sensitivity: %pt reduction in mean per CAPE point above 20 (default 0.15). The derived mean
   * adjustment -(startingCape - 20) * capeSensitivity is capped to [-4, 2] percentage points; the cap
   * bounds a derived value, not an input, and is stated on the model's calculation record.
   */
  capeSensitivity?: number
  returnVolPct?: number
  inflationMeanPct: number
  inflationVolPct?: number
  /** Correlation between the return shock and inflation (default −0.2); a finite number from −1 to 1, refused otherwise. */
  correlation?: number
  classShocks?: ClassShockConfig
}

export interface StationaryBootstrapModelConfig {
  type: 'stationary'
  equityWeightPct?: number
  /** Mean block length L (default 5): a finite number of at least 2, refused otherwise; see createStationaryBootstrapModel for the draw. */
  meanBlockLength?: number
  classShocks?: boolean
}

export interface EmpiricalModelConfig {
  type: 'empirical'
  /** Raw historical (no mean centering) vs centered. Non-centered is "honest" historical mean from data. */
  centered?: boolean
  equityWeightPct?: number
  classShocks?: boolean
}

export interface GarchModelConfig {
  type: 'garch'
  /** GARCH(1,1) weight on the prior year's squared innovation (default 0.1); a finite number of at least 0. */
  alpha?: number
  /** GARCH(1,1) weight on the prior year's variance (default 0.85); a finite number of at least 0, and alpha + beta must be below 1. */
  beta?: number
  /**
   * Long-run (unconditional) standard deviation of the annual return shock, percentage points
   * (default 12); a finite number of at least 0. The recursion's omega is not configurable: it is
   * set from this value as omega = (returnVolPct / 100)^2 * (1 - alpha - beta).
   */
  returnVolPct?: number
  inflationMeanPct: number
  inflationVolPct?: number
  /** Correlation between the return shock and inflation (default −0.2); a finite number from −1 to 1, refused otherwise. */
  correlation?: number
  classShocks?: ClassShockConfig
}

export interface InflationRegimeModelConfig {
  type: 'inflation-regime'
  /** Mean inflation in the high regime, percent (default 8). */
  highInflationMean?: number
  /** Probability of entering the high regime from the normal one each year (default 0.08): a number from 0.01 to 0.3, refused otherwise. */
  highInflationProb?: number
  returnVolPct?: number
  baseInflationMeanPct: number
  /** Correlation between the return shock and inflation (default −0.2); a finite number from −1 to 1, refused otherwise. */
  correlation?: number
  classShocks?: ClassShockConfig
}

export interface ReversedHistoryModelConfig {
  type: 'reversed-history'
  /**
   * Window length L in years (default 10): a whole number from 5 to the number of historical rows
   * (HISTORICAL_YEARS.length, 96). The model refuses any other value with a RangeError; it is never clamped.
   */
  windowLengthYears?: number
  equityWeightPct?: number
  classShocks?: boolean
}

export interface UserShockModelConfig {
  type: 'user-shock'
  /** 1-based year index in the path to apply the shock (default 1): a whole number of at least 1, refused otherwise. */
  shockYear?: number
  /** Additive shock in that year, percent (e.g. -20 for crash year). */
  shockPct?: number
  /** Base model after the shock year (lognormal params). */
  baseReturnVolPct?: number
  inflationMeanPct: number
  classShocks?: ClassShockConfig
}

export interface GaussianModelConfig {
  type: 'gaussian'
  /** Annual volatility of the portfolio return shock, percentage points (default 12). */
  returnVolPct?: number
  inflationMeanPct: number
  inflationVolPct?: number
  /** Correlation between the return shock and inflation (default −0.2); a finite number from −1 to 1, refused otherwise. */
  correlation?: number
  classShocks?: ClassShockConfig
}

export interface AR1ModelConfig {
  type: 'ar1'
  /**
   * Autoregression coefficient phi (default 0.25): a number from -0.9 to 0.95, refused otherwise.
   * Note: an earlier comment said 0.2; the code has always applied 0.25.
   */
  phi?: number
  returnVolPct?: number
  inflationMeanPct: number
  inflationVolPct?: number
  /** Correlation between the return shock and inflation (default −0.2); a finite number from −1 to 1, refused otherwise. */
  correlation?: number
  classShocks?: ClassShockConfig
}

export type MarketModelConfig =
  | LognormalModelConfig
  | HistoricalModelConfig
  | StudentTModelConfig
  | RegimeSwitchModelConfig
  | CapeConditionedModelConfig
  | StationaryBootstrapModelConfig
  | EmpiricalModelConfig
  | GarchModelConfig
  | InflationRegimeModelConfig
  | ReversedHistoryModelConfig
  | UserShockModelConfig
  | GaussianModelConfig
  | AR1ModelConfig

export function buildLognormalModelConfigForPlan(plan: Plan, returnVolPct = 12): LognormalModelConfig {
  const config: LognormalModelConfig = {
    type: 'lognormal',
    inflationMeanPct: plan.assumptions.inflationPct,
    returnVolPct,
  }
  if (!planUsesAssetAllocation(plan)) return config

  const params = resolveAssetClassParams(plan.assumptions.assetClassParams)
  const volatilityPctByClass = Object.fromEntries(
    ASSET_CLASS_IDS.map((id) => [id, params[id].volatilityPct]),
  ) as Record<AssetClassId, number>
  return { ...config, classShocks: { volatilityPctByClass } }
}

export function createMarketModel(config: MarketModelConfig): MarketModel {
  switch (config.type) {
    case 'lognormal':
      return createLognormalModel(config)
    case 'historical':
      return createHistoricalModel(config)
    case 'student-t':
      return createStudentTModel(config)
    case 'regime-switch':
      return createRegimeSwitchModel(config)
    case 'cape-conditioned':
      return createCapeConditionedModel(config)
    case 'stationary':
      return createStationaryBootstrapModel(config)
    case 'empirical':
      return createEmpiricalModel(config)
    case 'garch':
      return createGarchModel(config)
    case 'inflation-regime':
      return createInflationRegimeModel(config)
    case 'reversed-history':
      return createReversedHistoryModel(config)
    case 'user-shock':
      return createUserShockModel(config)
    case 'gaussian':
      return createGaussianModel(config)
    case 'ar1':
      return createAR1Model(config)
    default: {
      // MarketModelConfig is a discriminated union, so this branch is
      // unreachable and the `never` binding turns a forgotten case into a
      // compile error. The cast-to-lognormal it replaces defeated exactly
      // that: a new model type would have compiled, then silently run as
      // lognormal and reported the wrong distribution.
      const exhaustive: never = config
      throw new Error(
        'Unknown market model type: ' + String((exhaustive as { type?: unknown }).type),
      )
    }
  }
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

interface ClassShockSampler {
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
   *
   * `commonScale`, when given, multiplies every class's correlated draw after
   * the Cholesky mix (x_c = commonScale * sum_k chol[c][k] g[k]), so every class
   * shares one scale with the market factor. Student-t passes its unit-variance
   * mixing scale sqrt((df - 2) / V), which makes the class vector a multivariate
   * t sharing the market factor's V; GARCH passes sqrt(v_t) / sigmaBar, the
   * market factor's conditional standard deviation over its long-run one, so
   * class shocks cluster with the market. Every other model omits it, and its
   * draws are then unchanged.
   */
  sampleYear(
    rng: Rng,
    firstFactor: number,
    series: Record<AssetClassId, number[]>,
    yearIndex: number,
    transform: ClassShockTransform,
    commonScale?: number,
  ): void
}

/**
 * The return-inflation correlation a model reads (default -0.2). A value outside [-1, 1] is not a
 * correlation, and sqrt(1 - rho^2) would be undefined, so it is refused rather than clamped: a clamp
 * would silently run a different model from the one configured.
 */
function returnInflationCorrelation(modelName: string, correlation: number | undefined): number {
  const rho = correlation ?? -0.2
  if (!(Number.isFinite(rho) && rho >= -1 && rho <= 1)) {
    throw new RangeError(`${modelName} correlation must be a finite number from -1 to 1; got ${rho}.`)
  }
  return rho
}

/** Refuses a model parameter outside its documented closed range [min, max], or not finite. */
function requireInRange(label: string, value: number, min: number, max: number): number {
  if (!(Number.isFinite(value) && value >= min && value <= max)) {
    throw new RangeError(`${label} must be a number from ${min} to ${max}; got ${value}.`)
  }
  return value
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
 *
 * Refuses, with a RangeError, a class volatility that is missing, negative or
 * not finite (it used to be raised to 0 without a word), and, through
 * choleskyDecompose, a correlation matrix that is not positive definite.
 */
function makeClassShockSampler(classCfg: ClassShockConfig | undefined): ClassShockSampler | null {
  if (!classCfg) return null
  const chol = choleskyDecompose(classCfg.correlations ?? DEFAULT_CLASS_CORRELATIONS.map((r) => [...r]))
  const sigmas = ASSET_CLASS_IDS.map((id) => {
    const volPct = classCfg.volatilityPctByClass[id] as number | undefined
    if (!(volPct !== undefined && Number.isFinite(volPct) && volPct >= 0)) {
      throw new RangeError(
        `Class volatility for ${id} must be a finite number of at least 0 percentage points; got ${volPct}.`,
      )
    }
    return volPct / 100
  })
  // Reused across years: every element is overwritten before it is read.
  const g = new Array<number>(ASSET_CLASS_IDS.length)
  return {
    sampleYear(rng, firstFactor, series, yearIndex, transform, commonScale) {
      g[0] = firstFactor
      for (let k = 1; k < g.length; k++) g[k] = rng.nextNormal()
      for (let c = 0; c < ASSET_CLASS_IDS.length; c++) {
        let x = 0
        for (let k = 0; k <= c && k < g.length; k++) x += chol[c]![k]! * g[k]!
        if (commonScale !== undefined) x *= commonScale
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
export function createLognormalModel(config: LognormalModelConfig): MarketModel {
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = returnInflationCorrelation('Lognormal', config.correlation)
  // Per-class correlated shocks (optional). z1 — the single market factor —
  // doubles as the first Gaussian source, so class shocks co-move with the
  // single-factor shock (and with inflation through it) and allocated vs
  // unallocated accounts see the same market in the same year.
  const classCfg = config.classShocks
  const classShocks = makeClassShockSampler(classCfg)
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
 *
 * blockLengthYears (default 5) must be a whole number of at least 1 in every
 * mode; any other value is refused with a RangeError (it used to be rounded
 * and raised to 1 without a word).
 */
export function createHistoricalModel(config: HistoricalModelConfig): MarketModel {
  const equityWeightPct = config.equityWeightPct ?? 60
  const blockLength = config.blockLengthYears ?? 5
  if (!(Number.isInteger(blockLength) && blockLength >= 1)) {
    throw new RangeError(`Historical blockLengthYears must be a whole number of at least 1; got ${blockLength}.`)
  }
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
 * Chi-square variate V ~ chi^2(df) for real df >= 2, as V = 2 * G with G ~ Gamma(a = df/2, 1) drawn by
 * Marsaglia and Tsang (2000, "A simple method for generating gamma variables", ACM TOMS 26(3):363-372),
 * exact for every real shape a >= 1:
 *   d = a - 1/3, c = 1 / sqrt(9d); repeat:
 *     u1 = max(next(), 1e-12), u2 = next(); x = sqrt(-2 ln u1) * cos(2 pi u2)   (a standard normal)
 *     s = 1 + c x; if s <= 0 reject (no further draw this attempt)
 *     v = s^3; u = next()
 *     accept if u < 1 - 0.0331 x^4 (the squeeze), else accept if ln u < x^2/2 + d(1 - v + ln v), else reject
 *   on accept return 2 d v.
 * Every draw is a uniform from rng.next(): the normal x is built by Box-Muller from its own two
 * uniforms (cosine branch; the sine branch is discarded), never from rng.nextNormal(), so the
 * variable number of rejections cannot disturb the shared spare-normal cache or the count of
 * normals a model draws per year. An attempt consumes 2 uniforms when rejected at s <= 0, else 3.
 * The 1e-12 floor on u1 mirrors rng.ts and caps |x| near 7.43. A df below 2 (shape below 1, where
 * the method is not exact) or not finite is refused with a RangeError.
 */
export function sampleChiSquare(rng: Rng, df: number): number {
  if (!(Number.isFinite(df) && df >= 2)) {
    throw new RangeError(`sampleChiSquare needs a finite df of at least 2 (shape df/2 of at least 1); got ${df}.`)
  }
  const d = df / 2 - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    const u1 = Math.max(rng.next(), 1e-12)
    const u2 = rng.next()
    const x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    const s = 1 + c * x
    if (s <= 0) continue
    const v = s * s * s
    const u = rng.next()
    const x2 = x * x
    if (u < 1 - 0.0331 * x2 * x2) return 2 * d * v
    if (Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))) return 2 * d * v
  }
}

/**
 * Student-t return model, scaled so the shock's standard deviation equals returnVolPct.
 *   df    = config.df ?? 5, refused with a RangeError unless finite and > 2
 *   sigma = (config.returnVolPct ?? 12) / 100
 *   per path year, in this order:
 *     Z  = rng.nextNormal()                    (the year's first normal draw)
 *     V  = sampleChiSquare(rng, df)            (uniforms only)
 *     m  = sqrt((df - 2) / V)                  (E[m^2] = 1)
 *     t  = m * Z                               (sqrt((df - 2)/df) times a Student-t with df degrees of freedom: mean 0, variance 1)
 *     published return shock = sigma * t * 100 (percentage points; standard deviation 100 * sigma)
 *     z2 = rng.nextNormal()
 *     inflation = inflationMeanPct + inflationVolPct * (rho * t + sqrt(1 - rho^2) * z2)
 *     class shocks, when configured: first factor Z, common scale m, so the class vector is a
 *       multivariate t with the configured class correlations and volatilities, and the first
 *       class's draw (usStocks, Cholesky row [1, 0, ...]) equals t.
 * Defaults: df 5, returnVolPct 12, inflationVolPct 1.5, correlation -0.2 (a correlation outside
 * [-1, 1] is refused). For df <= 4 the shock's fourth moment is infinite.
 */
export function createStudentTModel(config: StudentTModelConfig): MarketModel {
  const df = config.df ?? 5
  if (!(Number.isFinite(df) && df > 2)) {
    throw new RangeError(
      `Student-t degrees of freedom must be a finite number greater than 2 (at 2 or below the variance is infinite, so no volatility can be matched); got ${df}.`,
    )
  }
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = returnInflationCorrelation('Student-t', config.correlation)
  const classCfg = config.classShocks
  const classShocks = makeClassShockSampler(classCfg)
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = classCfg
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      for (let i = 0; i < yearCount; i++) {
        const z = rng.nextNormal()
        const m = Math.sqrt((df - 2) / sampleChiSquare(rng, df))
        const t = m * z
        returnShockPct[i] = sigma * t * 100
        const z2 = rng.nextNormal()
        inflationPct[i] = inflMean + inflVol * (rho * t + Math.sqrt(1 - rho * rho) * z2)
        if (classSeries && classShocks) {
          classShocks.sampleYear(rng, z, classSeries, i, additiveShockPct, m)
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
 * switchProb (default 0.05) must be a number from 0.001 to 0.5; any other value is refused with a
 * RangeError (it used to be clamped into that range without a word).
 */
export function createRegimeSwitchModel(config: RegimeSwitchModelConfig): MarketModel {
  const bullMean = (config.bullMeanPct ?? 4) / 100
  const bearMean = (config.bearMeanPct ?? -4) / 100
  const bullVol = (config.bullVolPct ?? 10) / 100
  const bearVol = (config.bearVolPct ?? 20) / 100
  const pSwitch = requireInRange('Regime-switch switchProb', config.switchProb ?? 0.05, 0.001, 0.5)
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const classCfg = config.classShocks
  const classShocks = makeClassShockSampler(classCfg)
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
 * Uses lognormal base but shifts mu down. The adjustment -(startingCape - 20) *
 * capeSensitivity is capped to [-4, 2] percentage points. The cap is kept on
 * purpose: it bounds a derived value, not an input the caller set, and the
 * model's calculation record states it.
 */
export function createCapeConditionedModel(config: CapeConditionedModelConfig): MarketModel {
  const startCape = config.startingCape ?? 25
  const sens = config.capeSensitivity ?? 0.15
  const baseMuAdj = Math.max(-4, Math.min(2, -(startCape - 20) * sens)) // pp adjustment
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = returnInflationCorrelation('CAPE-conditioned', config.correlation)
  const classCfg = config.classShocks
  const classShocks = makeClassShockSampler(classCfg)
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
 * With L = meanBlockLength ?? 5 and n the number of historical rows, the path draws
 * a start row cursor = nextInt(n) and then a block length
 *   remaining = floor(−ln(1 − U) · L) || 1        (U = next uniform draw)
 * (the inverse CDF of an exponential with mean L, floored, and 1 when the floor is
 * 0; the "|| 1" is kept on purpose, because a block of length 0 would publish no
 * row). L must be a finite number of at least 2; any other value is refused with a
 * RangeError (a value below 2 used to be raised to 2 without a word). Each path
 * year publishes the row at cursor (blended return at equityWeightPct
 * minus the dataset mean at that weight; inflation as-is), then advances cursor by
 * one with wrap and decrements remaining; when remaining reaches 0 a new start row
 * and a new block length are drawn in that order. Draw order per block: nextInt(n),
 * then next(). Note: the block length is drawn once per block, so this is NOT a
 * per-year continuation coin with probability 1/L; the two laws differ (a coin can
 * restart in consecutive years, and the floor and the "|| 1" clamp shape the length
 * distribution), even though both have mean block length near L.
 */
export function createStationaryBootstrapModel(config: StationaryBootstrapModelConfig): MarketModel {
  const equityWeightPct = config.equityWeightPct ?? 60
  const meanBlock = config.meanBlockLength ?? 5
  if (!(Number.isFinite(meanBlock) && meanBlock >= 2)) {
    throw new RangeError(`Stationary bootstrap meanBlockLength must be a finite number of at least 2; got ${meanBlock}.`)
  }
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
export function createEmpiricalModel(config: EmpiricalModelConfig): MarketModel {
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

/**
 * GARCH(1,1) return-volatility model (Bollerslev 1986) with variance targeting (Engle and Mezrich 1996):
 * the long-run variance is pinned to the configured volatility.
 *   sigmaBar = (config.returnVolPct ?? 12) / 100            (refused unless finite and >= 0)
 *   alpha = config.alpha ?? 0.1, beta = config.beta ?? 0.85  (refused unless finite, >= 0, and alpha + beta < 1)
 *   omega = sigmaBar^2 * (1 - alpha - beta), so omega / (1 - alpha - beta) = sigmaBar^2
 * State before the first year: v_1 = sigmaBar^2 (the unconditional variance).
 * For each path year t = 1..N, in this order:
 *   Z1_t = rng.nextNormal()                  (the year's first normal draw)
 *   e_t  = sqrt(v_t) * Z1_t                  (the innovation, a fraction)
 *   published return shock = 100 * e_t       (percentage points)
 *   Z2_t = rng.nextNormal()
 *   inflation_t = inflationMeanPct + inflationVolPct * (rho * Z1_t + sqrt(1 - rho^2) * Z2_t)
 *   class shocks, when configured: first factor Z1_t and common scale sqrt(v_t) / sigmaBar (this
 *     year's v_t, before the update below), so every class keeps its configured long-run volatility
 *     and correlations and its conditional volatility moves with the market's; at sigmaBar = 0 the
 *     market variance is 0 in every year, there is nothing to share, and the scale is 1
 *   v_{t+1} = omega + alpha * e_t^2 + beta * v_t   (the innovation itself is fed back)
 * E[v_t] = sigmaBar^2 for every t, so every year's shock has unconditional standard deviation returnVolPct.
 * The variance v_t is internal and not published; only the shock, inflation and class series are.
 * Defaults: inflationVolPct 1.5, correlation -0.2 (a correlation outside [-1, 1] is refused).
 */
export function createGarchModel(config: GarchModelConfig): MarketModel {
  const volPct = config.returnVolPct ?? 12
  const alpha = config.alpha ?? 0.1
  const beta = config.beta ?? 0.85
  if (!(Number.isFinite(volPct) && volPct >= 0)) {
    throw new RangeError(`GARCH returnVolPct must be a finite number of at least 0; got ${volPct}.`)
  }
  if (!(Number.isFinite(alpha) && Number.isFinite(beta) && alpha >= 0 && beta >= 0)) {
    throw new RangeError(`GARCH alpha and beta must be finite numbers of at least 0; got alpha ${alpha}, beta ${beta}.`)
  }
  if (!(alpha + beta < 1)) {
    throw new RangeError(
      `GARCH alpha + beta must be below 1 for a finite long-run variance; got alpha ${alpha} + beta ${beta} = ${alpha + beta}.`,
    )
  }
  const sigmaBar = volPct / 100
  const longRunVariance = sigmaBar * sigmaBar
  const omega = longRunVariance * (1 - alpha - beta)
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = returnInflationCorrelation('GARCH', config.correlation)
  const classCfg = config.classShocks
  const classShocks = makeClassShockSampler(classCfg)
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = classCfg
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      let variance = longRunVariance
      for (let i = 0; i < yearCount; i++) {
        const z1 = rng.nextNormal()
        const innovation = Math.sqrt(variance) * z1
        returnShockPct[i] = innovation * 100
        const z2 = rng.nextNormal()
        inflationPct[i] = inflMean + inflVol * (rho * z1 + Math.sqrt(1 - rho * rho) * z2)
        if (classSeries && classShocks) {
          const commonScale = sigmaBar > 0 ? Math.sqrt(variance) / sigmaBar : 1
          classShocks.sampleYear(rng, z1, classSeries, i, additiveShockPct, commonScale)
        }
        variance = omega + alpha * innovation * innovation + beta * variance
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/**
 * Fat-tailed / regime inflation correlated to returns. highInflationProb (default 0.08) must be a
 * number from 0.01 to 0.3; any other value is refused with a RangeError (it used to be clamped into
 * that range without a word).
 */
export function createInflationRegimeModel(config: InflationRegimeModelConfig): MarketModel {
  const highMu = config.highInflationMean ?? 8
  const pHigh = requireInRange('Inflation-regime highInflationProb', config.highInflationProb ?? 0.08, 0.01, 0.3)
  const sigma = (config.returnVolPct ?? 12) / 100
  const baseInfl = config.baseInflationMeanPct
  const rho = returnInflationCorrelation('Inflation-regime', config.correlation)
  const classCfg = config.classShocks
  const classShocks = makeClassShockSampler(classCfg)
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

/** The shortest reversed-history window, in years; D-REVERSED-WINDOW-FLOOR keeps 5 as the minimum. */
const MIN_REVERSED_WINDOW_YEARS = 5

/**
 * Reversed-history replay: one window of consecutive historical rows, played backwards.
 *
 * With L = windowLengthYears (default 10) and n the number of historical rows, L must be a whole
 * number from 5 to n; any other value is refused with a RangeError (never clamped). The path draws
 * one start index uniformly from 0..n-L (rng.nextInt(n - L + 1)) and then, for path
 * year i (0-based), replays the row at index start + L - 1 - (i mod L): the window's last row first,
 * back to its first row, then wrapping to the last row again for paths longer than L. Each replayed
 * year publishes the blended-portfolio return of that row at equityWeightPct minus the dataset mean at
 * that weight (meanPortfolioReturnPct, so shocks are centered), and the row's inflation rate as-is.
 * Class shocks, when configured: US and international stocks both take the row's stock return minus the
 * all-stock dataset mean, bonds take the row's bond return minus the all-bond mean, and cash is zero.
 */
export function createReversedHistoryModel(config: ReversedHistoryModelConfig): MarketModel {
  const equityWeightPct = config.equityWeightPct ?? 60
  const n = HISTORICAL_YEARS.length
  const winLen = config.windowLengthYears ?? 10
  if (!(Number.isInteger(winLen) && winLen >= MIN_REVERSED_WINDOW_YEARS && winLen <= n)) {
    throw new RangeError(
      `Reversed-history windowLengthYears must be a whole number of years from ${MIN_REVERSED_WINDOW_YEARS} to ${n} (the length of the historical series); got ${winLen}.`,
    )
  }
  const mean = meanPortfolioReturnPct(equityWeightPct)
  const meanS = meanPortfolioReturnPct(100)
  const meanB = meanPortfolioReturnPct(0)
  const maxStart = n - winLen
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = config.classShocks
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      // maxStart >= 0 because winLen <= n, and 0 <= idx <= n - 1, so no wrap is needed.
      const start = rng.nextInt(maxStart + 1)
      for (let i = 0; i < yearCount; i++) {
        const off = i % winLen
        const idx = start + winLen - 1 - off
        const sample = HISTORICAL_YEARS[idx]!
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

/**
 * User-specified deterministic shock in one year, then lognormal-ish. shockYear (1-based, default 1)
 * must be a whole number of at least 1; any other value is refused with a RangeError (a value below 1
 * used to be raised to 1, and a fractional value silently produced no shock year at all).
 */
export function createUserShockModel(config: UserShockModelConfig): MarketModel {
  const shockYear = config.shockYear ?? 1 // 1-based
  if (!(Number.isInteger(shockYear) && shockYear >= 1)) {
    throw new RangeError(`User-shock shockYear must be a whole number of at least 1 (a 1-based path year); got ${shockYear}.`)
  }
  const shock = config.shockPct ?? -20
  const sigma = (config.baseReturnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const classCfg = config.classShocks
  const classShocks = makeClassShockSampler(classCfg)
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
export function createGaussianModel(config: GaussianModelConfig): MarketModel {
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = returnInflationCorrelation('Gaussian', config.correlation)
  const classCfg = config.classShocks
  const classShocks = makeClassShockSampler(classCfg)
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
 * phi (default 0.25) must be a number from -0.9 to 0.95; any other value is refused with a
 * RangeError (it used to be clamped into that range without a word).
 */
export function createAR1Model(config: AR1ModelConfig): MarketModel {
  const phi = requireInRange('AR(1) phi', config.phi ?? 0.25, -0.9, 0.95)
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = returnInflationCorrelation('AR(1)', config.correlation)
  const classCfg = config.classShocks
  const classShocks = makeClassShockSampler(classCfg)
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

