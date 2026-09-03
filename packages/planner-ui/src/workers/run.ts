/**
 * Generic Web Worker request/response runner shared by the Monte Carlo pool
 * (src/mc/pool.ts), the optimizer/spending solvers (src/optimize/), and
 * relocation compare (src/relocation/) — all of which run on the one worker
 * entry in ./planner.worker.ts, tagged by channel (./channels.ts). Spawns
 * a worker, posts one request, resolves on the interpreted done-message,
 * rejects on an error message or worker error, and always terminates the
 * worker once settled.
 */

export type WorkerMessageOutcome<TResult> =
  | { kind: 'done'; result: TResult }
  | { kind: 'error'; message: string }
  /** Keep listening (e.g. progress messages). */
  | { kind: 'progress' }

const WORKER_REQUEST_ABORT_MESSAGE = 'Worker request was aborted.'

export function createWorkerRequestAbortError(): Error {
  const error = new Error(WORKER_REQUEST_ABORT_MESSAGE)
  error.name = 'AbortError'
  return error
}

export function runWorkerRequest<TReq, TMsg, TResult>(options: {
  request: TReq
  /**
   * Call sites pass `spawnPlannerWorker` (./spawn.ts), which holds the literal
   * `new Worker(new URL('./planner.worker.ts', import.meta.url), ...)` the
   * bundler matches to emit the worker chunk.
   */
  createWorker: () => Worker
  interpret: (msg: TMsg) => WorkerMessageOutcome<TResult>
  /** Fallback error text when the worker fails without a message. */
  errorLabel: string
  /** Observe the spawned worker (e.g. so a pool can terminate siblings). */
  onSpawn?: (worker: Worker) => void
  /** Abort terminates an active worker and rejects with an `AbortError`. */
  signal?: AbortSignal
}): Promise<TResult> {
  const { request, createWorker, interpret, errorLabel, onSpawn, signal } = options
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createWorkerRequestAbortError())
      return
    }

    let settled = false
    let worker: Worker
    const cleanup = () => {
      signal?.removeEventListener('abort', abort)
      worker.onmessage = null
      worker.onerror = null
    }
    const rejectOnce = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      worker.terminate()
      reject(error)
    }
    const resolveOnce = (result: TResult) => {
      if (settled) return
      settled = true
      cleanup()
      worker.terminate()
      resolve(result)
    }
    function abort() {
      rejectOnce(createWorkerRequestAbortError())
    }

    try {
      worker = createWorker()
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)))
      return
    }
    worker.onmessage = (event: MessageEvent<TMsg>) => {
      if (settled) return
      let outcome: WorkerMessageOutcome<TResult>
      try {
        outcome = interpret(event.data)
      } catch (error) {
        rejectOnce(error instanceof Error ? error : new Error(String(error)))
        return
      }
      if (outcome.kind === 'progress') return
      if (outcome.kind === 'done') resolveOnce(outcome.result)
      else rejectOnce(new Error(outcome.message))
    }
    worker.onerror = (event) => {
      rejectOnce(new Error(event.message || errorLabel))
    }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) {
      abort()
      return
    }
    try {
      onSpawn?.(worker)
      if (settled) return
      worker.postMessage(request)
    } catch (error) {
      rejectOnce(error instanceof Error ? error : new Error(String(error)))
    }
  })
}
