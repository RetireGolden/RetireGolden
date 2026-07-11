/**
 * Wire types between the Monte Carlo pool and its workers (roadmap V4).
 * Everything here must survive structured clone: plain objects, arrays, and
 * Float64Array only.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import type { AnnuitizationSweep } from '@retiregolden/engine/decisions/annuitization'
import type { StochasticFrontierPoint } from '@retiregolden/engine/montecarlo/frontiers'
import type { HistoricalStressSuiteKind } from '@retiregolden/engine/montecarlo/historicalSuites'
import type { LtcShockParams } from '@retiregolden/engine/montecarlo/ltcShock'
import type { MarketModelConfig } from '@retiregolden/engine/montecarlo/marketModels'
import type { RiskBasedGuardrailSolution } from '@retiregolden/engine/montecarlo/riskBasedGuardrails'
import type { MonteCarloPathsResult } from '@retiregolden/engine/montecarlo/run'

export interface McWorkerRequest {
  kind: 'monteCarlo'
  plan: Plan
  startYear: number
  seed: number
  model: MarketModelConfig
  pathCount: number
  /** Global index of this worker's first path (keeps seeding partition-independent). */
  firstPathIndex: number
  /** Post a progress message every N completed paths. */
  progressEvery: number
  /** Sample lifespans from the mortality table per path (roadmap V6). */
  stochasticLongevity?: boolean
  /** Probabilistic LTC care episode per path (roadmap V6); omitted/null = off. */
  ltcShock?: LtcShockParams | null
}

export interface FrontierWorkerRequest {
  kind: 'frontiers'
  plan: Plan
  startYear: number
  seed: number
  model: MarketModelConfig
  pathCount: number
  stochasticLongevity?: boolean
  ltcShock?: LtcShockParams | null
}

export interface FrontierWorkerResult {
  spending: StochasticFrontierPoint[]
  retirement: StochasticFrontierPoint[]
  /** Annuitization sweep (annuity-pension-and-home-equity, step 2). */
  annuitization: AnnuitizationSweep
}

export interface RiskBasedWorkerRequest {
  kind: 'riskBasedGuardrails'
  plan: Plan
  startYear: number
  seed: number
  model: MarketModelConfig
  pathCount: number
  stochasticLongevity?: boolean
  ltcShock?: LtcShockParams | null
}

export interface HistoricalWorkerRequest {
  kind: 'historicalSuites'
  plan: Plan
  startYear: number
  equityWeightPct: number
  classShocks?: boolean
  worstWindowCount?: number
}

export interface HistoricalStressWindowView {
  suite: HistoricalStressSuiteKind
  label: string
  startHistoricalYear: number
  endHistoricalYear: number
  reversed: boolean
  success: boolean
  projection: { depletionYear: number | null }
  summary: { endingAfterTaxEstate: number }
  totalShortfall: number
  totalRequiredShortfall: number
  totalTargetShortfall: number
}

export interface HistoricalStressSuiteView {
  kind: HistoricalStressSuiteKind
  name: string
  windowLengthYears: number
  worstByEndingAfterTaxEstate: HistoricalStressWindowView[]
  worstByTotalShortfall: HistoricalStressWindowView[]
}

export interface HistoricalStressSuiteViewResult {
  windowLengthYears: number
  suites: HistoricalStressSuiteView[]
}

export type WorkerRequest = McWorkerRequest | FrontierWorkerRequest | HistoricalWorkerRequest | RiskBasedWorkerRequest

export type McWorkerResponse =
  | { type: 'progress'; completed: number }
  | { type: 'done'; result: MonteCarloPathsResult }
  | { type: 'error'; message: string }

export type FrontierWorkerResponse =
  | { type: 'frontiersDone'; result: FrontierWorkerResult }
  | { type: 'error'; message: string }

export type HistoricalWorkerResponse =
  | { type: 'historicalSuitesDone'; result: HistoricalStressSuiteViewResult }
  | { type: 'error'; message: string }

export type RiskBasedWorkerResponse =
  | { type: 'progress'; completed: number }
  | { type: 'riskBasedDone'; result: RiskBasedGuardrailSolution }
  | { type: 'error'; message: string }

export type WorkerResponse = McWorkerResponse | FrontierWorkerResponse | HistoricalWorkerResponse | RiskBasedWorkerResponse
