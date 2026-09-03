import { afterEach, describe, expect, it, vi } from 'vitest'

import { noTraditionalPlan } from '@retiregolden/engine/decisions/decisionFixtures'
import { runSpendingSolveRequest } from './optimize/runSpendingSolve'
import { runSpendingSolve, type SpendingSolveRequest } from './spendingSolve'

interface StubWorker {
  onmessage: Worker['onmessage']
  onmessageerror: Worker['onmessageerror']
  onerror: Worker['onerror']
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
}

let spawnedWorker: StubWorker | null = null

function captureSpawnedWorker(worker: StubWorker): void {
  spawnedWorker = worker
}

class SpendingWorkerStub {
  onmessage: Worker['onmessage'] = null
  onmessageerror: Worker['onmessageerror'] = null
  onerror: Worker['onerror'] = null
  postMessage = vi.fn()
  terminate = vi.fn()

  constructor() {
    captureSpawnedWorker(this)
  }
}

afterEach(() => {
  spawnedWorker = null
  vi.unstubAllGlobals()
})

describe('runSpendingSolve', () => {
  it('uses the synchronous solver when Worker is unavailable', async () => {
    vi.stubGlobal('Worker', undefined)
    expect(typeof Worker).toBe('undefined')
    const request: SpendingSolveRequest = {
      plan: noTraditionalPlan(),
      startYear: 2026,
      maxSimulations: 2,
    }

    await expect(runSpendingSolve(request)).resolves.toEqual(runSpendingSolveRequest(request))
  })

  it('turns synchronous fallback errors into Promise rejections', async () => {
    vi.stubGlobal('Worker', undefined)
    const invalidRequest: SpendingSolveRequest = {
      plan: {} as SpendingSolveRequest['plan'],
      startYear: 2026,
    }
    let returned!: ReturnType<typeof runSpendingSolve>

    expect(() => {
      returned = runSpendingSolve(invalidRequest)
    }).not.toThrow()
    expect(returned).toBeInstanceOf(Promise)
    await expect(returned).rejects.toThrow()
  })

  it('rejects an already-aborted synchronous fallback with AbortError', async () => {
    vi.stubGlobal('Worker', undefined)
    const controller = new AbortController()
    controller.abort()
    let returned!: ReturnType<typeof runSpendingSolve>

    expect(() => {
      returned = runSpendingSolve(
        { plan: noTraditionalPlan(), startYear: 2026, maxSimulations: 2 },
        { signal: controller.signal },
      )
    }).not.toThrow()
    await expect(returned).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Worker request was aborted.',
    })
  })

  it('can abort the synchronous fallback before its deferred solve starts', async () => {
    vi.stubGlobal('Worker', undefined)
    const controller = new AbortController()
    const promise = runSpendingSolve(
      { plan: noTraditionalPlan(), startYear: 2026, maxSimulations: 2 },
      { signal: controller.signal },
    )

    controller.abort()

    await expect(promise).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Worker request was aborted.',
    })
  })

  it('passes cancellation through the published facade and terminates its worker', async () => {
    vi.stubGlobal('Worker', SpendingWorkerStub)
    const controller = new AbortController()
    const promise = runSpendingSolve(
      { plan: noTraditionalPlan(), startYear: 2026, maxSimulations: 2 },
      { signal: controller.signal },
    )
    const worker = spawnedWorker
    expect(worker).not.toBeNull()

    controller.abort()

    await expect(promise).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Worker request was aborted.',
    })
    expect(worker!.terminate).toHaveBeenCalledTimes(1)
  })
})
