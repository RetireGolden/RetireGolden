/**
 * Web Worker entry for the V8 optimizer (roadmap V8). One request per run:
 * solve the plan's conversion MILP off the main thread and post the schedule
 * back. HiGHS-WASM is loaded lazily inside the worker — the ~3 MB wasm is
 * emitted as a separate Vite asset (`?url`) and only fetched when Optimize is
 * actually invoked, never in the main bundle.
 */

// `highs/runtime` is the package's exported alias for build/highs.wasm; `?url`
// makes Vite emit it as a separate asset fetched lazily by the worker.
import wasmUrl from 'highs/runtime?url'
import type { OptimizeRequest, OptimizeResponse } from './messages'
import { runOptimizeRequest } from './runOptimize'

// Deployment marker: keeps the hashed worker asset moving when worker-level
// serving headers need to be refreshed through immutable CDN caches.
;(self as unknown as { __retiregoldenOptimizerWorkerBuild?: string }).__retiregoldenOptimizerWorkerBuild =
  'optimizer-worker-csp-2026-06-25'

const post = (msg: OptimizeResponse) => (self as unknown as Worker).postMessage(msg)

self.onmessage = async (event: MessageEvent<OptimizeRequest>) => {
  try {
    const result = await runOptimizeRequest(event.data, () => wasmUrl)
    post({ type: 'done', result })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
