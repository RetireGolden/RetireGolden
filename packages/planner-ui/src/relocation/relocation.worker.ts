/**
 * Web Worker entry for the relocation compare: one request per run — up to
 * six deterministic full-plan simulations plus the optional shared-path
 * Monte Carlo — posted back as one summarized result.
 */

import type { RelocationCompareRequest, RelocationCompareResponse } from './messages'
import { runRelocationCompareRequest } from './runRelocation'

const post = (msg: RelocationCompareResponse) => (self as unknown as Worker).postMessage(msg)

self.onmessage = (event: MessageEvent<RelocationCompareRequest>) => {
  try {
    post({ type: 'done', result: runRelocationCompareRequest(event.data) })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
