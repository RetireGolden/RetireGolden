/**
 * Market-model picker wiring: the plain-language presets shown up front, the
 * full advanced catalog behind the disclosure, the mapping from a picked
 * kind to a MarketModelConfig, and the one slider the page shows for that
 * kind. Pure UI-level mapping: a given (kind, seed) pair always produces the
 * same Monte Carlo results. The GARCH config names its volatility
 * `returnVolPct` like every sibling model (it was `returnVolScalePct` until
 * the engine's GARCH fix of 2026-09-26, which also changed what the value
 * means: now the long-run standard deviation of the return shock).
 */

import { planUsesAssetAllocation, resolveAssetClassParams } from '@retiregolden/engine/allocation/assetClasses'
import { ASSET_CLASS_IDS, type AssetClassId } from '@retiregolden/engine/model/plan'
import type { Plan } from '@retiregolden/engine/model/plan'
import { buildLognormalModelConfigForPlan, type ClassShockConfig, type MarketModelConfig } from '@retiregolden/engine/montecarlo/marketModels'

export type ModelKind =
  | 'lognormal'
  | 'hist-iid'
  | 'hist-block'
  | 'hist-sequence'
  | 'student-t'
  | 'regime-switch'
  | 'cape-conditioned'
  | 'stationary'
  | 'empirical'
  | 'garch'
  | 'inflation-regime'
  | 'reversed-history'
  | 'user-shock'
  | 'gaussian'
  | 'ar1'

export type ModelPresetId = 'smooth' | 'history' | 'stress'

export interface ModelPreset {
  id: ModelPresetId
  label: string
  description: string
  kind: ModelKind
}

/** The three plain-language choices shown before the advanced disclosure. */
export const MODEL_PRESETS: ReadonlyArray<ModelPreset> = [
  {
    id: 'smooth',
    label: 'Smooth randomness (default)',
    description: 'Each year varies around your expected return, like a bell curve.',
    kind: 'lognormal',
  },
  {
    id: 'history',
    label: 'Replay real history',
    description: 'Your retirement starts in a random past year and history unfolds from there.',
    kind: 'hist-sequence',
  },
  {
    id: 'stress',
    label: 'Stress test',
    description: 'A 25% market drop hits in year one, then markets vary normally.',
    kind: 'user-shock',
  },
]

export const PRESET_FAMILY_LABELS: Record<ModelPresetId, string> = {
  smooth: 'Smooth randomness',
  history: 'Replay real history',
  stress: 'Stress test',
}

/** The full advanced catalog. Every kind the old flat <select> offered stays reachable. */
export const MODEL_CATALOG: ReadonlyArray<{ kind: ModelKind; label: string; family: ModelPresetId }> = [
  { kind: 'lognormal', label: 'Lognormal (correlated inflation)', family: 'smooth' },
  { kind: 'hist-iid', label: 'Historical bootstrap: independent years', family: 'history' },
  { kind: 'hist-block', label: 'Historical bootstrap: 5-year blocks', family: 'history' },
  { kind: 'hist-sequence', label: 'Historical full-sequence replay', family: 'history' },
  { kind: 'student-t', label: 'Student-t (fat tails)', family: 'smooth' },
  { kind: 'regime-switch', label: 'Regime-switching (bull/bear Markov)', family: 'smooth' },
  { kind: 'cape-conditioned', label: 'CAPE-conditioned mean reversion', family: 'smooth' },
  { kind: 'stationary', label: 'Stationary bootstrap (variable blocks)', family: 'history' },
  { kind: 'empirical', label: 'Empirical historical (mean-preserving)', family: 'history' },
  { kind: 'garch', label: 'GARCH(1,1) vol clustering', family: 'smooth' },
  { kind: 'inflation-regime', label: 'Inflation regime (fat/high-infl)', family: 'smooth' },
  { kind: 'reversed-history', label: 'Reversed-history windows', family: 'stress' },
  { kind: 'user-shock', label: 'User shock scenario (year-1 crash)', family: 'stress' },
  { kind: 'gaussian', label: 'Gaussian (additive normal)', family: 'smooth' },
  { kind: 'ar1', label: 'AR(1) mean-reverting shocks', family: 'smooth' },
]

export function presetFamilyOf(kind: ModelKind): ModelPresetId {
  return MODEL_CATALOG.find((entry) => entry.kind === kind)?.family ?? 'smooth'
}

export function catalogLabelOf(kind: ModelKind): string {
  return MODEL_CATALOG.find((entry) => entry.kind === kind)?.label ?? kind
}

