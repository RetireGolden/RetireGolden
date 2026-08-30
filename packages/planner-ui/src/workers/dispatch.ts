/**
 * The planner worker's request routing, separated from the worker entry so it
 * can be tested directly.
 *
 * `planner.worker.ts` is a Web Worker entry: it touches `self` and statically
 * imports the HiGHS wasm through Vite's `?url` asset pipeline, neither of
 * which exists under a plain test runner. And because the runners all fall
 * back to an in-process solve when `Worker` is undefined, a jsdom suite
 * exercises the *fallback* path and never the worker's own routing — so a
 * mis-wired channel arm, a wrong response `type`, or a dropped transfer list
 * would reach users unseen.
 *
 * Everything the entry does beyond wiring lives here, parameterised on how to
 * post and where the wasm is, so ./dispatch.test.ts can assert the routing.
 */

import type { PlannerWorkerChannel, PlannerWorkerEnvelope } from './channels'
import type { WorkerRequest as McRequest, WorkerResponse as McResponse } from '../mc/messages'
import {
  runFrontierRequest,
  runHistoricalStressSuiteRequest,
  runMcRequest,
  runRiskBasedGuardrailRequest,
} from '../mc/runRequest'
import type { OptimizeRequest, OptimizeResponse } from '../optimize/messages'
import { runOptimizeRequest } from '../optimize/runOptimize'
import type { SpendingSolveRequest, SpendingSolveResponse } from '../optimize/spendingMessages'
import { runSpendingSolveRequest } from '../optimize/runSpendingSolve'
import type { RelocationCompareRequest, RelocationCompareResponse } from '../relocation/messages'
import { runRelocationCompareRequest } from '../relocation/runRelocation'

export type PlannerWorkerRequest =
  | PlannerWorkerEnvelope<'monteCarlo', McRequest>
  | PlannerWorkerEnvelope<'optimize', OptimizeRequest>
  | PlannerWorkerEnvelope<'spendingSolve', SpendingSolveRequest>
  | PlannerWorkerEnvelope<'relocation', RelocationCompareRequest>

export type PlannerWorkerResponse =
  | McResponse
  | OptimizeResponse
  | SpendingSolveResponse
  | RelocationCompareResponse

export interface PlannerWorkerHost {
  /** Post a response back to the spawning thread. */
  post: (msg: PlannerWorkerResponse, transfer?: Transferable[]) => void
  /** URL of the HiGHS wasm; only the optimize channel ever calls it. */
  wasmUrl: () => string
}

/** Monte Carlo: four request kinds, and the only channel that streams progress. */
function handleMonteCarlo(req: McRequest, { post }: PlannerWorkerHost): void {
  if (req.kind === 'frontiers') {
    post({ type: 'frontiersDone', result: runFrontierRequest(req) })
    return
  }
  if (req.kind === 'historicalSuites') {
    post({ type: 'historicalSuitesDone', result: runHistoricalStressSuiteRequest(req) })
    return
  }
  if (req.kind === 'riskBasedGuardrails') {
    post({
      type: 'riskBasedDone',
      result: runRiskBasedGuardrailRequest(req, (completed) => post({ type: 'progress', completed })),
    })
    return
  }
  const result = runMcRequest(req, (completed) => {
    if (completed % req.progressEvery === 0) post({ type: 'progress', completed })
  })
  post(
    { type: 'done', result },
    // Float64Array buffers are transferred, not copied.
    result.paths.map((p) => p.investableByYear.buffer),
  )
}

/**
 * Route one enveloped request to its surface and post the result. Rejects on
 * failure; the entry turns that into an `{ type: 'error' }` message.
 */
export async function dispatchPlannerWorkerRequest(
  message: PlannerWorkerRequest,
  host: PlannerWorkerHost,
): Promise<void> {
  switch (message.channel) {
    case 'monteCarlo':
      handleMonteCarlo(message.request, host)
      return
    case 'optimize':
      host.post({ type: 'done', result: await runOptimizeRequest(message.request, host.wasmUrl) })
      return
    case 'spendingSolve':
      host.post({ type: 'done', result: runSpendingSolveRequest(message.request) })
      return
    case 'relocation':
      host.post({ type: 'done', result: runRelocationCompareRequest(message.request) })
      return
    default: {
      const unknown: never = message
      throw new Error(
        `Unknown planner worker channel: ${String((unknown as { channel?: PlannerWorkerChannel }).channel)}`,
      )
    }
  }
}
