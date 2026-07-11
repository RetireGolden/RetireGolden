/**
 * Spawns the sustainable-spending solver in a Web Worker (lazy-loaded only
 * here) and resolves the summarized result. Falls back to a synchronous
 * in-process solve where Worker is unavailable (tests, very old browsers),
 * mirroring ./runner.ts.
 */

import type { SpendingSolveRequest, SpendingSolveResponse, SpendingSolveResult } from './spendingMessages'
import { runSpendingSolveRequest } from './runSpendingSolve'
import { runWorkerRequest } from '../workers/run'

export function runSpendingSolve(req: SpendingSolveRequest): Promise<SpendingSolveResult> {
  if (typeof Worker === 'undefined') return Promise.resolve(runSpendingSolveRequest(req))
  return runWorkerRequest<SpendingSolveRequest, SpendingSolveResponse, SpendingSolveResult>({
    request: req,
    createWorker: () => new Worker(new URL('./spendingSolve.worker.ts', import.meta.url), { type: 'module' }),
    interpret: (msg) =>
      msg.type === 'done' ? { kind: 'done', result: msg.result } : { kind: 'error', message: msg.message },
    errorLabel: 'Spending solver worker failed',
  })
}
