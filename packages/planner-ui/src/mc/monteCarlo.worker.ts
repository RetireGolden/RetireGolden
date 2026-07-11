/**
 * Web Worker entry for Monte Carlo paths (roadmap V4). One request per
 * worker run: simulate the assigned slice of paths, stream progress, post
 * the reduced per-path results back (Float64Array buffers transferred, not
 * copied).
 */

import type { WorkerRequest, WorkerResponse } from './messages'
import {
  runFrontierRequest,
  runHistoricalStressSuiteRequest,
  runMcRequest,
  runRiskBasedGuardrailRequest,
} from './runRequest'

const post = (msg: WorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer)

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data
  try {
    if (req.kind === 'frontiers') {
      post({ type: 'frontiersDone', result: runFrontierRequest(req) })
      return
    }
    if (req.kind === 'historicalSuites') {
      post({ type: 'historicalSuitesDone', result: runHistoricalStressSuiteRequest(req) })
      return
    }
    if (req.kind === 'riskBasedGuardrails') {
      post({ type: 'riskBasedDone', result: runRiskBasedGuardrailRequest(req, (completed) => post({ type: 'progress', completed })) })
      return
    }
    const result = runMcRequest(req, (completed) => {
      if (completed % req.progressEvery === 0) post({ type: 'progress', completed })
    })
    post(
      { type: 'done', result },
      result.paths.map((p) => p.investableByYear.buffer),
    )
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
