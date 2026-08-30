/**
 * The planner's single Web Worker entry.
 *
 * One worker script serves every off-main-thread surface — Monte Carlo
 * (roadmap V4), the HiGHS optimizer (V8), the sustainable-spending solver, and
 * relocation compare — dispatching on the request's `channel` tag
 * (./channels.ts). They all sit on the same engine simulation core, and Vite
 * bundles each worker ENTRY in a separate rolldown build, so four entries meant
 * four copies of that core in `dist/` and in the PWA precache. One entry means
 * one copy, and the bundle budget holds it to exactly one
 * (DOCS/operations/bundle-budget.md).
 *
 * A worker instance still handles exactly one request and is terminated by
 * ./run.ts once it settles, so the Monte Carlo pool keeps spawning one instance
 * per slice exactly as before.
 *
 * This file is wiring only. The routing lives in ./dispatch.ts, which a test
 * runner can import — this one it cannot, because of `self` and the `?url`
 * asset import below.
 */

// `highs/runtime` is the package's exported alias for build/highs.wasm; `?url`
// makes Vite emit it as a separate asset. This is a URL string, not the wasm:
// only the optimize channel ever fetches it, and `runOptimizeRequest` imports
// the HiGHS glue dynamically, so the other channels pay nothing for it.
import wasmUrl from 'highs/runtime?url'

import {
  dispatchPlannerWorkerRequest,
  type PlannerWorkerRequest,
  type PlannerWorkerResponse,
} from './dispatch'

// Deployment marker: keeps the hashed worker asset moving when worker-level
// serving headers need to be refreshed through immutable CDN caches. The value
// is historical — it dates from when this was the optimizer's own worker — and
// stays put deliberately: changing it re-hashes the asset, which is the whole
// point of touching it, so it should only move when a header refresh is
// actually wanted. The marker now covers every channel, not just Optimize.
;(self as unknown as { __retiregoldenPlannerWorkerBuild?: string }).__retiregoldenPlannerWorkerBuild =
  'optimizer-worker-csp-2026-06-25'

const post = (msg: PlannerWorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer)

self.onmessage = (event: MessageEvent<PlannerWorkerRequest>) => {
  void dispatchPlannerWorkerRequest(event.data, { post, wasmUrl: () => wasmUrl }).catch((err: unknown) => {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  })
}
