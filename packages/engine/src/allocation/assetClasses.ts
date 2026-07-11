/**
 * Asset classes, sourced default parameters, and allocation/glidepath math
 * (asset-allocation-and-return-model-v2, steps 1–3).
 *
 * Pure helpers shared by the deterministic ledger, Monte Carlo class shocks,
 * the decision engine's asset-location generator, and the UI. The schema for
 * per-account allocation policies lives in `engine/model/plan.ts`; this module
 * owns the numbers and the math.
 *
 * Allocation is opt-in per account: an account without an `allocation` keeps
 * the single expected-return model unchanged (feature-off is byte-identical).
 *
 * @see DOCS/domain/domain-rules-reference.md §14 (class defaults + sources)
 */

import type {
  AssetAllocationPolicy,
  AssetClassId,
  AssetClassParamOverrides,
  Assumptions,
  AllocationWeights,
  Account,
  Plan,
} from '../model/plan.js'
import { ASSET_CLASS_IDS } from '../model/plan.js'

export interface AssetClassParams {
  label: string
  /** Long-run expected annual nominal total return, percent. */
  returnPct: number
  /** Annual return volatility, percentage points (drives Monte Carlo class shocks). */
  volatilityPct: number
  /** Portion of the total return distributed as taxable interest, percent of balance. */
  interestYieldPct: number
  /** Portion of the total return distributed as dividends, percent of balance. */
  dividendYieldPct: number
  /** Share of dividends taxed as qualified dividends, percent. */
  qualifiedRatioPct: number
}

/**
 * Sourced planning defaults, editable in Assumptions. Expected returns follow
 * the app's long-run nominal conventions (the in-app return estimator uses
 * stocks ≈ 7%, bonds ≈ 4%, cash ≈ 2.5%); volatilities and correlations are
 * long-horizon historical values from the Damodaran (NYU Stern) annual
 * dataset — the same source as the embedded Monte Carlo history — with
 * international equity proxied by MSCI EAFE history. Yields are current-era
 * index-fund figures. Sources + review cadence:
 * DOCS/domain/domain-rules-reference.md §14.
 */
export const DEFAULT_ASSET_CLASS_PARAMS: Record<AssetClassId, AssetClassParams> = {
  usStocks: { label: 'US stocks', returnPct: 7.0, volatilityPct: 19.6, interestYieldPct: 0, dividendYieldPct: 1.5, qualifiedRatioPct: 95 },
  intlStocks: { label: 'International stocks', returnPct: 7.0, volatilityPct: 21.0, interestYieldPct: 0, dividendYieldPct: 3.0, qualifiedRatioPct: 70 },
  bonds: { label: 'Bonds', returnPct: 4.0, volatilityPct: 7.7, interestYieldPct: 4.0, dividendYieldPct: 0, qualifiedRatioPct: 0 },
  cash: { label: 'Cash', returnPct: 2.5, volatilityPct: 0.5, interestYieldPct: 2.5, dividendYieldPct: 0, qualifiedRatioPct: 0 },
}

/**
 * Default long-horizon correlation matrix over ASSET_CLASS_IDS order
 * (usStocks, intlStocks, bonds, cash). Documented + sourced in domain rules
 * §14; editable defaults can ship later without changing this seam.
 */
export const DEFAULT_CLASS_CORRELATIONS: readonly (readonly number[])[] = [
  [1.0, 0.75, 0.1, 0.0],
  [0.75, 1.0, 0.1, 0.0],
  [0.1, 0.1, 1.0, 0.2],
  [0.0, 0.0, 0.2, 1.0],
]

/** Assumption overrides merged over the sourced defaults (absent = default). */
export function resolveAssetClassParams(
  overrides: AssetClassParamOverrides | undefined,
): Record<AssetClassId, AssetClassParams> {
  const resolved = {} as Record<AssetClassId, AssetClassParams>
  for (const id of ASSET_CLASS_IDS) {
    const d = DEFAULT_ASSET_CLASS_PARAMS[id]
    const o = overrides?.[id]
    resolved[id] = {
      label: d.label,
      returnPct: o?.returnPct ?? d.returnPct,
      volatilityPct: o?.volatilityPct ?? d.volatilityPct,
      interestYieldPct: o?.interestYieldPct ?? d.interestYieldPct,
      dividendYieldPct: o?.dividendYieldPct ?? d.dividendYieldPct,
      qualifiedRatioPct: o?.qualifiedRatioPct ?? d.qualifiedRatioPct,
    }
  }
  return resolved
}

/** Weights record → normalized fraction vector in ASSET_CLASS_IDS order. */
export function weightsToVector(weights: AllocationWeights): number[] {
  const raw = ASSET_CLASS_IDS.map((id) => Math.max(0, weights[id]))
  const total = raw.reduce((a, b) => a + b, 0)
  if (total <= 0) return ASSET_CLASS_IDS.map((id) => (id === 'cash' ? 1 : 0))
  return raw.map((w) => w / total)
}

function lerpVectors(a: number[], b: number[], t: number): number[] {
  const mixed = a.map((v, i) => v + (b[i]! - v) * t)
  const total = mixed.reduce((x, y) => x + y, 0)
  return total > 0 ? mixed.map((v) => v / total) : mixed
}

/**
 * Compile a glidepath policy to this year's target weights (normalized
 * fractions in ASSET_CLASS_IDS order). Linear interpolates between its
 * endpoints and clamps outside them; staged is a step function holding each
 * stage from its fromYear; custom interpolates between year targets and
 * clamps outside the first/last target.
 */
