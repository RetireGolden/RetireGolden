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
 */

import { useEffect, useRef, useState } from 'react'

import type { Plan } from '@retiregolden/engine/model/plan'
import { DEFAULT_PATH_COUNT, runMonteCarlo } from '../mc/pool'
import { buildModel } from './marketModelPicker'
import { currentStartYear, seedFromPlanId } from './useProjection'

const MC_DEBOUNCE_MS = 1200

const inflight = new WeakMap<Plan, Promise<number>>()

function successRateOf(plan: Plan): Promise<number> {
  const existing = inflight.get(plan)
  if (existing !== undefined) return existing
  const model = buildModel('lognormal', plan.assumptions.inflationPct, 12, 60, plan)
  const run = runMonteCarlo(plan, {
    startYear: currentStartYear(),
    pathCount: DEFAULT_PATH_COUNT,
    seed: seedFromPlanId(plan.id),
    model,
  }).then((s) => s.successRate)
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

/**
 * The headline rate plus what the simulation is doing, so a KPI can say
 * "simulating" only while a run is live and "unavailable" after one fails
 * (the Monte Carlo page carries the error detail and retry).
 */
export function useMcSuccessRateState(plan: Plan, enabled: boolean): { rate: number | null; status: McSuccessRateStatus } {
  // The rate is stored WITH the plan it was computed for, and derived to null
  // whenever the current plan differs — so a headline number can never show a
  // previous plan's rate through the debounce + recompute, and a silently
  // failed re-run can never leave a stale rate up (edits produce a new plan
  // object via structuredClone, so reference identity is the right key).
  const [snapshot, setSnapshot] = useState<{ plan: Plan; rate: number | null; failed: boolean } | null>(null)
  const runToken = useRef(0)
  useEffect(() => {
    if (!enabled) return undefined
    const token = ++runToken.current
    const attach = () => {
      successRateOf(plan)
        .then((rate) => {
          if (token === runToken.current) setSnapshot({ plan, rate, failed: false })
        })
        .catch(() => {
          // The Monte Carlo page carries the error detail and retry; here the
          // KPI only needs to stop claiming a simulation is in progress.
          if (token === runToken.current) setSnapshot({ plan, rate: null, failed: true })
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
  }, [plan, enabled])
  const current = enabled && snapshot !== null && snapshot.plan === plan ? snapshot : null
  const status: McSuccessRateStatus = !enabled ? 'idle' : current === null ? 'running' : current.failed ? 'failed' : 'done'
  return { rate: current?.rate ?? null, status }
}

export function useMcSuccessRate(plan: Plan, enabled: boolean): number | null {
  return useMcSuccessRateState(plan, enabled).rate
}
