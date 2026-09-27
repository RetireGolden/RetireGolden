import { describe, expect, it, vi } from 'vitest'

import { MonteCarloComparisonRefusal } from '@retiregolden/engine/decisions/stochastic'
import { InsightPreviewUnavailable } from '@retiregolden/engine/insights/previewUnavailable'
import { PlanHeadlineRefusal } from '@retiregolden/engine/scenarios/planHeadlines'
import { NonFiniteComparisonError } from '@retiregolden/engine/scenarios/scalarComparison'
import { plannerWorkerErrorMessage } from './dispatch'
import { engineRefusalOf, errorFromWorkerMessage, workerErrorMessage, WorkerRefusalError } from './refusal'
import { runWorkerRequest } from './run'

// PR #754: a typed engine refusal crosses the worker boundary as plain data,
// since an error's class does not survive postMessage, and the page reads it
// back through engineRefusalOf.
describe('typed engine refusals across the worker boundary', () => {
  it('recognises each engine refusal class by its name and fields', () => {
    expect(engineRefusalOf(new NonFiniteComparisonError('proposal', Number.NaN))).toEqual({
      kind: 'non-finite-figure',
      role: 'proposal',
    })
    expect(engineRefusalOf(new PlanHeadlineRefusal('birth-date-missing', 'baseline', 'x'))).toEqual({
      kind: 'plan-headline',
      reason: 'birth-date-missing',
      side: 'baseline',
    })
    expect(engineRefusalOf(new MonteCarloComparisonRefusal('start-years-differ', 'x'))).toEqual({
      kind: 'monte-carlo-runs',
      reason: 'start-years-differ',
    })
    expect(engineRefusalOf(new InsightPreviewUnavailable('Nothing to preview.'))).toEqual({
      kind: 'insight-preview-unavailable',
      message: 'Nothing to preview.',
    })
    expect(engineRefusalOf(new Error('solver exploded'))).toBeNull()
    expect(engineRefusalOf(new RangeError('A plain range error'))).toBeNull()
    expect(engineRefusalOf('not an error')).toBeNull()
  })

  it('posts the refusal as plain data that survives structured clone, and rebuilds it on the page thread', () => {
    const posted = plannerWorkerErrorMessage(new NonFiniteComparisonError('baseline', Number.POSITIVE_INFINITY))
    expect(posted).toEqual({
      type: 'error',
      message: 'A compared figure must be a finite number; the baseline is Infinity',
      refusal: { kind: 'non-finite-figure', role: 'baseline' },
    })
    const received = structuredClone(posted) as { message: string; refusal?: Parameters<typeof errorFromWorkerMessage>[1] }
    const rebuilt = errorFromWorkerMessage(received.message, received.refusal)
    expect(rebuilt).toBeInstanceOf(WorkerRefusalError)
    expect(engineRefusalOf(rebuilt)).toEqual({ kind: 'non-finite-figure', role: 'baseline' })
    // An error nothing recognises posts no refusal and rebuilds as a plain Error.
    expect(workerErrorMessage(new Error('solver exploded'))).toEqual({ type: 'error', message: 'solver exploded' })
    const plain = errorFromWorkerMessage('solver exploded', undefined)
    expect(plain).not.toBeInstanceOf(WorkerRefusalError)
    expect(engineRefusalOf(plain)).toBeNull()
  })

  it('runWorkerRequest rejects with the refusal a worker error message carries', async () => {
    const worker = {
      onmessage: null as Worker['onmessage'],
      onerror: null as Worker['onerror'],
      postMessage: vi.fn(),
      terminate: vi.fn(),
    }
    type Message = { type: 'done'; result: number } | ReturnType<typeof workerErrorMessage>
    const promise = runWorkerRequest<string, Message, number>({
      request: 'request',
      createWorker: () => worker as unknown as Worker,
      interpret: (message) =>
        message.type === 'done'
          ? { kind: 'done', result: message.result }
          : { kind: 'error', message: message.message, refusal: message.refusal },
      errorLabel: 'test worker failed',
    })
    worker.onmessage!.call(
      worker as unknown as Worker,
      { data: workerErrorMessage(new NonFiniteComparisonError('difference', Number.NaN)) } as MessageEvent<Message>,
    )
    const error = await promise.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(WorkerRefusalError)
    expect(engineRefusalOf(error)).toEqual({ kind: 'non-finite-figure', role: 'difference' })
    expect(worker.terminate).toHaveBeenCalled()
  })
})