export function targetWeightsAt(policy: AssetAllocationPolicy, year: number): number[] {
  switch (policy.mode) {
    case 'static':
      return weightsToVector(policy.weights)
    case 'linear': {
      const from = weightsToVector(policy.from)
      const to = weightsToVector(policy.to)
      if (year <= policy.startYear || policy.endYear <= policy.startYear) return from
      if (year >= policy.endYear) return to
      return lerpVectors(from, to, (year - policy.startYear) / (policy.endYear - policy.startYear))
    }
    case 'staged': {
      const stages = [...policy.stages].sort((a, b) => a.fromYear - b.fromYear)
      let current = stages[0]!
      for (const stage of stages) {
        if (stage.fromYear <= year) current = stage
      }
      return weightsToVector(current.weights)
    }
    case 'custom': {
      const targets = [...policy.targets].sort((a, b) => a.year - b.year)
      if (year <= targets[0]!.year) return weightsToVector(targets[0]!.weights)
      const last = targets[targets.length - 1]!
      if (year >= last.year) return weightsToVector(last.weights)
      for (let i = 0; i < targets.length - 1; i++) {
        const lo = targets[i]!
        const hi = targets[i + 1]!
        if (year >= lo.year && year <= hi.year) {
          const t = (year - lo.year) / (hi.year - lo.year)
          return lerpVectors(weightsToVector(lo.weights), weightsToVector(hi.weights), t)
        }
      }
      return weightsToVector(last.weights)
    }
  }
}

/** Blended expected nominal return for a weight vector, percent. */
export function blendedReturnPct(weights: number[], params: Record<AssetClassId, AssetClassParams>): number {
  return ASSET_CLASS_IDS.reduce((sum, id, i) => sum + (weights[i] ?? 0) * params[id].returnPct, 0)
}

export interface BlendedTaxableYield {
  interestYieldPct: number
  dividendYieldPct: number
  /** Dividend-weighted qualified share, 0–1 (0.85 fallback when no dividends). */
  qualifiedRatio: number
}

/** Class yields blended by weight — feeds the shipped taxable-drag fields. */
export function blendedTaxableYield(
  weights: number[],
  params: Record<AssetClassId, AssetClassParams>,
): BlendedTaxableYield {
  let interest = 0
  let dividends = 0
  let qualified = 0
  ASSET_CLASS_IDS.forEach((id, i) => {
    const w = weights[i] ?? 0
    interest += w * params[id].interestYieldPct
    dividends += w * params[id].dividendYieldPct
    qualified += w * params[id].dividendYieldPct * (params[id].qualifiedRatioPct / 100)
  })
  return {
    interestYieldPct: interest,
    dividendYieldPct: dividends,
    qualifiedRatio: dividends > 0 ? qualified / dividends : 0.85,
  }
}

/**
 * Weights after one year in which class i returned ratesPct[i] percent (no
 * rebalance). Total-return drift: distributions are treated as reinvested
 * pro-rata for weight purposes, a planning-grade simplification.
 */
export function driftWeights(weights: number[], ratesPct: number[]): number[] {
  const grown = weights.map((w, i) => w * Math.max(0, 1 + (ratesPct[i] ?? 0) / 100))
  const total = grown.reduce((a, b) => a + b, 0)
  return total > 0 ? grown.map((v) => v / total) : weights
}

/** Fraction of the account sold to move current → target (Σ overweight). */
export function rebalanceTurnoverFraction(current: number[], target: number[]): number {
  let turnover = 0
  for (let i = 0; i < current.length; i++) {
    turnover += Math.max(0, (current[i] ?? 0) - (target[i] ?? 0))
  }
  return turnover
}

/** Non-cash share of a weight vector (the market-shocked portion under the single-factor model). */
export function nonCashWeight(weights: number[]): number {
  const cashIndex = ASSET_CLASS_IDS.indexOf('cash')
  return Math.max(0, 1 - (weights[cashIndex] ?? 0))
}

type AllocatableAccount = Extract<Account, { type: 'taxable' | 'traditional' | 'roth' | 'hsa' }>

/** The account's allocation policy, when its type supports one and it is set. */
export function accountAllocation(account: Account): AssetAllocationPolicy | undefined {
  if (
    account.type === 'taxable' ||
    account.type === 'traditional' ||
    account.type === 'roth' ||
    account.type === 'hsa'
  ) {
    return (account as AllocatableAccount).allocation
  }
  return undefined
}

/** Whether any account opts into class-level allocation (gates MC class shocks). */
export function planUsesAssetAllocation(plan: Plan): boolean {
  return plan.accounts.some((a) => accountAllocation(a) !== undefined)
}

/**
 * Expected nominal return for an account this year: the allocation blend when
 * the account opts in (its explicit annualReturnPct is superseded), else the
 * account's own return, else the plan default.
 */
export function expectedAccountReturnPct(account: Account, assumptions: Assumptions, year: number): number {
  const policy = accountAllocation(account)
  if (policy) {
    return blendedReturnPct(targetWeightsAt(policy, year), resolveAssetClassParams(assumptions.assetClassParams))
  }
  const own = 'annualReturnPct' in account ? account.annualReturnPct : null
  return own ?? assumptions.defaultReturnPct
}

/**
 * Cholesky factor L (lower-triangular, LLᵀ = matrix) for correlated class
 * draws. For non-positive-definite input the diagonal term is clamped to a
 * small epsilon (1e-12) rather than failing, so the factorization always
 * returns (defensive: the shipped default matrix is PD).
 */
export function choleskyDecompose(matrix: readonly (readonly number[])[]): number[][] {
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
