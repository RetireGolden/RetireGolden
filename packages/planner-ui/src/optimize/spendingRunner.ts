/**
 * Runs the sustainable-spending solver on the planner's shared Web Worker
 * (../workers/planner.worker.ts, `spendingSolve` channel) and resolves the
 * summarized result. No wasm — the solver is pure `simulatePlan` bisection.
 * A development build (`import.meta.env.DEV`: tests, the dev server) solves
 * synchronously in-process where Worker is unavailable, mirroring ./runner.ts;
 * a production build compiles that path out and fails with a stated reason
 * instead (../workers/spawn.ts).
 */

import type { SpendingSolveRequest, SpendingSolveResponse, SpendingSolveResult } from './spendingMessages'
import { runSpendingSolveRequest } from './runSpendingSolve'
import { envelope, type PlannerWorkerEnvelope } from '../workers/channels'
import { createWorkerRequestAbortError, runWorkerRequest } from '../workers/run'
import { spawnPlannerWorker } from '../workers/spawn'

export interface SpendingSolveRunOptions {
  signal?: AbortSignal
}

export function runSpendingSolve(
  req: SpendingSolveRequest,
  options: SpendingSolveRunOptions = {},
): Promise<SpendingSolveResult> {
  if (typeof Worker === 'undefined' && import.meta.env.DEV) {
    return Promise.resolve().then(() => {
      if (options.signal?.aborted) throw createWorkerRequestAbortError()
      return runSpendingSolveRequest(req)
    })
  }
  return runWorkerRequest<
    PlannerWorkerEnvelope<'spendingSolve', SpendingSolveRequest>,
    SpendingSolveResponse,
    SpendingSolveResult
  >({
    request: envelope('spendingSolve', req),
    createWorker: spawnPlannerWorker,
    interpret: (msg) =>
      msg.type === 'done' ? { kind: 'done', result: msg.result } : { kind: 'error', message: msg.message },
    errorLabel: 'Spending solver worker failed',
    signal: options.signal,
  })
}
