/**
 * Background Monte Carlo success rate for headline surfaces (the KPI bar and
 * the Results verdict). Runs the MC page's exact default configuration — same
 * seed, model, and path count — so headline numbers always match what the
 * Monte Carlo page shows on arrival. Debounced well past the autosave window;
 * failures stay silent here (the MC page owns the full error/retry surface).
 *
 * Concurrent subscribers share one run per plan object via the in-flight map,
 * so the KPI bar and the verdict never trigger two identical 1,000-path
 * simulations for the same plan.
 *
 * Every run the Monte Carlo page completes under the headline configuration
 * (Run 10,000 paths included) is published here, and every headline surface
 * adopts the latest one — one run, one count, everywhere it is quoted (#497).
 * The Monte Carlo page reads the same store on mount, so it shows the
 * published run instead of starting a fresh default one, and the two can
 * never disagree. A run under a different model, seed, or shock is a
 * different simulation and stays on the Monte Carlo page.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { MonteCarloRateRun } from '@retiregolden/engine/decisions'
import type { Plan } from '@retiregolden/engine/model/plan'
import {
  HEADLINE_MONTE_CARLO_RETURN_VOL_PCT,
  headlineMonteCarloOptions,
} from '@retiregolden/engine/montecarlo/headline'
import { DEFAULT_MONTE_CARLO_SEED } from '@retiregolden/engine/montecarlo/rng'
import type { MonteCarloSummary } from '@retiregolden/engine/montecarlo/run'
import { DEFAULT_PATH_COUNT, runMonteCarlo, type MonteCarloRunOptions } from '../mc/pool'
import { WorkerUnavailableError } from '../workers/spawn'
import type { ModelKind } from './marketModelPicker'
import { currentStartYear } from './useProjection'

const MC_DEBOUNCE_MS = 1200

/**
 * The model settings the headline run uses, as the Monte Carlo page's
 * controls name them: the engine's headline lognormal model
 * (`headlineMonteCarloOptions`, its return volatility included). The page
 * initialises its controls from this constant, so the publish predicate below
 * compares like with like. The equity weight is read only by the historical
 * models; the lognormal ignores it.
 */
export const HEADLINE_MC_MODEL = {
  kind: 'lognormal' as ModelKind,
  returnVolPct: HEADLINE_MONTE_CARLO_RETURN_VOL_PCT,
  equityWeightPct: 60,
} as const

export interface McHeadlineConfig {
  modelKind: ModelKind
  returnVolPct: number
  equityWeightPct: number
  seed: number
  stochasticLongevity: boolean
  ltcShock: boolean
}

/**
 * True when a Monte Carlo page run is the headline simulation (only the path
 * count may differ): the headline model on the engine's default seed, which
 * every plan shares (decision D-MC-DEFAULT-SEED, 2026-09-28). A re-rolled seed
 * is a different simulation and stays on the Monte Carlo page.
 */
export function isHeadlineMcConfig(config: McHeadlineConfig): boolean {
  return (
    config.modelKind === HEADLINE_MC_MODEL.kind &&
    config.returnVolPct === HEADLINE_MC_MODEL.returnVolPct &&
    config.equityWeightPct === HEADLINE_MC_MODEL.equityWeightPct &&
    config.seed === DEFAULT_MONTE_CARLO_SEED &&
    !config.stochasticLongevity &&
    !config.ltcShock
  )
}

/** What an in-flight run resolves to: the rate, the path count it came from, and the year its paths start. */
interface McRunResult {
  rate: number
  pathCount: number
  startYear: number
}

const inflight = new WeakMap<Plan, Promise<McRunResult>>()
// The size of a Monte Carlo page run registered for a plan object, so busy
// copy can name the run actually in flight (10,000, not the default) before
// it resolves. Keyed like the maps above, so it dies with the plan object.
const pendingPathCount = new WeakMap<Plan, number>()
// The latest completed headline-configuration run per plan object, keyed
// like the in-flight map: an edit produces a new plan object, so a published
// run can never outlive its plan.
const published = new WeakMap<Plan, MonteCarloSummary>()
// The start year each published run's paths begin in. A plan object outlives
// a New Year when it is not edited, so a published run can be from an earlier
// start year than the clock's; whatever is compared with it must run from the
// same year (PR #754 findings 1 and 2).
const publishedStartYear = new WeakMap<Plan, number>()
const listeners = new Set<() => void>()

