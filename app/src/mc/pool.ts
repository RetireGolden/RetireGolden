/**
 * Worker-pool Monte Carlo runner (roadmap V4, feature catalog §11).
 *
 * Splits the requested paths across a pool of Web Workers (one per core by
 * default, capped at 8) and merges the results. Per-path seeds derive from
 * (seed, globalPathIndex) inside the engine, so the outcome is identical for
 * any worker count — including the synchronous fallback used where Worker is
 * unavailable (tests, very old browsers).
 */

import type { Plan } from '../engine/model/plan'
import type { LtcShockParams } from '../engine/montecarlo/ltcShock'
import type { MarketModelConfig } from '../engine/montecarlo/marketModels'
import {
  aggregateMonteCarlo,
  mergePathResults,
  type MonteCarloPathsResult,
  type MonteCarloSummary,
} from '../engine/montecarlo/run'
import type { RiskBasedGuardrailSolution } from '../engine/montecarlo/riskBasedGuardrails'
import type {
  FrontierWorkerRequest,
  FrontierWorkerResponse,
  FrontierWorkerResult,
  HistoricalStressSuiteViewResult,
  HistoricalWorkerRequest,
  HistoricalWorkerResponse,
  McWorkerRequest,
  McWorkerResponse,
  RiskBasedWorkerRequest,
  RiskBasedWorkerResponse,
} from './messages'
import {
  runFrontierRequest,
  runHistoricalStressSuiteRequest,
  runMcRequest,
  runRiskBasedGuardrailRequest,
} from './runRequest'
import { runWorkerRequest } from '../workers/run'

export interface MonteCarloRunOptions {
  startYear: number
  /** 1,000 default; 10,000 on demand. */
  pathCount: number
  seed: number
  model: MarketModelConfig
  /** Default: hardwareConcurrency − 1, clamped to [1, 8]. */
  workerCount?: number
  /** Sample lifespans from the mortality table per path (roadmap V6). */
  stochasticLongevity?: boolean
  /** Probabilistic LTC care episode per path (roadmap V6); omitted/null = off. */
  ltcShock?: LtcShockParams | null
  onProgress?: (completedPaths: number, totalPaths: number) => void
}

export const DEFAULT_PATH_COUNT = 1000
export const ON_DEMAND_PATH_COUNT = 10_000

function defaultWorkerCount(): number {
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4
  return Math.max(1, Math.min(8, cores - 1))
}

function makeRequest(plan: Plan, opts: MonteCarloRunOptions, firstPathIndex: number, pathCount: number): McWorkerRequest {
  return {
    kind: 'monteCarlo',
    plan,
    startYear: opts.startYear,
    seed: opts.seed,
    model: opts.model,
    pathCount,
    firstPathIndex,
    progressEvery: Math.max(1, Math.floor(opts.pathCount / 100)),
    stochasticLongevity: opts.stochasticLongevity,
    ltcShock: opts.ltcShock,
  }
}

export interface StochasticFrontierRunOptions {
  startYear: number
  pathCount: number
  seed: number
  model: MarketModelConfig
  stochasticLongevity?: boolean
  ltcShock?: LtcShockParams | null
}

export interface HistoricalStressSuiteRunOptions {
  startYear: number
  equityWeightPct: number
  classShocks?: boolean
  worstWindowCount?: number
}

export type { HistoricalStressSuiteViewResult } from './messages'

function runInWorker(
  req: McWorkerRequest,
  onProgress: (workerCompleted: number) => void,
  onSpawn?: (worker: Worker) => void,
): Promise<MonteCarloPathsResult> {
  return runWorkerRequest<McWorkerRequest, McWorkerResponse, MonteCarloPathsResult>({
    request: req,
    createWorker: () => new Worker(new URL('./monteCarlo.worker.ts', import.meta.url), { type: 'module' }),
    interpret: (msg) => {
      if (msg.type === 'progress') {
        onProgress(msg.completed)
        return { kind: 'progress' }
      }
      if (msg.type === 'done') return { kind: 'done', result: msg.result }
      return { kind: 'error', message: msg.message }
    },
    errorLabel: 'Monte Carlo worker failed',
    onSpawn,
  })
}

function runFrontiersInWorker(req: FrontierWorkerRequest): Promise<FrontierWorkerResult> {
  return runWorkerRequest<FrontierWorkerRequest, FrontierWorkerResponse, FrontierWorkerResult>({
    request: req,
    createWorker: () => new Worker(new URL('./monteCarlo.worker.ts', import.meta.url), { type: 'module' }),
    interpret: (msg) =>
      msg.type === 'frontiersDone' ? { kind: 'done', result: msg.result } : { kind: 'error', message: msg.message },
    errorLabel: 'Frontier worker failed',
  })
}

function runHistoricalSuitesInWorker(req: HistoricalWorkerRequest): Promise<HistoricalStressSuiteViewResult> {
  return runWorkerRequest<HistoricalWorkerRequest, HistoricalWorkerResponse, HistoricalStressSuiteViewResult>({
    request: req,
    createWorker: () => new Worker(new URL('./monteCarlo.worker.ts', import.meta.url), { type: 'module' }),
    interpret: (msg) =>
      msg.type === 'historicalSuitesDone'
        ? { kind: 'done', result: msg.result }
        : { kind: 'error', message: msg.message },
    errorLabel: 'Historical stress worker failed',
  })
}

