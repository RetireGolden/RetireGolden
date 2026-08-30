/**
 * The planner's single Web Worker entry.
 *
 * One worker script serves every off-main-thread surface — Monte Carlo
 * (roadmap V4), the HiGHS optimizer (V8), the sustainable-spending solver, and
 * relocation compare — dispatching on the request's `channel` tag
 * (./channels.ts). They all sit on the same engine simulation core, and Vite
 * bundles each worker ENTRY in a separate rolldown build, so four entries meant
 * four copies of that core in `dist/` and in the PWA precache. One entry means
 * one copy.
 *
 * A worker instance still handles exactly one request and is terminated by
 * ./run.ts once it settles, so the Monte Carlo pool keeps spawning one instance
 * per slice exactly as before.
 */

// `highs/runtime` is the package's exported alias for build/highs.wasm; `?url`
// makes Vite emit it as a separate asset. This is a URL string, not the wasm:
// only the optimize channel ever fetches it, and `runOptimizeRequest` imports
// the HiGHS glue dynamically, so the other channels pay nothing for it.
import wasmUrl from 'highs/runtime?url'

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

// Deployment marker: keeps the hashed worker asset moving when worker-level
// serving headers need to be refreshed through immutable CDN caches.
;(self as unknown as { __retiregoldenOptimizerWorkerBuild?: string }).__retiregoldenOptimizerWorkerBuild =
  'optimizer-worker-csp-2026-06-25'

export type PlannerWorkerRequest =
  | PlannerWorkerEnvelope<'monteCarlo', McRequest>
  | PlannerWorkerEnvelope<'optimize', OptimizeRequest>
  | PlannerWorkerEnvelope<'spendingSolve', SpendingSolveRequest>
  | PlannerWorkerEnvelope<'relocation', RelocationCompareRequest>

type AnyResponse = McResponse | OptimizeResponse | SpendingSolveResponse | RelocationCompareResponse

const post = (msg: AnyResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer)

/** Monte Carlo: four request kinds, and the only channel that streams progress. */
function handleMonteCarlo(req: McRequest): void {
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

async function dispatch(message: PlannerWorkerRequest): Promise<void> {
  switch (message.channel) {
    case 'monteCarlo':
      handleMonteCarlo(message.request)
      return
    case 'optimize':
      post({ type: 'done', result: await runOptimizeRequest(message.request, () => wasmUrl) })
      return
    case 'spendingSolve':
      post({ type: 'done', result: runSpendingSolveRequest(message.request) })
      return
    case 'relocation':
      post({ type: 'done', result: runRelocationCompareRequest(message.request) })
      return
    default: {
      const unknown: never = message
      throw new Error(`Unknown planner worker channel: ${String((unknown as { channel?: PlannerWorkerChannel }).channel)}`)
    }
  }
}

self.onmessage = (event: MessageEvent<PlannerWorkerRequest>) => {
  void dispatch(event.data).catch((err: unknown) => {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  })
}