/**
 * Adopt a completed headline-configuration run, simulated from `startYear`,
 * for every subscriber of this plan object. Precision is never traded away: a
 * coarser later run from the same start year does not replace a finer one (a
 * run from another start year is a different simulation and replaces it). The
 * Monte Carlo page shows the published run whenever one exists under this
 * configuration, so the store and the page agree.
 */
export function publishMcHeadline(plan: Plan, summary: MonteCarloSummary, startYear: number): void {
  const current = published.get(plan)
  if (current !== undefined && publishedStartYear.get(plan) === startYear && current.pathCount > summary.pathCount) return
  published.set(plan, summary)
  publishedStartYear.set(plan, startYear)
  for (const listener of listeners) listener()
}

/** The latest published headline run for this plan object, if any (non-reactive read; components use `useMcHeadline`). */
export function publishedMcSummary(plan: Plan): MonteCarloSummary | undefined {
  return published.get(plan)
}

/**
 * Share a Monte Carlo page run with the headline hook: while it is in flight
 * the KPI bar attaches to it instead of launching a second simulation of the
 * same configuration. A run already in flight for this plan object is kept.
 */
export function registerMcHeadlineRun(
  plan: Plan,
  run: Promise<MonteCarloSummary>,
  pathCount: number,
  startYear: number,
): void {
  if (inflight.get(plan) !== undefined) return
  const result = run.then((s) => ({ rate: s.successRate, pathCount: s.pathCount, startYear }))
  result.catch(() => {
    inflight.delete(plan)
  })
  inflight.set(plan, result)
  pendingPathCount.set(plan, pathCount)
  for (const listener of listeners) listener()
}

