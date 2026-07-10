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

import type { Plan } from '../engine/model/plan'
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

export function useMcSuccessRate(plan: Plan, enabled: boolean): number | null {
  // The rate is stored WITH the plan it was computed for, and derived to null
  // whenever the current plan differs — so a headline number can never show a
  // previous plan's rate through the debounce + recompute, and a silently
  // failed re-run can never leave a stale rate up (edits produce a new plan
  // object via structuredClone, so reference identity is the right key).
  const [snapshot, setSnapshot] = useState<{ plan: Plan; rate: number } | null>(null)
  const runToken = useRef(0)
  useEffect(() => {
    if (!enabled) return undefined
    const token = ++runToken.current
    const t = window.setTimeout(() => {
      successRateOf(plan)
        .then((rate) => {
          if (token === runToken.current) setSnapshot({ plan, rate })
        })
        .catch(() => {
          /* silent — the Monte Carlo page carries the error state and retry */
        })
    }, MC_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(t)
    }
  }, [plan, enabled])
  return enabled && snapshot !== null && snapshot.plan === plan ? snapshot.rate : null
}
