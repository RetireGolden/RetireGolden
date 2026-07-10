/**
 * Web Worker entry for the sustainable-spending solver: one request per run,
 * ~25 exact-ledger simulations off the main thread, summarized result posted
 * back. No wasm — the solver is pure `simulatePlan` bisection.
 */

import type { SpendingSolveRequest, SpendingSolveResponse } from './spendingMessages'
import { runSpendingSolveRequest } from './runSpendingSolve'

const post = (msg: SpendingSolveResponse) => (self as unknown as Worker).postMessage(msg)

self.onmessage = (event: MessageEvent<SpendingSolveRequest>) => {
  try {
    post({ type: 'done', result: runSpendingSolveRequest(event.data) })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