/**
 * The one model-specific slider the Monte Carlo page shows beside a kind:
 * 'return-volatility' for the kinds whose config buildModel fills from
 * returnVolPct (user-shock as baseReturnVolPct), 'equity-weight' for the kinds
 * it fills from equityWeightPct, and null for the kinds it passes neither, so
 * the page never offers a control the chosen model ignores.
 */
export type ModelControl = 'return-volatility' | 'equity-weight' | null

export function modelControlOf(kind: ModelKind): ModelControl {
  switch (kind) {
    case 'lognormal':
    case 'student-t':
    case 'garch':
    case 'gaussian':
    case 'ar1':
    case 'cape-conditioned':
    case 'user-shock':
      return 'return-volatility'
    case 'hist-iid':
    case 'hist-block':
    case 'hist-sequence':
    case 'stationary':
    case 'empirical':
    case 'reversed-history':
      return 'equity-weight'
    case 'regime-switch':
    case 'inflation-regime':
      return null
    default: {
      // A new ModelKind fails to compile here until it is mapped above.
      const unmapped: never = kind
      throw new Error(`No Monte Carlo control is mapped for model kind ${String(unmapped)}`)
    }
  }
}

function buildClassShocks(plan: Plan): ClassShockConfig | undefined {
  if (!planUsesAssetAllocation(plan)) return undefined
  const params = resolveAssetClassParams(plan.assumptions.assetClassParams)
  const volatilityPctByClass = Object.fromEntries(
    ASSET_CLASS_IDS.map((id) => [id, params[id].volatilityPct]),
  ) as Record<AssetClassId, number>
  return { volatilityPctByClass }
}

export function buildModel(
  kind: ModelKind,
  inflationMeanPct: number,
  returnVolPct: number,
  equityWeightPct: number,
  plan: Plan,
): MarketModelConfig {
  // Plans with allocated accounts get per-class correlated shocks sharing the
  // deterministic ledger's allocation schema; single-return plans keep the
  // single-factor model (and their exact seeded paths) unchanged.
  const classShocks = buildClassShocks(plan)
  if (kind === 'lognormal') {
    return {
      ...buildLognormalModelConfigForPlan(plan, returnVolPct),
      inflationMeanPct,
    }
  }
  if (kind === 'hist-iid' || kind === 'hist-block' || kind === 'hist-sequence') {
    return {
      type: 'historical',
      mode: kind === 'hist-iid' ? 'iid' : kind === 'hist-block' ? 'block' : 'sequence',
      equityWeightPct,
      classShocks: !!classShocks,
    }
  }
  if (kind === 'student-t') {
    return { type: 'student-t', inflationMeanPct, returnVolPct, classShocks }
  }
  if (kind === 'regime-switch') {
    return { type: 'regime-switch', inflationMeanPct, classShocks }
  }
  if (kind === 'cape-conditioned') {
    return { type: 'cape-conditioned', inflationMeanPct, returnVolPct, startingCape: 28, classShocks }
  }
  if (kind === 'stationary') {
    return { type: 'stationary', equityWeightPct, classShocks: !!classShocks }
  }
  if (kind === 'empirical') {
    // Default to centered (mean-preserving) for correctness. Non-centered (raw historical
    // as shock) can overstate results because simulate always does expected + shock.
    // Non-centered kept in config for advanced/experimental use.
    return { type: 'empirical', equityWeightPct, centered: true, classShocks: !!classShocks }
  }
  if (kind === 'garch') {
    return { type: 'garch', inflationMeanPct, returnVolPct, classShocks }
  }
  if (kind === 'inflation-regime') {
    return { type: 'inflation-regime', baseInflationMeanPct: inflationMeanPct, classShocks }
  }
  if (kind === 'reversed-history') {
    return { type: 'reversed-history', equityWeightPct, windowLengthYears: 10, classShocks: !!classShocks }
  }
  if (kind === 'user-shock') {
    return { type: 'user-shock', inflationMeanPct, shockYear: 1, shockPct: -25, baseReturnVolPct: returnVolPct, classShocks }
  }
  if (kind === 'gaussian') {
    return { type: 'gaussian', inflationMeanPct, returnVolPct, classShocks }
  }
  if (kind === 'ar1') {
    return { type: 'ar1', inflationMeanPct, returnVolPct, phi: 0.3, classShocks }
  }
  // fallback
  return {
    type: 'historical',
    mode: 'iid',
    equityWeightPct,
    classShocks: !!classShocks,
  }
}
