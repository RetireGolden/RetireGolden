/**
 * Spawns the optimizer in a Web Worker (lazy-loaded only here, so the wasm
 * chunk is fetched only when Optimize is invoked) and resolves the schedule.
 * Falls back to a synchronous in-process solve where Worker is unavailable
 * (tests, very old browsers), mirroring src/mc/pool.ts.
 */

import type { OptimizeRequest, OptimizeResponse, OptimizeResult } from './messages'
import { runOptimizeRequest } from './runOptimize'
import { runWorkerRequest } from '../workers/run'

export function runOptimize(req: OptimizeRequest): Promise<OptimizeResult> {
  if (typeof Worker === 'undefined') return runOptimizeRequest(req)
  return runWorkerRequest<OptimizeRequest, OptimizeResponse, OptimizeResult>({
    request: req,
    createWorker: () => new Worker(new URL('./optimize.worker.ts', import.meta.url), { type: 'module' }),
    interpret: (msg) =>
      msg.type === 'done' ? { kind: 'done', result: msg.result } : { kind: 'error', message: msg.message },
    errorLabel: 'Optimizer worker failed',
  })
}
