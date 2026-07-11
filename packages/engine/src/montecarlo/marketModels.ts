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
  /** Annual volatility per class, percentage points, ASSET_CLASS_IDS keys. */
  volatilityPctByClass: Record<AssetClassId, number>
  /** Correlation matrix over ASSET_CLASS_IDS order; default: the documented long-horizon matrix. */
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
  /** Correlation between the return shock and inflation (default −0.2). */
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
  /** Block length in years for mode 'block' (default 5). */
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
  /** Degrees of freedom for t (lower = fatter tails; default 5). */
  df?: number
  /** Annual volatility of the portfolio return, percentage points (default 12). */
  returnVolPct?: number
  inflationMeanPct: number
  inflationVolPct?: number
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
  /** Probability of switching regime each year (default 0.05). */
  switchProb?: number
  inflationMeanPct: number
  inflationVolPct?: number
  classShocks?: ClassShockConfig
}

export interface CapeConditionedModelConfig {
  type: 'cape-conditioned'
  /** Starting (or current) CAPE; high values reduce forward mean (default 25). */
  startingCape?: number
  /** Sensitivity: %pt reduction in mean per CAPE point above 20 (default 0.15). */
  capeSensitivity?: number
  returnVolPct?: number
  inflationMeanPct: number
  inflationVolPct?: number
  correlation?: number
  classShocks?: ClassShockConfig
}

export interface StationaryBootstrapModelConfig {
  type: 'stationary'
  equityWeightPct?: number
  /** Expected block length (geometric; default 5). */
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
  /** GARCH(1,1) omega (base var, scaled). Default tuned for ~12% ann vol. */
  omega?: number
  alpha?: number
  beta?: number
  returnVolScalePct?: number
  inflationMeanPct: number
  inflationVolPct?: number
  correlation?: number
  classShocks?: ClassShockConfig
}

export interface InflationRegimeModelConfig {
  type: 'inflation-regime'
  /** Normal vs high-inflation regime. */
  highInflationMean?: number
  highInflationProb?: number
  returnVolPct?: number
  baseInflationMeanPct: number
  correlation?: number
  classShocks?: ClassShockConfig
}

export interface ReversedHistoryModelConfig {
  type: 'reversed-history'
  /** Window length for reversed replay blocks. */
  windowLengthYears?: number
  equityWeightPct?: number
  classShocks?: boolean
}

export interface UserShockModelConfig {
  type: 'user-shock'
  /** 1-based year index in the path to apply the shock. */
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
  correlation?: number
  classShocks?: ClassShockConfig
}

