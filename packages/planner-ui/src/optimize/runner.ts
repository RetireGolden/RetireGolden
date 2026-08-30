/**
 * Runs the optimizer on the planner's shared Web Worker
 * (../workers/planner.worker.ts, `optimize` channel) and resolves the
 * schedule. The worker script is shared with Monte Carlo, the spending solver,
 * and relocation compare, so it may already be in the browser's cache; what
 * stays lazy is the ~3 MB HiGHS wasm, which only this channel ever fetches.
 * Falls back to a synchronous in-process solve where Worker is unavailable
 * (tests, very old browsers), mirroring src/mc/pool.ts.
 */

import type { OptimizeRequest, OptimizeResponse, OptimizeResult } from './messages'
import { runOptimizeRequest } from './runOptimize'
import { envelope, type PlannerWorkerEnvelope } from '../workers/channels'
import { runWorkerRequest } from '../workers/run'
import { spawnPlannerWorker } from '../workers/spawn'

export function runOptimize(req: OptimizeRequest): Promise<OptimizeResult> {
  if (typeof Worker === 'undefined') return runOptimizeRequest(req)
  return runWorkerRequest<PlannerWorkerEnvelope<'optimize', OptimizeRequest>, OptimizeResponse, OptimizeResult>({
    request: envelope('optimize', req),
    createWorker: spawnPlannerWorker,
    interpret: (msg) =>
      msg.type === 'done' ? { kind: 'done', result: msg.result } : { kind: 'error', message: msg.message },
    errorLabel: 'Optimizer worker failed',
  })
}
