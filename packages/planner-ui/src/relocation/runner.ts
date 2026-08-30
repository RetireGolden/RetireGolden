/**
 * Spawns the relocation-compare sweep in a Web Worker (lazy-loaded only here)
 * and resolves the comparison. Falls back to a synchronous in-process run
 * where Worker is unavailable (tests, very old browsers), mirroring
 * src/optimize/spendingRunner.ts.
 */

import type { RelocationComparison } from '@retiregolden/engine/projection/relocation'
import { envelope, type PlannerWorkerEnvelope } from '../workers/channels'
import { runWorkerRequest } from '../workers/run'
import { spawnPlannerWorker } from '../workers/spawn'
import type { RelocationCompareRequest, RelocationCompareResponse } from './messages'
import { runRelocationCompareRequest } from './runRelocation'

export function runRelocationCompare(req: RelocationCompareRequest): Promise<RelocationComparison> {
  if (typeof Worker === 'undefined') return Promise.resolve(runRelocationCompareRequest(req))
  return runWorkerRequest<
    PlannerWorkerEnvelope<'relocation', RelocationCompareRequest>,
    RelocationCompareResponse,
    RelocationComparison
  >({
    request: envelope('relocation', req),
    createWorker: spawnPlannerWorker,
    interpret: (msg) =>
      msg.type === 'done' ? { kind: 'done', result: msg.result } : { kind: 'error', message: msg.message },
    errorLabel: 'Relocation compare worker failed',
  })
}
