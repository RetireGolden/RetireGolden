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

import type { Plan } from '@retiregolden/engine/model/plan'
import type { MonteCarloSummary } from '@retiregolden/engine/montecarlo/run'
import { DEFAULT_PATH_COUNT, runMonteCarlo } from '../mc/pool'
import { buildModel, type ModelKind } from './marketModelPicker'
import { currentStartYear, seedFromPlanId } from './useProjection'

const MC_DEBOUNCE_MS = 1200

/**
 * The model settings the headline run uses. The Monte Carlo page initialises
 * its controls from this same constant, so the publish predicate below
 * compares like with like.
 */
export const HEADLINE_MC_MODEL = { kind: 'lognormal' as ModelKind, returnVolPct: 12, equityWeightPct: 60 } as const

export interface McHeadlineConfig {
  modelKind: ModelKind
  returnVolPct: number
  equityWeightPct: number
  seed: number
  stochasticLongevity: boolean
  ltcShock: boolean
}

/** True when a Monte Carlo page run is the headline simulation (only the path count may differ). */
export function isHeadlineMcConfig(plan: Plan, config: McHeadlineConfig): boolean {
  return (
    config.modelKind === HEADLINE_MC_MODEL.kind &&
    config.returnVolPct === HEADLINE_MC_MODEL.returnVolPct &&
    config.equityWeightPct === HEADLINE_MC_MODEL.equityWeightPct &&
    config.seed === seedFromPlanId(plan.id) &&
    !config.stochasticLongevity &&
    !config.ltcShock
  )
}

/** What an in-flight run resolves to: the rate and the path count it came from. */
interface McRunResult {
  rate: number
  pathCount: number
}

const inflight = new WeakMap<Plan, Promise<McRunResult>>()
// The latest completed headline-configuration run per plan object, keyed
// like the in-flight map: an edit produces a new plan object, so a published
// run can never outlive its plan.
const published = new WeakMap<Plan, MonteCarloSummary>()
const listeners = new Set<() => void>()

/**
 * Adopt a completed headline-configuration run for every subscriber of this
 * plan object. Precision is never traded away: a coarser later run does not
 * replace a finer one. The Monte Carlo page shows the published run whenever
 * one exists under this configuration, so the store and the page agree.
 */
export function publishMcHeadline(plan: Plan, summary: MonteCarloSummary): void {
  const current = published.get(plan)
  if (current !== undefined && current.pathCount > summary.pathCount) return
  published.set(plan, summary)
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
export function registerMcHeadlineRun(plan: Plan, run: Promise<MonteCarloSummary>): void {
  if (inflight.get(plan) !== undefined) return
  const result = run.then((s) => ({ rate: s.successRate, pathCount: s.pathCount }))
  result.catch(() => {
    inflight.delete(plan)
  })
  inflight.set(plan, result)
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

function successRateOf(plan: Plan): Promise<McRunResult> {
  const existing = inflight.get(plan)
  if (existing !== undefined) return existing
  const model = buildModel(
    HEADLINE_MC_MODEL.kind,
    plan.assumptions.inflationPct,
    HEADLINE_MC_MODEL.returnVolPct,
    HEADLINE_MC_MODEL.equityWeightPct,
    plan,
  )
  const run = runMonteCarlo(plan, {
    startYear: currentStartYear(),
    pathCount: DEFAULT_PATH_COUNT,
    seed: seedFromPlanId(plan.id),
    model,
  }).then((s) => ({ rate: s.successRate, pathCount: s.pathCount }))
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
  const [snapshot, setSnapshot] = useState<{ plan: Plan; rate: number | null; pathCount: number; failed: boolean } | null>(null)
  const runToken = useRef(0)
  // A run the Monte Carlo page published for this exact plan object wins over
  // the hook's own default run.
  const headline = useMcHeadline(plan)
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
          if (token === runToken.current) setSnapshot({ plan, rate: result.rate, pathCount: result.pathCount, failed: false })
        })
        .catch(() => {
          // The Monte Carlo page carries the error detail and retry; here the
          // KPI only needs to stop claiming a simulation is in progress.
          if (token === runToken.current) setSnapshot({ plan, rate: null, pathCount: DEFAULT_PATH_COUNT, failed: true })
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
  if (enabled && headline !== undefined) return { rate: headline.successRate, status: 'done', pathCount: headline.pathCount }
  const current = enabled && snapshot !== null && snapshot.plan === plan ? snapshot : null
  const status: McSuccessRateStatus = !enabled ? 'idle' : current === null ? 'running' : current.failed ? 'failed' : 'done'
  return { rate: current?.rate ?? null, status, pathCount: current?.pathCount ?? DEFAULT_PATH_COUNT }
}