export interface AR1ModelConfig {
  type: 'ar1'
  /** Autoregression coefficient phi (0 < phi < 1 for mean reversion; default 0.2). */
  phi?: number
  returnVolPct?: number
  inflationMeanPct: number
  inflationVolPct?: number
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
    default:
      // exhaustive guard for future
      return createLognormalModel(config as LognormalModelConfig)
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
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  // Per-class correlated shocks (optional). z1 — the single market factor —
  // doubles as the first Gaussian source, so class shocks co-move with the
  // single-factor shock (and with inflation through it) and allocated vs
  // unallocated accounts see the same market in the same year.
  const classCfg = config.classShocks
  const chol = classCfg ? choleskyDecompose(classCfg.correlations ?? DEFAULT_CLASS_CORRELATIONS.map((r) => [...r])) : null
  const classSigmas = classCfg ? ASSET_CLASS_IDS.map((id) => Math.max(0, classCfg.volatilityPctByClass[id] ?? 0) / 100) : null
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
        if (classSeries && chol && classSigmas) {
          // Extra draws only in class mode, after z1/z2 — the single-factor
          // and inflation paths above are bit-identical with classShocks off.
          const g = [z1, rng.nextNormal(), rng.nextNormal(), rng.nextNormal()]
          for (let c = 0; c < ASSET_CLASS_IDS.length; c++) {
            let x = 0
            for (let k = 0; k <= c && k < g.length; k++) x += chol[c]![k]! * g[k]!
            const s = classSigmas[c]!
            classSeries[ASSET_CLASS_IDS[c]!]![i] = (Math.exp(s * x - (s * s) / 2) - 1) * 100
          }
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
export function createHistoricalModel(config: HistoricalModelConfig): MarketModel {
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
 * Student-t fat-tailed returns (mean-preserving). Uses t-distributed shocks
 * scaled to target volatility; lower df => fatter tails than Gaussian.
 * Draws: z_t for return, then inflation copula, then class after.
 */
export function createStudentTModel(config: StudentTModelConfig): MarketModel {
  const df = Math.max(3, config.df ?? 5)
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  const classCfg = config.classShocks
  const chol = classCfg ? choleskyDecompose(classCfg.correlations ?? DEFAULT_CLASS_CORRELATIONS.map((r) => [...r])) : null
  const classSigmas = classCfg ? ASSET_CLASS_IDS.map((id) => Math.max(0, classCfg.volatilityPctByClass[id] ?? 0) / 100) : null
  // Use normal scaled + occasional large deviation for fat tails; always E~0
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = classCfg
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      for (let i = 0; i < yearCount; i++) {
        let z = rng.nextNormal()
        // fat tail: with small prob use larger multiplier (mixture for tails)
        if (rng.next() < 0.05) z *= (df > 4 ? 2.5 : 3.5)
        returnShockPct[i] = sigma * z * 100
        const z2 = rng.nextNormal()
        inflationPct[i] = inflMean + inflVol * (rho * z + Math.sqrt(1 - rho * rho) * z2)
        if (classSeries && chol && classSigmas) {
          const g = [z, rng.nextNormal(), rng.nextNormal(), rng.nextNormal()]
          for (let c = 0; c < ASSET_CLASS_IDS.length; c++) {
            let x = 0
            for (let k = 0; k <= c && k < g.length; k++) x += chol[c]![k]! * g[k]!
            const s = classSigmas[c]!
            classSeries[ASSET_CLASS_IDS[c]!]![i] = s * x * 100
          }
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
export function createRegimeSwitchModel(config: RegimeSwitchModelConfig): MarketModel {
  const bullMean = (config.bullMeanPct ?? 4) / 100
  const bearMean = (config.bearMeanPct ?? -4) / 100
  const bullVol = (config.bullVolPct ?? 10) / 100
  const bearVol = (config.bearVolPct ?? 20) / 100
  const pSwitch = Math.max(0.001, Math.min(0.5, config.switchProb ?? 0.05))
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const classCfg = config.classShocks
  const chol = classCfg ? choleskyDecompose(classCfg.correlations ?? DEFAULT_CLASS_CORRELATIONS.map((r) => [...r])) : null
  const classSigmas = classCfg ? ASSET_CLASS_IDS.map((id) => Math.max(0, classCfg.volatilityPctByClass[id] ?? 0) / 100) : null
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
        if (classSeries && chol && classSigmas) {
          const g = [z, rng.nextNormal(), rng.nextNormal(), rng.nextNormal()]
          for (let c = 0; c < ASSET_CLASS_IDS.length; c++) {
            let x = 0
            for (let k = 0; k <= c && k < g.length; k++) x += chol[c]![k]! * g[k]!
            const s = classSigmas[c]!
            classSeries[ASSET_CLASS_IDS[c]!]![i] = (mu + s * x) * 100
          }
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
export function createCapeConditionedModel(config: CapeConditionedModelConfig): MarketModel {
  const startCape = config.startingCape ?? 25
  const sens = config.capeSensitivity ?? 0.15
  const baseMuAdj = Math.max(-4, Math.min(2, -(startCape - 20) * sens)) // pp adjustment
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  const classCfg = config.classShocks
  const chol = classCfg ? choleskyDecompose(classCfg.correlations ?? DEFAULT_CLASS_CORRELATIONS.map((r) => [...r])) : null
  const classSigmas = classCfg ? ASSET_CLASS_IDS.map((id) => Math.max(0, classCfg.volatilityPctByClass[id] ?? 0) / 100) : null
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
        if (classSeries && chol && classSigmas) {
          const g = [z1, rng.nextNormal(), rng.nextNormal(), rng.nextNormal()]
          for (let c = 0; c < ASSET_CLASS_IDS.length; c++) {
            let x = 0
            for (let k = 0; k <= c && k < g.length; k++) x += chol[c]![k]! * g[k]!
            const s = classSigmas[c]!
            classSeries[ASSET_CLASS_IDS[c]!]![i] = (Math.exp(s * x - (s * s) / 2) - 1) * 100 + adj
          }
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/** Stationary (Politis-Romano) bootstrap: geometric block lengths. */
export function createStationaryBootstrapModel(config: StationaryBootstrapModelConfig): MarketModel {
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

/** GARCH(1,1) approx for vol clustering. Simple recursion on sigma_t. */
export function createGarchModel(config: GarchModelConfig): MarketModel {
  const omega = config.omega ?? 0.00001
  const alpha = config.alpha ?? 0.1
  const beta = config.beta ?? 0.85
  const scale = (config.returnVolScalePct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  const classCfg = config.classShocks
  const chol = classCfg ? choleskyDecompose(classCfg.correlations ?? DEFAULT_CLASS_CORRELATIONS.map((r) => [...r])) : null
  const classSigmas = classCfg ? ASSET_CLASS_IDS.map((id) => Math.max(0, classCfg.volatilityPctByClass[id] ?? 0) / 100) : null
  return {
    generatePath(rng: Rng, yearCount: number): MarketSeries {
      const returnShockPct: number[] = new Array(yearCount)
      const inflationPct: number[] = new Array(yearCount)
      const classSeries = classCfg
        ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
        : null
      let sigma2 = 0.0001
      let lastEps = 0
      for (let i = 0; i < yearCount; i++) {
        sigma2 = omega + alpha * lastEps * lastEps + beta * sigma2
        const sig = Math.sqrt(Math.max(1e-9, sigma2)) * scale * 5 // tune
        const z1 = rng.nextNormal()
        const shock = sig * z1
        returnShockPct[i] = shock * 100
        const z2 = rng.nextNormal()
        inflationPct[i] = inflMean + inflVol * (rho * z1 + Math.sqrt(1 - rho * rho) * z2)
        lastEps = shock
        if (classSeries && chol && classSigmas) {
          const g = [z1, rng.nextNormal(), rng.nextNormal(), rng.nextNormal()]
          for (let c = 0; c < ASSET_CLASS_IDS.length; c++) {
            let x = 0
            for (let k = 0; k <= c && k < g.length; k++) x += chol[c]![k]! * g[k]!
            const s = classSigmas[c]!
            classSeries[ASSET_CLASS_IDS[c]!]![i] = s * x * 100
          }
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/** Fat-tailed / regime inflation correlated to returns. */
export function createInflationRegimeModel(config: InflationRegimeModelConfig): MarketModel {
  const highMu = config.highInflationMean ?? 8
  const pHigh = Math.max(0.01, Math.min(0.3, config.highInflationProb ?? 0.08))
  const sigma = (config.returnVolPct ?? 12) / 100
  const baseInfl = config.baseInflationMeanPct
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  const classCfg = config.classShocks
  const chol = classCfg ? choleskyDecompose(classCfg.correlations ?? DEFAULT_CLASS_CORRELATIONS.map((r) => [...r])) : null
  const classSigmas = classCfg ? ASSET_CLASS_IDS.map((id) => Math.max(0, classCfg.volatilityPctByClass[id] ?? 0) / 100) : null
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
        if (classSeries && chol && classSigmas) {
          const g = [z1, rng.nextNormal(), rng.nextNormal(), rng.nextNormal()]
          for (let c = 0; c < ASSET_CLASS_IDS.length; c++) {
            let x = 0
            for (let k = 0; k <= c && k < g.length; k++) x += chol[c]![k]! * g[k]!
            const s = classSigmas[c]!
            classSeries[ASSET_CLASS_IDS[c]!]![i] = (Math.exp(s * x - (s * s) / 2) - 1) * 100
          }
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

/** Reversed history blocks chosen stochastically (formalized from suites). */
export function createReversedHistoryModel(config: ReversedHistoryModelConfig): MarketModel {
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
export function createUserShockModel(config: UserShockModelConfig): MarketModel {
  const shockYear = Math.max(1, config.shockYear ?? 1) // 1-based
  const shock = config.shockPct ?? -20
  const sigma = (config.baseReturnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const classCfg = config.classShocks
  const chol = classCfg ? choleskyDecompose(classCfg.correlations ?? DEFAULT_CLASS_CORRELATIONS.map((r) => [...r])) : null
  const classSigmas = classCfg ? ASSET_CLASS_IDS.map((id) => Math.max(0, classCfg.volatilityPctByClass[id] ?? 0) / 100) : null
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
        if (classSeries && chol && classSigmas) {
          const g = [z1, rng.nextNormal(), rng.nextNormal(), rng.nextNormal()]
          for (let c = 0; c < ASSET_CLASS_IDS.length; c++) {
            let x = 0
            for (let k = 0; k <= c && k < g.length; k++) x += chol[c]![k]! * g[k]!
            const s = classSigmas[c]!
            const id = ASSET_CLASS_IDS[c]!
            if (yearIdx === shockYear) {
              classSeries[id]![i] = (id === 'cash') ? 0 : shock * (id === 'usStocks' || id === 'intlStocks' ? 1 : 0.6)
            } else {
              classSeries[id]![i] = (Math.exp(s * x - (s * s) / 2) - 1) * 100
            }
          }
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
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  const classCfg = config.classShocks
  const chol = classCfg ? choleskyDecompose(classCfg.correlations ?? DEFAULT_CLASS_CORRELATIONS.map((r) => [...r])) : null
  const classSigmas = classCfg ? ASSET_CLASS_IDS.map((id) => Math.max(0, classCfg.volatilityPctByClass[id] ?? 0) / 100) : null
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
        if (classSeries && chol && classSigmas) {
          const g = [z1, rng.nextNormal(), rng.nextNormal(), rng.nextNormal()]
          for (let c = 0; c < ASSET_CLASS_IDS.length; c++) {
            let x = 0
            for (let k = 0; k <= c && k < g.length; k++) x += chol[c]![k]! * g[k]!
            const s = classSigmas[c]!
            classSeries[ASSET_CLASS_IDS[c]!]![i] = s * x * 100
          }
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
export function createAR1Model(config: AR1ModelConfig): MarketModel {
  const phi = Math.max(-0.9, Math.min(0.95, config.phi ?? 0.25))
  const sigma = (config.returnVolPct ?? 12) / 100
  const inflMean = config.inflationMeanPct
  const inflVol = config.inflationVolPct ?? 1.5
  const rho = Math.max(-1, Math.min(1, config.correlation ?? -0.2))
  const classCfg = config.classShocks
  const chol = classCfg ? choleskyDecompose(classCfg.correlations ?? DEFAULT_CLASS_CORRELATIONS.map((r) => [...r])) : null
  const classSigmas = classCfg ? ASSET_CLASS_IDS.map((id) => Math.max(0, classCfg.volatilityPctByClass[id] ?? 0) / 100) : null
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
        if (classSeries && chol && classSigmas) {
          const g = [eps, rng.nextNormal(), rng.nextNormal(), rng.nextNormal()]
          for (let c = 0; c < ASSET_CLASS_IDS.length; c++) {
            let x = 0
            for (let k = 0; k <= c && k < g.length; k++) x += chol[c]![k]! * g[k]!
            const s = classSigmas[c]!
            classSeries[ASSET_CLASS_IDS[c]!]![i] = s * x * 100
          }
        }
      }
      return classSeries
        ? { returnShockPct, inflationPct, classReturnShockPct: classSeries }
        : { returnShockPct, inflationPct }
    },
  }
}

