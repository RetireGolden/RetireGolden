/**
 * Generic Web Worker request/response runner shared by the Monte Carlo pool
 * (src/mc/pool.ts) and the optimizer/spending solvers (src/optimize/). Spawns
 * a worker, posts one request, resolves on the interpreted done-message,
 * rejects on an error message or worker error, and always terminates the
 * worker once settled.
 */

export type WorkerMessageOutcome<TResult> =
  | { kind: 'done'; result: TResult }
  | { kind: 'error'; message: string }
  /** Keep listening (e.g. progress messages). */
  | { kind: 'progress' }

export function runWorkerRequest<TReq, TMsg, TResult>(options: {
  request: TReq
  /**
   * Call sites keep the literal `new Worker(new URL('./x.worker.ts',
   * import.meta.url), ...)` so the bundler can still see and split the chunk.
   */
  createWorker: () => Worker
  interpret: (msg: TMsg) => WorkerMessageOutcome<TResult>
  /** Fallback error text when the worker fails without a message. */
  errorLabel: string
  /** Observe the spawned worker (e.g. so a pool can terminate siblings). */
  onSpawn?: (worker: Worker) => void
}): Promise<TResult> {
  const { request, createWorker, interpret, errorLabel, onSpawn } = options
  return new Promise((resolve, reject) => {
    const worker = createWorker()
    onSpawn?.(worker)
    worker.onmessage = (event: MessageEvent<TMsg>) => {
      const outcome = interpret(event.data)
      if (outcome.kind === 'progress') return
      worker.terminate()
      if (outcome.kind === 'done') resolve(outcome.result)
      else reject(new Error(outcome.message))
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || errorLabel))
    }
    worker.postMessage(request)
  })
}
