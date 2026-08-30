/**
 * The envelope every planner Web Worker request travels in.
 *
 * The planner used to ship four worker entry files (Monte Carlo, optimizer,
 * spending solver, relocation). Vite bundles each worker entry in its OWN
 * rolldown build, so nothing can be shared between them: all four statically
 * pulled in the same ~740 KB engine simulation core and the app emitted (and
 * precached) four near-identical copies of it.
 *
 * One entry file — `planner.worker.ts` — with a `channel` tag on the request
 * collapses that to a single emitted worker chunk. Each spawn is still its own
 * worker instance handling exactly one request (see ./run.ts), so the
 * concurrency story is unchanged; only the script the instances are built from
 * is now shared.
 */

export type PlannerWorkerChannel = 'monteCarlo' | 'optimize' | 'spendingSolve' | 'relocation'

/** A channel tag wrapped around one surface's own request payload. */
export interface PlannerWorkerEnvelope<TChannel extends PlannerWorkerChannel, TRequest> {
  channel: TChannel
  request: TRequest
}

export function envelope<TChannel extends PlannerWorkerChannel, TRequest>(
  channel: TChannel,
  request: TRequest,
): PlannerWorkerEnvelope<TChannel, TRequest> {
  return { channel, request }
}