/** The path count of the run registered for this plan object, if any (a subscription). */
export function useInFlightMcPathCount(plan: Plan): number | undefined {
  const snapshot = () => pendingPathCount.get(plan)
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * The published headline run for this plan object, as a subscription: any
 * publisher, not only the Monte Carlo page's own run, re-renders the reader.
 * The store hands back the same object until the next publish, so this never
 * re-renders on its own.
 */
export function useMcHeadline(plan: Plan): MonteCarloSummary | undefined {
  // The same snapshot serves a server render: the store is an in-memory map
  // that is empty there, so client and server agree on what it holds.
  const snapshot = () => published.get(plan)
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/**
 * The headline configuration's run options for a plan, as the engine
 * publishes them for every host (`headlineMonteCarloOptions`): the headline
 * model built from this plan (its inflation mean, 12 percent return
 * volatility, and per-class shocks when it holds allocated accounts), the
 * engine's default seed, the given start year (the clock's by default), and
 * the given path count. A comparison run for a changed plan passes the base
 * plan and the base run's path count and start year here, so both runs see
 * one market.
 */
export function headlineMcRunOptions(
  plan: Plan,
  pathCount: number = DEFAULT_PATH_COUNT,
  startYear: number = currentStartYear(),
): MonteCarloRunOptions {
  const options = headlineMonteCarloOptions(plan, startYear, pathCount)
  return { startYear: options.startYear, pathCount: options.pathCount, seed: options.seed, model: options.model }
}

/**
 * The headline run for this plan object, the one whose rate the KPI bar
 * shows: the published run when there is one (a 10,000-path Monte Carlo page
 * run included), else the run in flight, else a new default run, shared with
 * the KPI bar through the in-flight map. What an Insight preview compares a
 * changed plan against, so its "before" is the rate the reader was shown. It
 * carries the start year its paths begin in, which can be earlier than the
 * clock's when the plan object outlived a New Year; the preview runs the
 * changed plan from that same year.
 */
export function headlineMcRun(plan: Plan): Promise<MonteCarloRateRun> {
  const summary = published.get(plan)
  const startYear = publishedStartYear.get(plan)
  if (summary !== undefined && startYear !== undefined) {
    return Promise.resolve({ successRate: summary.successRate, pathCount: summary.pathCount, startYear })
  }
  return successRateOf(plan).then((result) => ({
    successRate: result.rate,
    pathCount: result.pathCount,
    startYear: result.startYear,
  }))
}

function successRateOf(plan: Plan): Promise<McRunResult> {
  const existing = inflight.get(plan)
  if (existing !== undefined) return existing
  const options = headlineMcRunOptions(plan)
  const run = runMonteCarlo(plan, options).then((s) => ({
    rate: s.successRate,
    pathCount: s.pathCount,
    startYear: options.startYear,
  }))
  // Successful runs stay cached (later subscribers reuse the result), but a
  // rejection is evicted so the next subscriber retries instead of replaying
  // a transient worker failure forever for this plan object.
  run.catch(() => {
    inflight.delete(plan)
  })
  inflight.set(plan, run)
  return run
}

export type McSuccessRateStatus = 'idle' | 'running' | 'done' | 'failed'

export interface McSuccessRateState {
  rate: number | null
  status: McSuccessRateStatus
  /** How many market paths `rate` came from; the default count while none has finished. */
  pathCount: number
  /**
   * With `status: 'failed'`, the plain reason when running again cannot help
   * (this runtime has no Web Worker, ../workers/spawn.ts); otherwise null.
   */
  failureReason: string | null
}

/**
 * The headline rate plus what the simulation is doing, so a KPI can say
 * "simulating" only while a run is live and "unavailable" after one fails
 * (the Monte Carlo page carries the error detail and retry).
 */
export function useMcSuccessRateState(plan: Plan, enabled: boolean): McSuccessRateState {
  // The rate is stored WITH the plan it was computed for, and derived to null
  // whenever the current plan differs — so a headline number can never show a
  // previous plan's rate through the debounce + recompute, and a silently
  // failed re-run can never leave a stale rate up (edits produce a new plan
  // object via structuredClone, so reference identity is the right key).
  const [snapshot, setSnapshot] = useState<{
    plan: Plan
    rate: number | null
    pathCount: number
    failed: boolean
    failureReason: string | null
  } | null>(null)
  const runToken = useRef(0)
  // A run the Monte Carlo page published for this exact plan object wins over
  // the hook's own default run.
  const headline = useMcHeadline(plan)
  // While a page run is in flight the busy copy names its size, not the default.
  const inFlightPathCount = useInFlightMcPathCount(plan)
  useEffect(() => {
    if (!enabled) return undefined
    // A published run already answers for this plan object: starting the
    // default simulation would only burn the pool for a result the headline
    // branch below discards.
    if (headline !== undefined) return undefined
    const token = ++runToken.current
    const attach = () => {
      successRateOf(plan)
        .then((result) => {
          // The count rides with the rate: an attached 10,000-path page run is
          // reported as 10,000, not as the default.
          if (token === runToken.current) {
            setSnapshot({ plan, rate: result.rate, pathCount: result.pathCount, failed: false, failureReason: null })
          }
        })
        .catch((error: unknown) => {
          // The Monte Carlo page carries the error detail and retry; here the
          // KPI only needs to stop claiming a simulation is in progress, and to
          // say why when retrying cannot help (no Web Worker).
          if (token === runToken.current) {
            const failureReason = error instanceof WorkerUnavailableError ? error.message : null
            setSnapshot({ plan, rate: null, pathCount: DEFAULT_PATH_COUNT, failed: true, failureReason })
          }
        })
    }
    // A run for this plan already exists (typically started by the KPI bar):
    // attach immediately. The debounce only guards against launching fresh
    // simulations mid-edit, and attaching to an existing run starts none.
    if (inflight.get(plan) !== undefined) {
      attach()
      return undefined
    }
    const t = window.setTimeout(attach, MC_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(t)
    }
  }, [plan, enabled, headline])
  if (enabled && headline !== undefined) {
    return { rate: headline.successRate, status: 'done', pathCount: headline.pathCount, failureReason: null }
  }
  const current = enabled && snapshot !== null && snapshot.plan === plan ? snapshot : null
  const status: McSuccessRateStatus = !enabled ? 'idle' : current === null ? 'running' : current.failed ? 'failed' : 'done'
  return {
    rate: current?.rate ?? null,
    status,
    pathCount: current?.pathCount ?? inFlightPathCount ?? DEFAULT_PATH_COUNT,
    failureReason: status === 'failed' ? (current?.failureReason ?? null) : null,
  }
}
