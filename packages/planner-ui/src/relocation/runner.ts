/**
 * Runs the relocation-compare sweep on the planner's shared Web Worker
 * (../workers/planner.worker.ts, `relocation` channel) and resolves the
 * comparison. A development build (`import.meta.env.DEV`: tests, the dev
 * server) runs synchronously in-process where Worker is unavailable, mirroring
 * src/optimize/spendingRunner.ts; a production build compiles that path out and
 * fails with a stated reason instead (../workers/spawn.ts).
 */

import type { RelocationComparison } from '@retiregolden/engine/projection/relocation'
import { envelope, type PlannerWorkerEnvelope } from '../workers/channels'
import { runWorkerRequest } from '../workers/run'
import { spawnPlannerWorker } from '../workers/spawn'
import type { RelocationCompareRequest, RelocationCompareResponse } from './messages'
import { runRelocationCompareRequest } from './runRelocation'

export function runRelocationCompare(req: RelocationCompareRequest): Promise<RelocationComparison> {
  if (typeof Worker === 'undefined' && import.meta.env.DEV) return Promise.resolve(runRelocationCompareRequest(req))
  return runWorkerRequest<
    PlannerWorkerEnvelope<'relocation', RelocationCompareRequest>,
    RelocationCompareResponse,
    RelocationComparison
  >({
    request: envelope('relocation', req),
    createWorker: spawnPlannerWorker,
    interpret: (msg) =>
      msg.type === 'done'
        ? { kind: 'done', result: msg.result }
        : { kind: 'error', message: msg.message, refusal: msg.refusal },
    errorLabel: 'Relocation compare worker failed',
  })
}
