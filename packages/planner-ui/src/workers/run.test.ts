import { describe, expect, it, vi } from 'vitest'

import { runWorkerRequest } from './run'

type TestMessage =
  | { type: 'progress'; completed: number }
  | { type: 'done'; result: number }
  | { type: 'error'; message: string }

interface TestWorker {
  onmessage: Worker['onmessage']
  onmessageerror: Worker['onmessageerror']
  onerror: Worker['onerror']
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
}

function testWorker(): TestWorker {
  return {
    onmessage: null,
    onmessageerror: null,
    onerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  }
}

function run(worker: TestWorker, signal?: AbortSignal) {
  return runWorkerRequest<string, TestMessage, number>({
    request: 'request',
    createWorker: () => worker as unknown as Worker,
    interpret: (message) => {
      if (message.type === 'progress') return { kind: 'progress' }
      if (message.type === 'done') return { kind: 'done', result: message.result }
      return { kind: 'error', message: message.message }
    },
    errorLabel: 'test worker failed',
    signal,
  })
}

describe('runWorkerRequest cancellation', () => {
  it('rejects an already-aborted request without spawning a worker', async () => {
    const controller = new AbortController()
    controller.abort()
    const createWorker = vi.fn(() => testWorker())
    const promise = runWorkerRequest<string, TestMessage, number>({
      request: 'request',
      createWorker: () => createWorker() as unknown as Worker,
      interpret: () => ({ kind: 'done', result: 1 }),
      errorLabel: 'test worker failed',
      signal: controller.signal,
    })

    await expect(promise).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Worker request was aborted.',
    })
    expect(createWorker).not.toHaveBeenCalled()
  })

  it('terminates active work, removes the listener, and ignores late events', async () => {
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    const worker = testWorker()
    const promise = run(worker, controller.signal)
    const lateMessage = worker.onmessage!
    const lateError = worker.onerror!

    controller.abort()

    await expect(promise).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Worker request was aborted.',
    })
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))

    lateMessage.call(
      worker as unknown as Worker,
      new MessageEvent<TestMessage>('message', { data: { type: 'done', result: 42 } }),
    )
    lateError.call(worker as unknown as AbstractWorker, { message: 'late failure' } as ErrorEvent)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('settles normally once and makes a later abort a no-op', async () => {
    const controller = new AbortController()
    const worker = testWorker()
    const promise = run(worker, controller.signal)
    const message = worker.onmessage!

    message.call(
      worker as unknown as Worker,
      new MessageEvent<TestMessage>('message', { data: { type: 'progress', completed: 1 } }),
    )
    message.call(
      worker as unknown as Worker,
      new MessageEvent<TestMessage>('message', { data: { type: 'done', result: 42 } }),
    )
    await expect(promise).resolves.toBe(42)

    controller.abort()
    message.call(
      worker as unknown as Worker,
      new MessageEvent<TestMessage>('message', { data: { type: 'done', result: 99 } }),
    )
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
})