/** Run the full Monte Carlo and aggregate it. Reproducible per (plan, seed, model). */
export async function runMonteCarlo(plan: Plan, opts: MonteCarloRunOptions): Promise<MonteCarloSummary> {
  const total = opts.pathCount
  if (typeof Worker === 'undefined') {
    const result = runMcRequest(makeRequest(plan, opts, 0, total), (completed) => opts.onProgress?.(completed, total))
    return aggregateMonteCarlo(result)
  }

  const workerCount = Math.max(1, Math.min(opts.workerCount ?? defaultWorkerCount(), total))
  const base = Math.floor(total / workerCount)
  const extra = total % workerCount
  const completedByWorker = new Array<number>(workerCount).fill(0)
  const reportProgress = () => {
    opts.onProgress?.(
      completedByWorker.reduce((a, b) => a + b, 0),
      total,
    )
  }

  const jobs: Promise<MonteCarloPathsResult>[] = []
  const liveWorkers: Worker[] = []
  let firstPathIndex = 0
  for (let w = 0; w < workerCount; w++) {
    const slice = base + (w < extra ? 1 : 0)
    const req = makeRequest(plan, opts, firstPathIndex, slice)
    firstPathIndex += slice
    const workerIndex = w
    jobs.push(
      runInWorker(
        req,
        (completed) => {
          completedByWorker[workerIndex] = completed
          reportProgress()
        },
        (worker) => liveWorkers.push(worker),
      ),
    )
  }
  let parts: MonteCarloPathsResult[]
  try {
    parts = await Promise.all(jobs)
  } catch (error) {
    // One job failed: stop the siblings instead of letting them burn CPU on a
    // run whose result will be discarded (terminate is a no-op once settled).
    for (const worker of liveWorkers) worker.terminate()
    // The killed siblings' promises still reject (their onerror fires after
    // terminate); swallow those so only this rethrow surfaces.
    for (const job of jobs) job.catch(() => {})
    throw error
  }
  opts.onProgress?.(total, total)
  return aggregateMonteCarlo(mergePathResults(parts))
}

export interface RiskBasedGuardrailRunOptions {
  startYear: number
  pathCount: number
  seed: number
  model: MarketModelConfig
  stochasticLongevity?: boolean
  ltcShock?: LtcShockParams | null
}

/**
 * Solve the risk-based guardrail thresholds (dollar balance levels matching the
 * plan's target success band) on a single worker. Deterministic per
 * (plan, seed, model, pathCount).
 */
export async function runRiskBasedGuardrailSolve(
  plan: Plan,
  opts: RiskBasedGuardrailRunOptions,
): Promise<RiskBasedGuardrailSolution> {
  const req: RiskBasedWorkerRequest = {
    kind: 'riskBasedGuardrails',
    plan,
    startYear: opts.startYear,
    seed: opts.seed,
    model: opts.model,
    pathCount: opts.pathCount,
    stochasticLongevity: opts.stochasticLongevity,
    ltcShock: opts.ltcShock,
  }
  if (typeof Worker === 'undefined') return runRiskBasedGuardrailRequest(req)
  return runWorkerRequest<RiskBasedWorkerRequest, RiskBasedWorkerResponse, RiskBasedGuardrailSolution>({
    request: req,
    createWorker: () => new Worker(new URL('./monteCarlo.worker.ts', import.meta.url), { type: 'module' }),
    interpret: (msg) => {
      if (msg.type === 'progress') return { kind: 'progress' }
      if (msg.type === 'riskBasedDone') return { kind: 'done', result: msg.result }
      return { kind: 'error', message: msg.message }
    },
    errorLabel: 'Risk-based guardrail solver failed',
  })
}

export async function runStochasticFrontiers(
  plan: Plan,
  opts: StochasticFrontierRunOptions,
): Promise<FrontierWorkerResult> {
  const req: FrontierWorkerRequest = {
    kind: 'frontiers',
    plan,
    startYear: opts.startYear,
    seed: opts.seed,
    model: opts.model,
    pathCount: opts.pathCount,
    stochasticLongevity: opts.stochasticLongevity,
    ltcShock: opts.ltcShock,
  }
  if (typeof Worker === 'undefined') return runFrontierRequest(req)
  return runFrontiersInWorker(req)
}

export async function runHistoricalStressSuiteViews(
  plan: Plan,
  opts: HistoricalStressSuiteRunOptions,
): Promise<HistoricalStressSuiteViewResult> {
  const req: HistoricalWorkerRequest = {
    kind: 'historicalSuites',
    plan,
    startYear: opts.startYear,
    equityWeightPct: opts.equityWeightPct,
    classShocks: opts.classShocks,
    worstWindowCount: opts.worstWindowCount,
  }
  if (typeof Worker === 'undefined') return runHistoricalStressSuiteRequest(req)
  return runHistoricalSuitesInWorker(req)
}
